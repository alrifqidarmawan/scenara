"use client";

import { useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { Skeleton } from "./skeleton";
import { addMedia, type ActionState } from "@/lib/actions";
import type { MediaSearchResult, MediaType } from "@/lib/types";
import { Cover } from "./cover";
import { ManualMediaForm } from "./manual-media-form";

/**
 * Search Open Library / TMDB and add a medium to the room.
 * Search calls GET /api/search (server proxy, keeps TMDB_API_KEY private);
 * adding calls the addMedia Server Action.
 */

const initialState: ActionState = {};

export function AddMediaDialog({
  roomCode,
  shelf,
}: {
  roomCode: string;
  /** The shelf being added to. Its kind decides what can be searched (books or shows). */
  shelf: { id: string; name: string; kind: MediaType };
}) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const mediaType = shelf.kind;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>(initialState);
  const [pending, setPending] = useState(false);

  // Close and reset once something was added.
  async function formAction(formData: FormData) {
    setPending(true);
    const result = await addMedia(initialState, formData);
    setPending(false);
    setState(result);
    if (result.ok) {
      setOpen(false);
      setResults([]);
      setQuery("");
    }
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setSearchError("Type at least 2 characters.");
      return;
    }

    setSearching(true);
    setSearchError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/search?type=${mediaType}&q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as {
        results?: MediaSearchResult[];
        error?: string;
        status?: Record<"openlibrary" | "google", "ok" | "failed" | "skipped">;
      };
      if (!res.ok) throw new Error(data.error ?? "Search failed.");
      setResults(data.results ?? []);
      setNotice(
        data.status?.openlibrary === "failed"
          ? "Open Library is slow or down, so these come from Google Books only."
          : data.status?.google === "failed"
            ? "Google Books didn't answer, so these come from Open Library only."
            : null,
      );
      if ((data.results ?? []).length === 0) setSearchError("No matches found.");
    } catch (err) {
      setResults([]);
      setSearchError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" aria-hidden="true" />
        {shelf.kind === "book" ? "Add a book" : shelf.kind === "movie" ? "Add a movie" : "Add a show"}
      </button>
    );
  }

  return (
    <div className="card w-full space-y-4 p-5">
      <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1 rounded-full bg-paper p-1 ring-1 ring-line">
        {(
          [
            { manual: false, label: "Search" },
            { manual: true, label: "Add manually" },
          ] as const
        ).map((m) => (
          <button
            key={m.label}
            type="button"
            aria-pressed={manual === m.manual}
            onClick={() => setManual(m.manual)}
            className={`min-h-8 flex-1 rounded-full px-3 text-sm font-medium transition ${
              manual === m.manual ? "bg-cream text-ink shadow-soft" : "text-muted hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Close"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper"
      >
        <X className="h-4 w-4" />
      </button>
      </div>

      {manual ? (
        <ManualMediaForm roomCode={roomCode} shelf={shelf} onDone={() => setOpen(false)} />
      ) : (
        <>
      <form onSubmit={runSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
          placeholder={`Search ${mediaType === "book" ? "books" : mediaType === "movie" ? "movies" : "shows"} for “${shelf.name}”…`}
          className="input"
          autoFocus
        />
        <button type="submit" disabled={searching} className="btn-primary shrink-0">
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="sr-only sm:not-sr-only">Search</span>
        </button>
      </form>

      {mediaType === "book" && !searchError && (
        <p className="text-xs text-muted">Searches Google Books and Open Library together.</p>
      )}
      {notice && <p className="text-xs text-butter-ink">{notice}</p>}
      {searchError && <p className="text-sm text-butter-ink">{searchError}</p>}
      {state?.error && (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {state.error}
        </p>
      )}

      {searching && (
        <ul aria-label="Searching" className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-paper/60 p-2.5">
              <Skeleton className="h-16 w-11 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!searching && results.length > 0 && (
        <ul className="space-y-2">
          {results.map((item) => (
            <li
              key={`${item.mediaType}-${item.externalId}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-paper/60 p-2.5"
            >
              <Cover url={item.coverUrl} title={item.title} mediaType={item.mediaType} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted">
                  {item.subtitle ?? "Unknown"}
                  {item.year ? ` · ${item.year}` : ""}
                  {item.totalPages ? ` · ${item.totalPages}p` : ""}
                  {item.sources?.length === 2 ? " · ✓ both sources" : ""}
                </p>
              </div>
              <form action={formAction}>
                <input type="hidden" name="room_code" value={roomCode} />
                <input type="hidden" name="shelf_id" value={shelf.id} />
                <input type="hidden" name="media_type" value={item.mediaType} />
                <input type="hidden" name="external_id" value={item.externalId} />
                <input type="hidden" name="title" value={item.title} />
                <input type="hidden" name="cover_url" value={item.coverUrl ?? ""} />
                <input type="hidden" name="creator" value={item.creator ?? ""} />
                <input type="hidden" name="year" value={item.year ?? ""} />
                <div className="flex items-center gap-2">
                  {item.mediaType === "book" && (
                    <input
                      name="total_pages"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={10000}
                      defaultValue={item.totalPages ?? ""}
                      aria-label={`Pages in ${item.title}`}
                      placeholder="Pages"
                      title="Page count lets people track progress by page. Leave empty to use a percentage."
                      className="input w-20 px-2 py-1.5 text-center"
                    />
                  )}
                  <button type="submit" disabled={pending} className="btn-primary min-h-9 px-4">
                    Add
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
        </>
      )}
    </div>
  );
}
