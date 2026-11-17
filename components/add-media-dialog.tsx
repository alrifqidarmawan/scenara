"use client";

import { useState } from "react";
import { BookOpen, Loader2, Plus, Search, Tv, X } from "lucide-react";
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

export function AddMediaDialog({ roomCode }: { roomCode: string }) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType>("tv");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
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
    try {
      const res = await fetch(`/api/search?type=${mediaType}&q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results?: MediaSearchResult[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Search failed.");
      setResults(data.results ?? []);
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
        Add a show or book
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
        <ManualMediaForm roomCode={roomCode} onDone={() => setOpen(false)} />
      ) : (
        <>
      <div className="flex items-center justify-between gap-2">
        {/* Medium toggle — v1 supports only tv + book (GEMINI.md §2) */}
        <div className="flex gap-2">
          {(
            [
              { value: "tv", label: "TV series", icon: Tv },
              { value: "book", label: "Book", icon: BookOpen },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setMediaType(opt.value);
                setResults([]);
                setSearchError(null);
              }}
              aria-pressed={mediaType === opt.value}
              className={`chip min-h-9 gap-1.5 px-3.5 text-sm transition ${
                mediaType === opt.value
                  ? "bg-peach text-ink"
                  : "bg-paper text-muted ring-1 ring-line hover:bg-peach/30"
              }`}
            >
              <opt.icon className="h-4 w-4" aria-hidden="true" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={runSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
          placeholder={mediaType === "tv" ? "Search TV series…" : "Search books…"}
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

      {searchError && <p className="text-sm text-butter-ink">{searchError}</p>}
      {state?.error && (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {state.error}
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((item) => (
            <li
              key={`${item.mediaType}-${item.externalId}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-paper/60 p-2.5"
            >
              <Cover url={item.coverUrl} title={item.title} mediaType={item.mediaType} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted">{item.subtitle ?? "Unknown"}</p>
              </div>
              <form action={formAction}>
                <input type="hidden" name="room_code" value={roomCode} />
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
