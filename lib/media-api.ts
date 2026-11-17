import type { MediaSearchResult } from "./types";

/**
 * Normalized search helpers for the two external APIs (GEMINI.md §3).
 * Everything here runs server-side only — TMDB_API_KEY must never reach the browser.
 *
 * Results are normalized into `MediaSearchResult` so the UI never has to care
 * which API it is looking at. Selected media is copied into `room_media` once
 * at add-time; these helpers are NOT called on room page loads.
 */

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/tv";
const TMDB_SERIES_URL = "https://api.themoviedb.org/3/tv";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342";

const SEARCH_LIMIT = 12;

function requireTmdbKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error("TMDB_API_KEY is not set. Add it to .env.local to search for TV series.");
  }
  return key;
}

/** Search Open Library for books. No API key required. */
export async function searchBooks(query: string): Promise<MediaSearchResult[]> {
  const url = new URL(OPEN_LIBRARY_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(SEARCH_LIMIT));
  url.searchParams.set("fields", "key,title,author_name,cover_i,number_of_pages_median,first_publish_year");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open Library responded with ${res.status}.`);
  }

  const data = (await res.json()) as {
    docs?: Array<{
      key?: string;
      title?: string;
      author_name?: string[];
      cover_i?: number;
      number_of_pages_median?: number;
      first_publish_year?: number;
    }>;
  };

  return (data.docs ?? [])
    .filter((doc) => Boolean(doc.key))
    .map((doc) => ({
      mediaType: "book" as const,
      externalId: doc.key as string,
      title: doc.title ?? "Untitled",
      coverUrl: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      subtitle: doc.author_name?.slice(0, 2).join(", ") ?? null,
      totalUnits: 100, // percent unless the user supplies a page count when adding
      totalPages: doc.number_of_pages_median ?? null,
      creator: doc.author_name?.slice(0, 3).join(", ") ?? null,
      year: doc.first_publish_year ?? null,
    }));
}

/** Search TMDB for TV series. Requires TMDB_API_KEY. */
export async function searchTvSeries(query: string): Promise<MediaSearchResult[]> {
  const url = new URL(TMDB_SEARCH_URL);
  url.searchParams.set("api_key", requireTmdbKey());
  url.searchParams.set("query", query);
  url.searchParams.set("include_adult", "false");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB responded with ${res.status}.`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      id?: number;
      name?: string;
      poster_path?: string | null;
      first_air_date?: string;
    }>;
  };

  return (data.results ?? [])
    .filter((item) => Boolean(item.id))
    .slice(0, SEARCH_LIMIT)
    .map((item) => ({
      mediaType: "tv" as const,
      externalId: String(item.id),
      title: item.name ?? "Untitled",
      coverUrl: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : null,
      subtitle: item.first_air_date?.slice(0, 4) ?? null,
      // Unknown from search — resolved when the show is added, see getTvEpisodeCount.
      totalUnits: null,
      totalPages: null,
      creator: null,
      year: item.first_air_date ? Number(item.first_air_date.slice(0, 4)) || null : null,
    }));
}

export interface TvDetails {
  episodes: number;
  description: string | null;
  year: number | null;
  genres: string | null;
  creator: string | null;
}

/**
 * Fetch details for a TMDB series: episode count (the stepper's max) plus the info
 * shown on hover. Called once when a show is added, never on page loads.
 * `episodes` is 0 when TMDB does not report a count.
 */
export async function getTvDetails(externalId: string): Promise<TvDetails> {
  const url = new URL(`${TMDB_SERIES_URL}/${encodeURIComponent(externalId)}`);
  url.searchParams.set("api_key", requireTmdbKey());

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB responded with ${res.status} for series ${externalId}.`);
  }

  const data = (await res.json()) as {
    number_of_episodes?: number;
    overview?: string;
    first_air_date?: string;
    genres?: { name: string }[];
    created_by?: { name: string }[];
  };
  return {
    episodes: data.number_of_episodes ?? 0,
    description: data.overview?.trim() || null,
    year: data.first_air_date ? Number(data.first_air_date.slice(0, 4)) || null : null,
    genres: data.genres?.map((g) => g.name).join(", ") || null,
    creator: data.created_by?.map((c) => c.name).join(", ") || null,
  };
}

/**
 * Best-effort description and subjects for an Open Library work (e.g. "/works/OL45804W").
 * Never throws: details are a bonus and must not block adding a book.
 */
export async function getBookDetails(
  externalId: string,
): Promise<{ description: string | null; genres: string | null }> {
  if (!/^\/works\/OL\d+W$/.test(externalId)) return { description: null, genres: null };
  try {
    const res = await fetch(`https://openlibrary.org${externalId}.json`);
    if (!res.ok) return { description: null, genres: null };
    const data = (await res.json()) as {
      description?: string | { value?: string };
      subjects?: string[];
    };
    const raw = typeof data.description === "string" ? data.description : data.description?.value;
    return {
      // Open Library descriptions often end with source links after a blank line.
      description: raw?.split(/\r?\n\r?\n(?:-{2,}|\[)/)[0].trim().slice(0, 1500) || null,
      genres: data.subjects?.slice(0, 5).join(", ").slice(0, 190) || null,
    };
  } catch {
    return { description: null, genres: null };
  }
}
