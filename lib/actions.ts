"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentMember, getMedia, getMyUnit, getRoomByCode, getShelf, isUuid } from "./data";
import { getBookDetails, getTvDetails } from "./media-api";
import { canEditMedia, generateOwnerKey, getAccess, hashKey, keyMatches, readOwnerKey, writeOwnerKey } from "./permissions";
import { writeMemberId } from "./session";
import { SETUP_HINT, getSupabase, isSupabaseConfigured } from "./supabase-server";
import { ALLOWED_COVER_HOSTS, formatUnitLabel, isNoteUnlocked, type Note } from "./types";

/** What every Server Action in Scenara returns to the form that called it. */
export interface ActionState {
  error?: string;
  ok?: boolean;
  /** Id of the thing just created (e.g. a new shelf), so the UI can go to it. */
  id?: string;
}

const DUPLICATE = "23505";
const NOT_JOINED = "Join the room first.";
const NOT_ALLOWED = "Only the owner and collaborators can do that.";

// ---------------------------------------------------------------------------
// Create Room (CLAUDE.md §6F)
// ---------------------------------------------------------------------------

const createRoomSchema = z.object({
  name: z
    .string()
    .min(1, "Give your room a name.")
    .max(80, "Keep the room name under 80 characters."),
});

/** Short, lowercase, unambiguous room codes so links are easy to read aloud. */
function generateRoomCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no i/l/o/0/1
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function createRoom(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createRoomSchema.safeParse({ name: String(formData.get("name") ?? "").trim() });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid room name." };
  }
  if (!isSupabaseConfigured()) {
    return { error: SETUP_HINT };
  }

  const supabase = getSupabase();

  // `rooms.code` is UNIQUE, so retry a few times on the (unlikely) collision.
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = generateRoomCode();
    const ownerKey = generateOwnerKey();
    const { data, error } = await supabase
      .from("rooms")
      .insert({ code, name: parsed.data.name, owner_key_hash: hashKey(ownerKey) })
      .select("code")
      .single();

    if (!error && data) {
      // The creator becomes the owner once they pick a nickname (joinRoom).
      await writeOwnerKey(data.code, ownerKey);
      redirect(`/room/${data.code}`);
    }
    if (error?.code !== DUPLICATE) {
      return { error: error?.message ?? "Could not create the room." };
    }
  }

  return { error: "Could not get a unique room code — please try again." };
}

// ---------------------------------------------------------------------------
// Identity (CLAUDE.md §6B)
// ---------------------------------------------------------------------------

const joinSchema = z.object({
  room_code: z.string().min(1),
  nickname: z
    .string()
    .trim()
    .min(1, "Enter a name.")
    .max(30, "Keep your name under 30 characters."),
});

