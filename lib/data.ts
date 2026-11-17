import "server-only";
import { z } from "zod";
import { getSupabase } from "./supabase-server";
import { readMemberId } from "./session";
import {
  isNoteUnlocked,
  type FeedNote,
  type Highlight,
  type MemberProgress,
  type Note,
  type Room,
  type RoomMedia,
  type RoomMember,
  type Shelf,
} from "./types";

/** Server-only reads. Every function here assumes it runs on the server. */

const uuid = z.string().uuid();
export const isUuid = (value: string) => uuid.safeParse(value).success;

export async function getRoomByCode(code: string): Promise<Room | null> {
  if (!/^[a-z0-9]{4,16}$/.test(code)) return null;
  const { data } = await getSupabase().from("rooms").select().eq("code", code).maybeSingle();
  return (data as Room | null) ?? null;
}

export async function getMembers(roomId: string): Promise<RoomMember[]> {
  const { data } = await getSupabase()
    .from("room_members")
    .select()
    .eq("room_id", roomId)
    .order("created_at");
  return (data as RoomMember[]) ?? [];
}

/** The member identified by this room's cookie, or null if missing/stale. */
export async function getCurrentMember(room: Room): Promise<RoomMember | null> {
  const memberId = await readMemberId(room.code);
  if (!memberId || !isUuid(memberId)) return null;
  const { data } = await getSupabase()
    .from("room_members")
    .select()
    .eq("id", memberId)
    .eq("room_id", room.id)
    .maybeSingle();
  return (data as RoomMember | null) ?? null;
}

export interface RoomOverview {
  shelves: Shelf[];
  media: RoomMedia[];
  members: RoomMember[];
  /** media_id -> (member_id -> current_unit) */
  progress: Record<string, Record<string, number>>;
}

export async function getRoomOverview(room: Room): Promise<RoomOverview> {
  const supabase = getSupabase();
  const [mediaRes, members] = await Promise.all([
    supabase.from("room_media").select().eq("room_id", room.id).order("created_at"),
    getMembers(room.id),
  ]);
  const rawMedia = (mediaRes.data as RoomMedia[]) ?? [];
  const { shelves, media } = await ensureShelves(room, rawMedia);

  const progress: RoomOverview["progress"] = {};
  if (media.length > 0) {
    const { data } = await supabase
      .from("member_progress")
      .select()
      .in("media_id", media.map((m) => m.id));
    for (const row of (data as MemberProgress[]) ?? []) {
      (progress[row.media_id] ??= {})[row.member_id] = row.current_unit;
    }
  }
  return { shelves, media, members, progress };
}

export async function getMedia(room: Room, mediaId: string): Promise<RoomMedia | null> {
  if (!isUuid(mediaId)) return null;
  const { data } = await getSupabase()
    .from("room_media")
    .select()
    .eq("id", mediaId)
    .eq("room_id", room.id)
    .maybeSingle();
  return (data as RoomMedia | null) ?? null;
}

export async function getMyUnit(memberId: string, mediaId: string): Promise<number> {
  const { data } = await getSupabase()
    .from("member_progress")
    .select("current_unit")
    .eq("member_id", memberId)
    .eq("media_id", mediaId)
    .maybeSingle();
  return (data as { current_unit: number } | null)?.current_unit ?? 0;
}

/**
 * The notes feed for one viewer. Locked notes have `content` replaced with
 * `null` HERE, on the server, so future spoilers are never serialized to the client.
 */
export async function getFeed(mediaId: string, myUnit: number): Promise<FeedNote[]> {
  const { data } = await getSupabase()
    .from("notes")
    .select()
    .eq("media_id", mediaId)
    .order("anchor_unit", { ascending: false })
    .order("created_at", { ascending: false });

  return ((data as Note[]) ?? []).map((n) => {
    const isUnlocked = isNoteUnlocked(n, myUnit);
    return {
      id: n.id,
      created_at: n.created_at,
      author_name: n.author_name,
      anchor_unit: n.anchor_unit,
      anchor_label: n.anchor_label,
      tag: n.tag,
      // Titles can spoil too ("The reveal"), so they are stripped while locked.
      title: isUnlocked ? n.title : null,
      content: isUnlocked ? n.content : null,
      isUnlocked,
    };
  });
}

