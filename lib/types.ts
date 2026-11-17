/**
 * Shared TypeScript interfaces for Scenara.
 * Each interface mirrors one table from `supabase/schema.sql` (see GEMINI.md §5).
 * Keep this file the single source of truth for shapes crossing the server/client boundary.
 */

/** v1 supports exactly two mediums: TV series and books. */
export type MediaType = "tv" | "book";

/** Lightweight note tags — no complex post types in v1. */
export type NoteTag = "note" | "theory" | "question" | "review";

/** rooms */
export interface Room {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

/** room_members — nickname-based identity, no auth in v1. */
export interface RoomMember {
  id: string;
  room_id: string;
  nickname: string;
  created_at: string;
}

/** room_media — search metadata is copied here once, when the medium is added. */
export interface RoomMedia {
  id: string;
  room_id: string;
  media_type: MediaType;
  external_id: string;
  title: string;
  cover_url: string | null;
  /** Episodes for TV; pages for a book with `total_pages`; otherwise 100 (percent). */
  total_units: number;
  /** Set when the book's progress is tracked in pages. */
  total_pages: number | null;
  /** Author (book) or creator (TV). Saved once at add time, with the fields below. */
  creator: string | null;
  description: string | null;
  year: number | null;
  /** Comma-separated genres/subjects. */
  genres: string | null;
  created_at: string;
}

/** member_progress — one row per (member, media). */
export interface MemberProgress {
  id: string;
  member_id: string;
  media_id: string;
  /** Episode index (1..total_units) for TV, percent (0..100) for books. 0 = not started. */
  current_unit: number;
  updated_at: string;
}

/** notes — gated by `anchor_unit` using the Fog of War rule. */
export interface Note {
  id: string;
  room_id: string;
  media_id: string;
  member_id: string;
  author_name: string;
  anchor_unit: number;
  anchor_label: string;
  /** Entry title; null for entries written before titles existed. */
  title: string | null;
  tag: NoteTag;
  content: string;
  created_at: string;
}

/** note_highlights — a comment attached to a selected range of a note. */
export interface Highlight {
  id: string;
  note_id: string;
  member_id: string;
  author_name: string;
  start_offset: number;
  end_offset: number;
  quote: string;
  comment: string;
  created_at: string;
}

/**
 * The subset of a note the card UI needs. Also handy for demo/seed data.
 * `content` and `title` are `null` when the note is locked: the server strips
 * them before serialization, so spoilers never reach the browser (GEMINI.md §4).
 */
export type NoteCardData = Pick<
  Note,
  "author_name" | "anchor_unit" | "anchor_label" | "tag"
> & { content: string | null; title: string | null };

/** A note as returned to the UI for one viewer, with its lock state resolved. */
export interface FeedNote extends NoteCardData {
  id: string;
  created_at: string;
  isUnlocked: boolean;
}

/** The Fog of War rule, in one place. See GEMINI.md §6A. */
export function isNoteUnlocked(note: { anchor_unit: number }, myCurrentUnit: number): boolean {
  return note.anchor_unit <= myCurrentUnit;
}

/**
 * Human label for a progress unit: "Ep 4" (TV), "p. 120" (book in pages),
 * "42%" (book in percent), "Start" at 0 for TV. Books may append a free-text
 * chapter label, e.g. "p. 120 · Ch. 8" (GEMINI.md §2).
 */
export function formatUnitLabel(
  mediaType: MediaType,
  unit: number,
  extra?: string,
  pages = false,
): string {
  const base =
    mediaType === "book" ? (pages ? `p. ${unit}` : `${unit}%`) : unit === 0 ? "Start" : `Ep ${unit}`;
  const suffix = extra?.trim();
  return suffix ? `${base} · ${suffix}` : base;
}

/** Same as formatUnitLabel, reading the unit mode from a media row. */
export function formatMediaUnit(
  media: Pick<RoomMedia, "media_type" | "total_pages">,
  unit: number,
  extra?: string,
): string {
  return formatUnitLabel(media.media_type, unit, extra, media.total_pages != null);
}

/** Cover hosts we accept when saving media (GEMINI.md §4). */
export const ALLOWED_COVER_HOSTS = ["image.tmdb.org", "covers.openlibrary.org"] as const;

/** A normalized search hit from Open Library or TMDB (see lib/media-api.ts). */
export interface MediaSearchResult {
  mediaType: MediaType;
  externalId: string;
  title: string;
  coverUrl: string | null;
  /** Author(s) for books, first-air year for TV. */
  subtitle: string | null;
  /**
   * Episode count for TV, 100 for books.
   * `null` when unknown — TMDB search does not return episode counts,
   * so it is resolved server-side when the show is added (see getTvEpisodeCount).
   */
  totalUnits: number | null;
  /** Page count when Open Library knows it (books only). */
  totalPages: number | null;
  creator: string | null;
  year: number | null;
}
