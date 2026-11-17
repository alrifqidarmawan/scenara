"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentMember, getMedia, getMyUnit, getRoomByCode, isUuid } from "./data";
import { getBookDetails, getTvDetails } from "./media-api";
import { writeMemberId } from "./session";
import { SETUP_HINT, getSupabase, isSupabaseConfigured } from "./supabase-server";
import { ALLOWED_COVER_HOSTS, formatUnitLabel, isNoteUnlocked, type Note } from "./types";

/** What every Server Action in Scenara returns to the form that called it. */
export interface ActionState {
  error?: string;
  ok?: boolean;
}

const DUPLICATE = "23505";
const NOT_JOINED = "Join the room first.";

// ---------------------------------------------------------------------------
// Create Room (GEMINI.md §6C)
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
    const { data, error } = await supabase
      .from("rooms")
      .insert({ code, name: parsed.data.name })
      .select("code")
      .single();

    if (!error && data) {
      redirect(`/room/${data.code}`);
    }
    if (error?.code !== DUPLICATE) {
      return { error: error?.message ?? "Could not create the room." };
    }
  }

  return { error: "Could not get a unique room code — please try again." };
}

// ---------------------------------------------------------------------------
// Identity (GEMINI.md §6B)
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

  const { data, error } = await getSupabase()
    .from("room_members")
    .insert({ room_id: room.id, nickname: parsed.data.nickname })
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
    .select("id")
    .eq("id", memberId)
    .eq("room_id", room.id)
    .maybeSingle();
  if (!data) return { error: "Could not find that member." };

  await writeMemberId(room.code, memberId);
  revalidatePath(`/room/${room.code}`);
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
  });
  if (!parsed.success) {
    const pagesBad = parsed.error.issues.some((i) => i.path[0] === "total_pages");
    return { error: pagesBad ? "Pages must be a whole number from 1 to 10000." : "That result looks invalid. Try another." };
  }
  const input = parsed.data;

  const room = await getRoomByCode(input.room_code);
  if (!room) return { error: "This room no longer exists." };
  if (!(await getCurrentMember(room))) return { error: NOT_JOINED };

  // Total units come from the server, never from the form: books are a
  // percentage, TV asks TMDB once for the episode count (GEMINI.md §4).
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
    ({ description, genres } = await getBookDetails(input.external_id));
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
      .gt("anchor_unit", previous)
      .lte("anchor_unit", next);
    unlocked = count ?? 0;
  }

  revalidatePath(`/room/${room.code}`, "layout");
  return { unit: next, unlocked };
}

// ---------------------------------------------------------------------------
// Notes (GEMINI.md §6A) — anchor and author are derived server-side
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
  const member = room && (await getCurrentMember(room));
  if (!room || !member) return { error: NOT_JOINED };

  const media = await getMedia(room, input.media_id);
  if (!media) return { error: "Media not found." };

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
  const member = room && (await getCurrentMember(room));
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
  const member = room && (await getCurrentMember(room));
  if (!room || !member) return { error: NOT_JOINED };

  const media = await getMedia(room, parsed.data.media_id);
  if (!media || media.media_type !== "book") return { error: "Book not found." };

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
  if (!(await getCurrentMember(room))) return { error: NOT_JOINED };

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
  });
  if (error) return { error: error.message };

  revalidatePath(`/room/${room.code}`);
  return { ok: true };
}
