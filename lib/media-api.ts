import type { MediaSearchResult } from "./types";

/**
 * Normalized search helpers for the external APIs (CLAUDE.md §3).
 * Everything here runs server-side only — TMDB_API_KEY and GOOGLE_BOOK_API_KEY
 * must never reach the browser.
 *
 * Book search queries Open Library AND Google Books in parallel, then merges and
 * de-duplicates, so one search gives broader coverage than either API alone.
 *
 * Results are normalized into `MediaSearchResult` so the UI never has to care
 * which API it is looking at. Selected media is copied into `room_media` once
 * at add-time; these helpers are NOT called on room page loads.
 */

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";
const TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/tv";
const TMDB_MOVIE_SEARCH_URL = "https://api.themoviedb.org/3/search/movie";
const TMDB_MOVIE_URL = "https://api.themoviedb.org/3/movie";
const TMDB_SERIES_URL = "https://api.themoviedb.org/3/tv";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342";

const SEARCH_LIMIT = 12;
/** Open Library is often slow (4-10s). Never let one source stall a search. */
const SOURCE_TIMEOUT_MS = 6000;
const MAX_BOOK_RESULTS = 16;
const GOOGLE_ID_PREFIX = "gb:";
const GOOGLE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;

function requireTmdbKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error("TMDB_API_KEY is not set. Add it to .env.local to search for TV series.");
  }
  return key;
}

/** Open Library search. No API key required. */
async function searchOpenLibrary(query: string): Promise<MediaSearchResult[]> {
  const url = new URL(OPEN_LIBRARY_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(SEARCH_LIMIT));
  url.searchParams.set("fields", "key,title,author_name,cover_i,number_of_pages_median,first_publish_year");

  const res = await fetch(url, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) });
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
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : null,
      subtitle: doc.author_name?.slice(0, 2).join(", ") ?? null,
      totalUnits: 100, // percent unless the user supplies a page count when adding
      totalPages: doc.number_of_pages_median ?? null,
      sources: ["openlibrary" as const],
      creator: doc.author_name?.slice(0, 3).join(", ") ?? null,
      year: doc.first_publish_year ?? null,
    }));
}

/** Strip the HTML Google Books puts in descriptions (<p>, <br>, <b>, entities). */
function htmlToText(html: string): string {
  return html
    .replace(/<\/?(p|div|li|ul|ol)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Google Books serves http covers with a page-curl effect; use plain https. */
function googleCover(links?: { thumbnail?: string; smallThumbnail?: string }): string | null {
  const raw = links?.thumbnail ?? links?.smallThumbnail;
  if (!raw) return null;
  try {
    const url = new URL(raw.replace(/^http:/, "https:"));
    url.searchParams.delete("edge");
    url.searchParams.set("zoom", "2");
    return url.toString();
  } catch {
    return null;
  }
}

interface GoogleVolumeInfo {
  title?: string;
  authors?: string[];
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  categories?: string[];
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
}

/** Google Books search. Skipped (empty) when GOOGLE_BOOK_API_KEY is not set. */
async function searchGoogleBooks(query: string): Promise<MediaSearchResult[]> {
  const key = process.env.GOOGLE_BOOK_API_KEY;
  if (!key) return [];

  const url = new URL(GOOGLE_BOOKS_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(SEARCH_LIMIT));
  url.searchParams.set("printType", "books");
  url.searchParams.set("fields", "items(id,volumeInfo(title,authors,publishedDate,pageCount,imageLinks))");
  url.searchParams.set("key", key);

  const res = await fetch(url, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) });
  // Never put `url` in the message: it contains the API key.
  if (!res.ok) throw new Error(`Google Books responded with ${res.status}.`);

  const data = (await res.json()) as { items?: Array<{ id?: string; volumeInfo?: GoogleVolumeInfo }> };
  return (data.items ?? [])
    .filter((item) => item.id && item.volumeInfo?.title)
    .map((item) => {
      const info = item.volumeInfo as GoogleVolumeInfo;
      const pages = info.pageCount && info.pageCount > 0 ? info.pageCount : null;
      return {
        mediaType: "book" as const,
        externalId: `${GOOGLE_ID_PREFIX}${item.id}`,
        title: info.title ?? "Untitled",
        coverUrl: googleCover(info.imageLinks),
        subtitle: info.authors?.slice(0, 2).join(", ") ?? null,
        totalUnits: 100,
        totalPages: pages,
        creator: info.authors?.slice(0, 3).join(", ") ?? null,
        year: Number(info.publishedDate?.slice(0, 4)) || null,
        sources: ["google" as const],
      };
    });
}

