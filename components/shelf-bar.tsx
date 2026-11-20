"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, Plus, Tv, X, ZoomIn, ZoomOut } from "lucide-react";
import { createShelf } from "@/lib/actions";
import { LinkPending } from "./link-pending";
import type { MediaType } from "@/lib/types";

export interface ShelfTab {
  id: string;
  name: string;
  kind: MediaType;
  count: number;
}

/**
 * Switches between shelves (one is shown at a time), creates new named shelves, and
 * zooms out to see every shelf as a row. Tabs are plain links (`?shelf=<id>`), so each
 * shelf has a shareable URL and the server renders only the chosen one.
 */
export function ShelfBar({
  roomCode,
  shelves,
  currentId,
  overview,
  canEdit,
}: {
  roomCode: string;
  shelves: ShelfTab[];
  currentId: string;
  overview: boolean;
  /** Owner or collaborator can create shelves. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const base = `/room/${roomCode}`;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MediaType>("book");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createShelf(roomCode, name, kind);
    setPending(false);
    if (result.error || !result.id) {
      setError(result.error ?? "Could not create the shelf.");
      return;
    }
    setName("");
    setCreating(false);
    router.push(`${base}?shelf=${result.id}`, { scroll: false });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <nav aria-label="Shelves" className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-1">
          {shelves.map((s) => {
            const active = !overview && s.id === currentId;
            const Icon = s.kind === "book" ? BookOpen : Tv;
            return (
              <Link
                key={s.id}
                href={`${base}?shelf=${s.id}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  active
                    ? "bg-brand text-on-brand shadow-[0_6px_16px_-8px_var(--brand)]"
                    : "border border-line bg-cream text-ink hover:border-brand/40 hover:bg-brand-soft/60"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {s.name}
                <span className={`text-xs ${active ? "opacity-80" : "text-muted"}`}>{s.count}</span>
                <LinkPending className="rounded-full" />
              </Link>
            );
          })}
          {canEdit && <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            aria-expanded={creating}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-sm text-muted transition hover:border-brand/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New shelf
          </button>}
        </nav>

        {shelves.length > 1 && (
          <Link
            href={overview ? `${base}?shelf=${currentId}` : `${base}?view=all`}
            scroll={false}
            className="btn-soft shrink-0"
            title={overview ? "Back to one shelf" : "See all shelves"}
          >
            {overview ? <ZoomIn className="h-4 w-4" aria-hidden="true" /> : <ZoomOut className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden sm:inline">{overview ? "Zoom in" : "Zoom out"}</span>
          </Link>
        )}
      </div>

      {canEdit && creating && (
        <form onSubmit={create} className="card zoom-in space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="new-shelf" className="font-display text-lg">
              Name your new shelf
            </label>
            <button type="button" aria-label="Cancel" onClick={() => setCreating(false)} className="text-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            id="new-shelf"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            autoFocus
            placeholder="e.g. Sci-fi, Friday movie night"
            className="input"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { value: "book", label: "Books", icon: BookOpen },
                { value: "tv", label: "Shows", icon: Tv },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={kind === opt.value}
                onClick={() => setKind(opt.value)}
                className={`chip min-h-9 gap-1.5 px-3.5 text-sm transition ${
                  kind === opt.value ? "bg-brand text-on-brand" : "bg-paper text-muted ring-1 ring-line hover:bg-brand-soft"
                }`}
              >
                <opt.icon className="h-4 w-4" aria-hidden="true" />
                {opt.label}
              </button>
            ))}
            <span className="text-xs text-muted">
              {kind === "book" ? "A wooden shelf for books." : "A painted film-strip shelf for shows."}
            </span>
            <button type="submit" disabled={pending || !name.trim()} className="btn-primary ml-auto">
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Create shelf
            </button>
          </div>
          {error && (
            <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