/** Create a member with a fresh nickname and remember them on this device. */
export async function joinRoom(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = joinSchema.safeParse({
    room_code: formData.get("room_code"),
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name." };

  const room = await getRoomByCode(parsed.data.room_code);
  if (!room) return { error: "This room no longer exists." };

  // Whoever holds the owner key and has no member row yet becomes the owner; everyone else is a viewer.
  const supabase = getSupabase();
  let role: "owner" | "viewer" = "viewer";
  if (keyMatches(room, await readOwnerKey(room.code))) {
    const { count } = await supabase
      .from("room_members")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("role", "owner");
    if (!count) role = "owner";
  }

  const { data, error } = await supabase
    .from("room_members")
    .insert({ room_id: room.id, nickname: parsed.data.nickname, role })
    .select("id")
    .single();

  if (error?.code === DUPLICATE) {
    return { error: "That name is taken. If it's you, pick it from the list below." };
  }
  if (error || !data) return { error: error?.message ?? "Could not join the room." };

  await writeMemberId(room.code, data.id);
  revalidatePath(`/room/${room.code}`);
  return { ok: true };
}

/** Reclaim an existing nickname, e.g. when returning on another device. */
export async function claimMember(roomCode: string, memberId: string): Promise<ActionState> {
  const room = await getRoomByCode(roomCode);
  if (!room || !isUuid(memberId)) return { error: "Could not find that member." };

  const { data } = await getSupabase()
    .from("room_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("room_id", room.id)
    .maybeSingle();
  if (!data) return { error: "Could not find that member." };
  // The link must never hand out edit rights: only viewers can be reclaimed by name.
  if ((data as { role: string }).role !== "viewer") {
    return { error: "Collaborators can't be reclaimed by name. Ask the owner, or use the owner key." };
  }

  await writeMemberId(room.code, memberId);
  revalidatePath(`/room/${room.code}`);
  return { ok: true };
}

/** Another device: enter the owner key to become the owner again. */
export async function recoverOwner(roomCode: string, key: string): Promise<ActionState> {
  const room = await getRoomByCode(roomCode);
  if (!room || !keyMatches(room, key)) return { error: "That owner key doesn't match this room." };

  await writeOwnerKey(room.code, key);
  const { data } = await getSupabase()
    .from("room_members")
    .select("id")
    .eq("room_id", room.id)
    .eq("role", "owner")
    .maybeSingle();
  // No owner member yet: the key is saved and the next "join" makes them the owner.
  if (data) await writeMemberId(room.code, (data as { id: string }).id);

  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true };
}

/** Rooms made before roles existed have no owner: the first member to claim becomes it. */
export async function claimOwnership(roomCode: string): Promise<ActionState> {
  const room = await getRoomByCode(roomCode);
  const access = room && (await getAccess(room));
  if (!room || !access) return { error: NOT_JOINED };
  if (room.owner_key_hash) return { error: "This room already has an owner." };

  const key = generateOwnerKey();
  const supabase = getSupabase();
  // `is null` guard: two simultaneous claims can't both win.
  const { data } = await supabase
    .from("rooms")
    .update({ owner_key_hash: hashKey(key) })
    .eq("id", room.id)
    .is("owner_key_hash", null)
    .select("id");
  if (!data?.length) return { error: "This room already has an owner." };

  await supabase.from("room_members").update({ role: "owner" }).eq("id", access.member.id);
  await writeOwnerKey(room.code, key);
  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true };
}

/** Owner only: make a member a collaborator (can edit) or a viewer (read only). */
export async function setMemberRole(
  roomCode: string,
  memberId: string,
  role: "collaborator" | "viewer",
): Promise<ActionState> {
  if (role !== "collaborator" && role !== "viewer") return { error: "Invalid role." };
  const room = await getRoomByCode(roomCode);
  const access = room && (await getAccess(room));
  if (!room || !access) return { error: NOT_JOINED };
  if (!access.isOwner) return { error: "Only the owner can change roles." };
  if (!isUuid(memberId)) return { error: "Could not find that member." };

  const { data, error } = await getSupabase()
    .from("room_members")
    .update({ role })
    .eq("id", memberId)
    .eq("room_id", room.id)
    .neq("role", "owner") // the owner's role can't be changed here
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Could not change that member." };

  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

const addMediaSchema = z.object({
  room_code: z.string().min(1),
  media_type: z.enum(["tv", "book"]),
  external_id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(300),
  cover_url: z
    .string()
    .url()
    .refine((u) => (ALLOWED_COVER_HOSTS as readonly string[]).includes(new URL(u).hostname), {
      message: "Unsupported cover host.",
    })
    .nullable(),
  total_pages: z.number().int().min(1).max(10000).nullable(),
  creator: z.string().trim().max(200).nullable(),
  year: z.number().int().min(1).max(3000).nullable(),
  shelf_id: z.string().uuid(),
});

export async function addMedia(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addMediaSchema.safeParse({
    room_code: formData.get("room_code"),
    media_type: formData.get("media_type"),
    external_id: formData.get("external_id"),
    title: formData.get("title"),
    cover_url: formData.get("cover_url") || null,
    total_pages: formData.get("total_pages") ? Number(formData.get("total_pages")) : null,
    creator: String(formData.get("creator") ?? "").trim() || null,
    year: formData.get("year") ? Number(formData.get("year")) : null,
    shelf_id: formData.get("shelf_id"),
  });
  if (!parsed.success) {
    const pagesBad = parsed.error.issues.some((i) => i.path[0] === "total_pages");
    return { error: pagesBad ? "Pages must be a whole number from 1 to 10000." : "That result looks invalid. Try another." };
  }
  const input = parsed.data;

  const room = await getRoomByCode(input.room_code);
  if (!room) return { error: "This room no longer exists." };
  const access = await getAccess(room);
  if (!access) return { error: NOT_JOINED };
  if (!access.canEdit) return { error: NOT_ALLOWED };

  const shelf = await getShelf(room, input.shelf_id);
  if (!shelf) return { error: "That shelf no longer exists." };
  if (shelf.kind !== input.media_type) {
    return { error: `"${shelf.name}" is a ${shelf.kind === "book" ? "book" : "show"} shelf.` };
  }

  // Total units come from the server, never from the form: books are a
  // percentage, TV asks TMDB once for the episode count (CLAUDE.md §4).
  // Books: pages when the adder knows them, otherwise a 0-100 percentage.
  let totalUnits = 100;
  const totalPages = input.media_type === "book" ? input.total_pages : null;
  if (totalPages) totalUnits = totalPages;
  let creator = input.creator;
  let year = input.year;
  let description: string | null = null;
  let genres: string | null = null;

  if (input.media_type === "tv") {
    try {
      const tv = await getTvDetails(input.external_id);
      totalUnits = tv.episodes;
      creator = tv.creator ?? creator;
      year = tv.year ?? year;
      description = tv.description;
      genres = tv.genres;
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not look up that show." };
    }
    if (totalUnits < 1) return { error: "TMDB has no episode count for this show yet." };
  } else {
    const book = await getBookDetails(input.external_id);
    ({ description, genres } = book);
    creator = creator ?? book.creator;
    year = year ?? book.year;
  }

  const { error } = await getSupabase().from("room_media").insert({
    room_id: room.id,
    media_type: input.media_type,
    external_id: input.external_id,
    title: input.title,
    cover_url: input.cover_url,
    total_units: totalUnits,
    total_pages: totalPages,
    creator,
    year,
    description,
    genres,
    shelf_id: shelf.id,
    added_by: access.member.id,
  });
  if (error?.code === DUPLICATE) return { error: "That one is already in this room." };
  if (error) return { error: error.message };

  revalidatePath(`/room/${room.code}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export interface ProgressResult {
  error?: string;
  /** The saved unit (clamped to the valid range). */
  unit?: number;
  /** Other members' notes that this change newly unlocked. */
  unlocked?: number;
}

const progressSchema = z.object({
  room_code: z.string().min(1),
  media_id: z.string().uuid(),
  unit: z.number().int().min(0),
});

export async function updateProgress(
  roomCode: string,
  mediaId: string,
  unit: number,
): Promise<ProgressResult> {
  const parsed = progressSchema.safeParse({ room_code: roomCode, media_id: mediaId, unit });
  if (!parsed.success) return { error: "Invalid progress." };

  const room = await getRoomByCode(parsed.data.room_code);
  const member = room && (await getCurrentMember(room));
  if (!room || !member) return { error: NOT_JOINED };

  const media = await getMedia(room, parsed.data.media_id);
  if (!media) return { error: "Media not found." };

  const next = Math.min(parsed.data.unit, media.total_units);
  const previous = await getMyUnit(member.id, media.id);

  const supabase = getSupabase();
  const { error } = await supabase.from("member_progress").upsert(
    { member_id: member.id, media_id: media.id, current_unit: next, updated_at: new Date().toISOString() },
    { onConflict: "member_id,media_id" },
  );
  if (error) return { error: error.message };

  let unlocked = 0;
  if (next > previous) {
    const { count } = await supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("media_id", media.id)
      .neq("member_id", member.id)
      .neq("tag", "review") // reviews are never locked, so they never "unlock"
      .gt("anchor_unit", previous)
      .lte("anchor_unit", next);
    unlocked = count ?? 0;
  }

  revalidatePath(`/room/${room.code}`, "layout");
  return { unit: next, unlocked };
}

// ---------------------------------------------------------------------------
// Notes (CLAUDE.md §6A) — anchor and author are derived server-side
// ---------------------------------------------------------------------------

const noteSchema = z.object({
  room_code: z.string().min(1),
  media_id: z.string().uuid(),
  title: z.string().trim().min(1, "Give your entry a title.").max(80, "Keep the title under 80 characters."),
  tag: z.enum(["note", "theory", "question", "review"]),
  content: z.string().trim().min(1, "Write something first.").max(2000),
  chapter: z.string().trim().max(40).optional(),
});

export async function addNote(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = noteSchema.safeParse({
    room_code: formData.get("room_code"),
    media_id: formData.get("media_id"),
    title: formData.get("title"),
    tag: formData.get("tag") ?? "note",
    content: formData.get("content"),
    chapter: formData.get("chapter") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid note." };
  const input = parsed.data;

  const room = await getRoomByCode(input.room_code);
  const access = room && (await getAccess(room));
  if (!room || !access) return { error: NOT_JOINED };
  if (!access.canEdit) return { error: NOT_ALLOWED };
  const member = access.member;

  const media = await getMedia(room, input.media_id);
  if (!media) return { error: "Media not found." };
  if (!canEditMedia(access, media)) {
    return { error: "Only who added this, or the owner, can write entries. You can comment on highlights and reply." };
  }

  // Anchor to where the author actually is — a client can't post "from the future".
  const anchorUnit = await getMyUnit(member.id, media.id);

  const { error } = await getSupabase().from("notes").insert({
    room_id: room.id,
    media_id: media.id,
    member_id: member.id,
    author_name: member.nickname,
    anchor_unit: anchorUnit,
    anchor_label: formatUnitLabel(
      media.media_type,
      anchorUnit,
      media.media_type === "book" ? input.chapter : undefined,
      media.total_pages != null,
    ),
    title: input.title,
    tag: input.tag,
    content: input.content,
  });
  if (error) return { error: error.message };

  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Highlight comments — flat comments on a selected range of an unlocked note
// ---------------------------------------------------------------------------

const highlightSchema = z.object({
  room_code: z.string().min(1),
  note_id: z.string().uuid(),
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  comment: z.string().trim().min(1, "Write a comment first.").max(500),
});

const MAX_QUOTE = 600;

export async function addHighlight(input: {
  roomCode: string;
  noteId: string;
  start: number;
  end: number;
  comment: string;
}): Promise<ActionState> {
  const parsed = highlightSchema.safeParse({
    room_code: input.roomCode,
    note_id: input.noteId,
    start: input.start,
    end: input.end,
    comment: input.comment,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid highlight." };
  const { note_id, start, end, comment } = parsed.data;

  const room = await getRoomByCode(parsed.data.room_code);
  const member = room && (await getCurrentMember(room)); // every member may comment
  if (!room || !member) return { error: NOT_JOINED };

  const supabase = getSupabase();
  const { data } = await supabase
    .from("notes")
    .select()
    .eq("id", note_id)
    .eq("room_id", room.id)
    .maybeSingle();
  const note = data as Note | null;
  if (!note) return { error: "Entry not found." };

  // Same Fog-of-War rule as reading: you can't comment on what you can't see.
  if (!isNoteUnlocked(note, await getMyUnit(member.id, note.media_id))) {
    return { error: "That entry is still locked for you." };
  }

  if (end <= start || end > note.content.length || end - start > MAX_QUOTE) {
    return { error: "Select a shorter passage and try again." };
  }
  const quote = note.content.slice(start, end);
  if (!quote.trim()) return { error: "Select some text first." };

  const { error } = await supabase.from("note_highlights").insert({
    note_id: note.id,
    member_id: member.id,
    author_name: member.nickname,
    start_offset: start,
    end_offset: end,
    quote,
    comment,
  });
  if (error) return { error: error.message };

  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Replies — flat, one level, under an entry or a highlight comment
// ---------------------------------------------------------------------------

const replySchema = z.object({
  room_code: z.string().min(1),
  note_id: z.string().uuid(),
  highlight_id: z.string().uuid().nullable(),
  content: z.string().trim().min(1, "Write a reply first.").max(500, "Keep replies under 500 characters."),
});

export async function addReply(input: {
  roomCode: string;
  noteId: string;
  highlightId: string | null;
  content: string;
}): Promise<ActionState> {
  const parsed = replySchema.safeParse({
    room_code: input.roomCode,
    note_id: input.noteId,
    highlight_id: input.highlightId,
    content: input.content,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid reply." };
  const { note_id, highlight_id, content } = parsed.data;

  const room = await getRoomByCode(parsed.data.room_code);
  const member = room && (await getCurrentMember(room)); // every member may reply
  if (!room || !member) return { error: NOT_JOINED };

  const supabase = getSupabase();
  const { data } = await supabase.from("notes").select().eq("id", note_id).eq("room_id", room.id).maybeSingle();
  const note = data as Note | null;
  if (!note) return { error: "Entry not found." };
  if (!isNoteUnlocked(note, await getMyUnit(member.id, note.media_id))) {
    return { error: "That entry is still locked for you." };
  }

  if (highlight_id) {
    const { data: hl } = await supabase
      .from("note_highlights")
      .select("id")
      .eq("id", highlight_id)
      .eq("note_id", note.id)
      .maybeSingle();
    if (!hl) return { error: "That comment no longer exists." };
  }

  const { error } = await supabase.from("note_replies").insert({
    note_id: note.id,
    highlight_id,
    member_id: member.id,
    author_name: member.nickname,
    content,
  });
  if (error) {
    return {
      error: error.message.includes("note_replies")
        ? "Replies need a database update. Re-run supabase/schema.sql."
        : error.message,
    };
  }

  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Book pages — total pages is the "end"; the percentage is derived from it
// ---------------------------------------------------------------------------

const pagesSchema = z.object({
  room_code: z.string().min(1),
  media_id: z.string().uuid(),
  pages: z.number().int().min(1, "Enter at least 1 page.").max(10000, "Max 10000 pages."),
});

/** Set or correct a book's page count. Existing progress and notes are rescaled in SQL. */
export async function setBookPages(
  roomCode: string,
  mediaId: string,
  pages: number,
): Promise<ActionState> {
  const parsed = pagesSchema.safeParse({ room_code: roomCode, media_id: mediaId, pages });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid page count." };

  const room = await getRoomByCode(parsed.data.room_code);
  const access = room && (await getAccess(room));
  if (!room || !access) return { error: NOT_JOINED };
  if (!access.canEdit) return { error: NOT_ALLOWED };

  const media = await getMedia(room, parsed.data.media_id);
  if (!media || media.media_type !== "book") return { error: "Book not found." };
  if (!canEditMedia(access, media)) return { error: "Only who added this book, or the owner, can change it." };

  const { error } = await getSupabase().rpc("set_book_pages", {
    p_media_id: media.id,
    p_pages: parsed.data.pages,
  });
  if (error) {
    return {
      error: error.message.includes("set_book_pages")
        ? "Database is missing set_book_pages. Re-run supabase/schema.sql."
        : error.message,
    };
  }

  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Manual add — for anything the APIs don't know. Optional cover upload.
// ---------------------------------------------------------------------------

const MAX_COVER_BYTES = 1024 * 1024; // matches the bucket limit; the browser shrinks images first
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(min).max(max).optional(),
  );

const manualSchema = z.object({
  room_code: z.string().min(1),
  media_type: z.enum(["tv", "book"]),
  title: z.string().trim().min(1, "Enter a title.").max(200, "Keep the title under 200 characters."),
  creator: z.string().trim().max(200).optional(),
  year: optionalInt(1, 3000),
  genres: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000, "Keep the description under 2000 characters.").optional(),
  pages: optionalInt(1, 10000),
  episodes: optionalInt(1, 5000),
  shelf_id: z.string().uuid(),
});

export async function addManualMedia(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = manualSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const input = parsed.data;
  if (input.media_type === "tv" && !input.episodes) {
    return { error: "Enter how many episodes it has." };
  }

  const room = await getRoomByCode(input.room_code);
  if (!room) return { error: "This room no longer exists." };
  const access = await getAccess(room);
  if (!access) return { error: NOT_JOINED };
  if (!access.canEdit) return { error: NOT_ALLOWED };

  const shelf = await getShelf(room, input.shelf_id);
  if (!shelf) return { error: "That shelf no longer exists." };
  if (shelf.kind !== input.media_type) {
    return { error: `"${shelf.name}" is a ${shelf.kind === "book" ? "book" : "show"} shelf.` };
  }

  const supabase = getSupabase();

  let coverUrl: string | null = null;
  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    if (!COVER_TYPES.includes(cover.type)) return { error: "Cover must be a JPG, PNG or WebP image." };
    if (cover.size > MAX_COVER_BYTES) return { error: "Cover is too big (max 1 MB)." };

    const ext = cover.type === "image/png" ? "png" : cover.type === "image/webp" ? "webp" : "jpg";
    const path = `${room.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(path, cover, { contentType: cover.type });
    if (uploadError) {
      return {
        error: uploadError.message.toLowerCase().includes("bucket")
          ? "Cover storage is missing. Re-run supabase/schema.sql."
          : uploadError.message,
      };
    }
    coverUrl = supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
  }

  const isBook = input.media_type === "book";
  const { error } = await supabase.from("room_media").insert({
    room_id: room.id,
    media_type: input.media_type,
    external_id: `manual:${crypto.randomUUID()}`,
    title: input.title,
    cover_url: coverUrl,
    total_units: isBook ? (input.pages ?? 100) : input.episodes,
    total_pages: isBook ? (input.pages ?? null) : null,
    creator: input.creator || null,
    year: input.year ?? null,
    genres: input.genres || null,
    description: input.description || null,
    shelf_id: shelf.id,
    added_by: access.member.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/room/${room.code}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Shelves — named by members. A shelf holds one kind of media (that sets its theme).
// ---------------------------------------------------------------------------

const shelfNameSchema = z
  .string()
  .trim()
  .min(1, "Give the shelf a name.")
  .max(40, "Keep the name under 40 characters.");

/** The room, when the caller is its owner or a collaborator. */
async function requireEditor(roomCode: string) {
  const room = await getRoomByCode(roomCode);
  const access = room && (await getAccess(room));
  return room && access?.canEdit ? room : null;
}

export async function createShelf(
  roomCode: string,
  name: string,
  kind: "book" | "tv",
): Promise<ActionState> {
  const parsedName = shelfNameSchema.safeParse(name);
  if (!parsedName.success) return { error: parsedName.error.issues[0]?.message ?? "Invalid name." };
  if (kind !== "book" && kind !== "tv") return { error: "Pick books or shows." };

  const room = await requireEditor(roomCode);
  if (!room) return { error: NOT_ALLOWED };

  const supabase = getSupabase();
  const { data: last } = await supabase
    .from("shelves")
    .select("position")
    .eq("room_id", room.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("shelves")
    .insert({ room_id: room.id, name: parsedName.data, kind, position: ((last as { position: number } | null)?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error?.code === DUPLICATE) return { error: "You already have a shelf with that name." };
  if (error || !data) return { error: error?.message ?? "Could not create the shelf." };

  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true, id: data.id };
}

export async function renameShelf(roomCode: string, shelfId: string, name: string): Promise<ActionState> {
  const parsedName = shelfNameSchema.safeParse(name);
  if (!parsedName.success) return { error: parsedName.error.issues[0]?.message ?? "Invalid name." };

  const room = await requireEditor(roomCode);
  if (!room) return { error: NOT_ALLOWED };
  const shelf = await getShelf(room, shelfId);
  if (!shelf) return { error: "Shelf not found." };

  const { error } = await getSupabase().from("shelves").update({ name: parsedName.data }).eq("id", shelf.id);
  if (error?.code === DUPLICATE) return { error: "You already have a shelf with that name." };
  if (error) return { error: error.message };

  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true };
}

/** Only an empty shelf can be removed, and a room always keeps at least one shelf. */
export async function deleteShelf(roomCode: string, shelfId: string): Promise<ActionState> {
  const room = await requireEditor(roomCode);
  if (!room) return { error: NOT_ALLOWED };
  const shelf = await getShelf(room, shelfId);
  if (!shelf) return { error: "Shelf not found." };

  const supabase = getSupabase();
  const [{ count: items }, { count: shelves }] = await Promise.all([
    supabase.from("room_media").select("id", { count: "exact", head: true }).eq("shelf_id", shelf.id),
    supabase.from("shelves").select("id", { count: "exact", head: true }).eq("room_id", room.id),
  ]);
  if ((items ?? 0) > 0) return { error: "Move its books and shows to another shelf first." };
  if ((shelves ?? 0) <= 1) return { error: "A room needs at least one shelf." };

  const { error } = await supabase.from("shelves").delete().eq("id", shelf.id);
  if (error) return { error: error.message };

  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true };
}

/** Move an item to another shelf of the same kind. */
export async function moveMedia(roomCode: string, mediaId: string, shelfId: string): Promise<ActionState> {
  const room = await getRoomByCode(roomCode);
  const access = room && (await getAccess(room));
  if (!room || !access?.canEdit) return { error: NOT_ALLOWED };
  const media = await getMedia(room, mediaId);
  const shelf = await getShelf(room, shelfId);
  if (!media || !shelf) return { error: "Not found." };
  if (!canEditMedia(access, media)) return { error: "Only who added this, or the owner, can move it." };
  if (shelf.kind !== media.media_type) return { error: "That shelf is for a different kind of media." };

  const { error } = await getSupabase().from("room_media").update({ shelf_id: shelf.id }).eq("id", media.id);
  if (error) return { error: error.message };

  revalidatePath(`/room/${room.code}`, "layout");
  return { ok: true };
}