/** Loose identity for "same book": title before any subtitle + first author's surname. */
function bookKey(book: MediaSearchResult): string {
  const norm = (v: string) => v.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
  const title = norm(book.title.split(/[:(]/)[0]);
  const author = norm((book.creator ?? "").split(",")[0]);
  return `${title}|${author.split(" ").pop() ?? ""}`;
}

/** Combine two records of the same book, keeping the best of each field. */
function mergeBooks(google: MediaSearchResult, openLibrary: MediaSearchResult): MediaSearchResult {
  return {
    ...google, // Google id: richer details (description, categories) at add time
    coverUrl: openLibrary.coverUrl ?? google.coverUrl, // Open Library -L covers are larger
    totalPages: google.totalPages ?? openLibrary.totalPages,
    creator: google.creator ?? openLibrary.creator,
    subtitle: google.subtitle ?? openLibrary.subtitle,
    year: google.year ?? openLibrary.year,
    sources: ["google", "openlibrary"],
  };
}

/** Outcome of a book search: merged results plus which source answered. */
export interface BookSearch {
  results: MediaSearchResult[];
  status: Record<"openlibrary" | "google", "ok" | "failed" | "skipped">;
}

/**
 * Search books on Open Library AND Google Books at the same time.
 * - Books found by both are merged and listed first (strongest match signal).
 * - The rest alternate between the two sources.
 * - If one source fails, the other still answers; only a double failure throws.
 */
export async function searchBooks(query: string): Promise<BookSearch> {
  const googleEnabled = Boolean(process.env.GOOGLE_BOOK_API_KEY);
  const [ol, gb] = await Promise.allSettled([searchOpenLibrary(query), searchGoogleBooks(query)]);

  const status: BookSearch["status"] = {
    openlibrary: ol.status === "fulfilled" ? "ok" : "failed",
    google: !googleEnabled ? "skipped" : gb.status === "fulfilled" ? "ok" : "failed",
  };
  if (ol.status === "rejected" && gb.status === "rejected") {
    throw new Error("Book search is unavailable right now. Try again in a moment.");
  }
  const olList = ol.status === "fulfilled" ? ol.value : [];
  const gbList = gb.status === "fulfilled" ? gb.value : [];

  const olByKey = new Map<string, MediaSearchResult>();
  for (const book of olList) if (!olByKey.has(bookKey(book))) olByKey.set(bookKey(book), book);

  const both: MediaSearchResult[] = [];
  const gbOnly: MediaSearchResult[] = [];
  const seen = new Set<string>();
  for (const book of gbList) {
    const key = bookKey(book);
    if (seen.has(key)) continue;
    seen.add(key);
    const match = olByKey.get(key);
    if (match) both.push(mergeBooks(book, match));
    else gbOnly.push(book);
  }
  const olOnly = olList.filter((book, i, all) => {
    const key = bookKey(book);
    return !seen.has(key) && all.findIndex((b) => bookKey(b) === key) === i;
  });

  const rest: MediaSearchResult[] = [];
  for (let i = 0; i < Math.max(gbOnly.length, olOnly.length); i++) {
    if (gbOnly[i]) rest.push(gbOnly[i]);
    if (olOnly[i]) rest.push(olOnly[i]);
  }
  return { results: [...both, ...rest].slice(0, MAX_BOOK_RESULTS), status };
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

/** TMDB movie search. Runtime is resolved when the movie is added (see getMovieDetails). */
export async function searchMovies(query: string): Promise<MediaSearchResult[]> {
  const url = new URL(TMDB_MOVIE_SEARCH_URL);
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
      title?: string;
      poster_path?: string | null;
      release_date?: string;
    }>;
  };

  return (data.results ?? [])
    .filter((item) => Boolean(item.id))
    .slice(0, SEARCH_LIMIT)
    .map((item) => ({
      mediaType: "movie" as const,
      externalId: String(item.id),
      title: item.title ?? "Untitled",
      coverUrl: item.poster_path ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}` : null,
      subtitle: item.release_date?.slice(0, 4) ?? null,
      totalUnits: null,
      totalPages: null,
      creator: null,
      year: item.release_date ? Number(item.release_date.slice(0, 4)) || null : null,
    }));
}

export interface MovieDetails {
  /** Runtime in minutes; 0 when TMDB does not report one. */
  minutes: number;
  description: string | null;
  year: number | null;
  genres: string | null;
  /** Director(s). */
  creator: string | null;
}

/** Details for a TMDB movie, fetched once when it is added (never on page loads). */
export async function getMovieDetails(externalId: string): Promise<MovieDetails> {
  const url = new URL(`${TMDB_MOVIE_URL}/${encodeURIComponent(externalId)}`);
  url.searchParams.set("api_key", requireTmdbKey());
  url.searchParams.set("append_to_response", "credits");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB responded with ${res.status} for movie ${externalId}.`);
  }

  const data = (await res.json()) as {
    runtime?: number | null;
    overview?: string;
    release_date?: string;
    genres?: { name: string }[];
    credits?: { crew?: { job?: string; name: string }[] };
  };
  const directors = data.credits?.crew?.filter((c) => c.job === "Director").map((c) => c.name);
  return {
    minutes: data.runtime ?? 0,
    description: data.overview?.trim() || null,
    year: data.release_date ? Number(data.release_date.slice(0, 4)) || null : null,
    genres: data.genres?.map((g) => g.name).join(", ") || null,
    creator: directors?.length ? directors.join(", ") : null,
  };
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

export interface BookDetails {
  description: string | null;
  genres: string | null;
  creator: string | null;
  year: number | null;
}

const NO_DETAILS: BookDetails = { description: null, genres: null, creator: null, year: null };

/**
 * Best-effort details for a book id from a search result: a Google Books volume
 * ("gb:<id>") or an Open Library work ("/works/OL…W"). Never throws: details are a
 * bonus and must not block adding a book.
 */
export async function getBookDetails(externalId: string): Promise<BookDetails> {
  try {
    if (externalId.startsWith(GOOGLE_ID_PREFIX)) return await getGoogleDetails(externalId.slice(GOOGLE_ID_PREFIX.length));
    return await getOpenLibraryDetails(externalId);
  } catch {
    return NO_DETAILS;
  }
}

async function getGoogleDetails(volumeId: string): Promise<BookDetails> {
  const key = process.env.GOOGLE_BOOK_API_KEY;
  if (!key || !GOOGLE_ID_PATTERN.test(volumeId)) return NO_DETAILS;

  const url = new URL(`${GOOGLE_BOOKS_URL}/${volumeId}`);
  url.searchParams.set("fields", "volumeInfo(authors,publishedDate,description,categories)");
  url.searchParams.set("key", key);
  const res = await fetch(url, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) });
  if (!res.ok) return NO_DETAILS;

  const info = ((await res.json()) as { volumeInfo?: GoogleVolumeInfo }).volumeInfo;
  if (!info) return NO_DETAILS;
  return {
    description: info.description ? htmlToText(info.description).slice(0, 1500) || null : null,
    // Google categories look like "Fiction / Science Fiction / General"; keep unique words.
    genres:
      [...new Set((info.categories ?? []).flatMap((c) => c.split("/").map((p) => p.trim())).filter((p) => p && p !== "General"))]
        .slice(0, 5)
        .join(", ")
        .slice(0, 190) || null,
    creator: info.authors?.slice(0, 3).join(", ") ?? null,
    year: Number(info.publishedDate?.slice(0, 4)) || null,
  };
}

async function getOpenLibraryDetails(externalId: string): Promise<BookDetails> {
  if (!/^\/works\/OL\d+W$/.test(externalId)) return NO_DETAILS;
  const res = await fetch(`https://openlibrary.org${externalId}.json`, {
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
  });
  if (!res.ok) return NO_DETAILS;
  const data = (await res.json()) as {
    description?: string | { value?: string };
    subjects?: string[];
  };
  const raw = typeof data.description === "string" ? data.description : data.description?.value;
  return {
    ...NO_DETAILS,
    // Open Library descriptions often end with source links after a blank line.
    description: raw?.split(/\r?\n\r?\n(?:-{2,}|\[)/)[0].trim().slice(0, 1500) || null,
    genres: data.subjects?.slice(0, 5).join(", ").slice(0, 190) || null,
  };
}
