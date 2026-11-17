"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { setBookPages } from "@/lib/actions";

/**
 * Total pages = the end of the book. Everyone's page progress is shown against it
 * and the percentage is derived. Changing it rescales existing progress and notes.
 */
export function BookPages({
  roomCode,
  mediaId,
  totalPages,
}: {
  roomCode: string;
  mediaId: string;
  /** null while the book is still tracked in percent. */
  totalPages: number | null;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = draft ?? (totalPages ? String(totalPages) : "");
  const pages = Number(shown);
  const valid = Number.isInteger(pages) && pages >= 1 && pages !== totalPages;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    setError(null);
    const result = await setBookPages(roomCode, mediaId, pages);
    setPending(false);
    if (result.error) setError(result.error);
    else setDraft(null);
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="total-pages" className="eyebrow block">
        {totalPages ? "Total pages" : "Track by page"}
      </label>
      {!totalPages && (
        <p className="text-xs text-muted">
          Enter the book&apos;s last page. Then you can type your page and the percent fills itself.
        </p>
      )}
      <div className="flex gap-2">
        <input
          id="total-pages"
          type="number"
          inputMode="numeric"
          min={1}
          max={10000}
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. 900"
          className="input py-1.5 tabular-nums"
        />
        <button type="submit" disabled={!valid || pending} className="btn-primary min-h-9 shrink-0 px-4">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-blush px-3 py-1.5 text-xs text-blush-ink">
          {error}
        </p>
      )}
    </form>
  );
}