/**
 * Highlight comments for the given notes. Callers pass only UNLOCKED note ids,
 * so comments on locked notes (which quote the hidden text) are never sent.
 */
export async function getHighlights(unlockedNoteIds: string[]): Promise<Highlight[]> {
  if (unlockedNoteIds.length === 0) return [];
  const { data } = await getSupabase()
    .from("note_highlights")
    .select()
    .in("note_id", unlockedNoteIds)
    .order("start_offset");
  return (data as Highlight[]) ?? [];
}

const DEFAULT_SHELF_NAME = { book: "Books", tv: "Shows" } as const;

export async function getShelf(room: Room, shelfId: string): Promise<Shelf | null> {
  if (!isUuid(shelfId)) return null;
  const { data } = await getSupabase()
    .from("shelves")
    .select()
    .eq("id", shelfId)
    .eq("room_id", room.id)
    .maybeSingle();
  return (data as Shelf | null) ?? null;
}

async function listShelves(roomId: string): Promise<Shelf[]> {
  const { data } = await getSupabase()
    .from("shelves")
    .select()
    .eq("room_id", roomId)
    .order("position")
    .order("created_at");
  return (data as Shelf[]) ?? [];
}

/**
 * Inserts a shelf, treating "name already taken" as success: when two requests load a
 * brand-new room at the same moment, both try to create the defaults and the unique
 * index makes the loser a harmless no-op.
 */
async function insertShelfIgnoringDuplicate(room: Room, name: string, kind: "book" | "tv", position: number) {
  await getSupabase().from("shelves").insert({ room_id: room.id, name, kind, position });
}

/**
 * Makes sure the room has shelves and that every item stands on one. Runs lazily on
 * room load: new rooms get "Books" and "Shows", and media added before shelves existed
 * is moved onto the first shelf of its kind. A no-op once everything is in place.
 * Safe under concurrent loads: it never creates a shelf without re-reading first.
 */
async function ensureShelves(
  room: Room,
  media: RoomMedia[],
): Promise<{ shelves: Shelf[]; media: RoomMedia[] }> {
  const supabase = getSupabase();
  let shelves = await listShelves(room.id);

  if (shelves.length === 0) {
    await insertShelfIgnoringDuplicate(room, DEFAULT_SHELF_NAME.book, "book", 0);
    await insertShelfIgnoringDuplicate(room, DEFAULT_SHELF_NAME.tv, "tv", 1);
    shelves = await listShelves(room.id);
  }

  const orphans = media.filter((m) => !m.shelf_id || !shelves.some((s) => s.id === m.shelf_id));
  if (orphans.length === 0) return { shelves, media };

  const assigned = new Map<string, string>();
  for (const kind of ["book", "tv"] as const) {
    const items = orphans.filter((m) => m.media_type === kind);
    if (items.length === 0) continue;

    let target = shelves.find((s) => s.kind === kind);
    if (!target) {
      // Re-read first (another request may just have created it), then create one.
      shelves = await listShelves(room.id);
      target = shelves.find((s) => s.kind === kind);
    }
    for (let n = 1; !target && n <= 3; n++) {
      await insertShelfIgnoringDuplicate(room, n === 1 ? DEFAULT_SHELF_NAME[kind] : `${DEFAULT_SHELF_NAME[kind]} ${n}`, kind, shelves.length);
      shelves = await listShelves(room.id);
      target = shelves.find((s) => s.kind === kind);
    }
    if (!target) continue;

    await supabase.from("room_media").update({ shelf_id: target.id }).in("id", items.map((m) => m.id));
    for (const m of items) assigned.set(m.id, target.id);
  }

  return {
    shelves,
    media: media.map((m) => (assigned.has(m.id) ? { ...m, shelf_id: assigned.get(m.id) as string } : m)),
  };
}
