"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { deleteShelf, renameShelf } from "@/lib/actions";

/** The open shelf's name, with rename and (when empty) delete. */
export function ShelfTitle({
  roomCode,
  shelf,
  count,
  canDelete,
}: {
  roomCode: string;
  shelf: { id: string; name: string };
  count: number;
  /** False when it is the room's only shelf. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(shelf.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === shelf.name) return setEditing(false);
    setPending(true);
    setError(null);
    const result = await renameShelf(roomCode, shelf.id, name);
    setPending(false);
    if (result.error) return setError(result.error);
    setEditing(false);
  }

  async function remove() {
    if (!window.confirm(`Delete the empty shelf “${shelf.name}”?`)) return;
    setPending(true);
    const result = await deleteShelf(roomCode, shelf.id);
    setPending(false);
    if (result.error) return setError(result.error);
    router.push(`/room/${roomCode}`, { scroll: false });
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl tracking-tight">{shelf.name}</h2>
        <span className="chip bg-paper text-muted ring-1 ring-line">
          {count} {count === 1 ? "item" : "items"}
        </span>
        <button
          type="button"
          onClick={() => {
            setName(shelf.name);
            setError(null);
            setEditing(true);
          }}
          aria-label="Rename shelf"
          title="Rename shelf"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink"
        >
          <Pencil className="h-4 w-4" />
        </button>
        {error && <span role="alert" className="text-sm text-blush-ink">{error}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
          autoFocus
          aria-label="Shelf name"
          className="input max-w-xs font-display text-lg"
        />
        <button type="submit" disabled={pending} className="btn-primary min-h-9 px-4">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn-soft min-h-9 px-4">
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </button>
        {count === 0 && canDelete && (
          <button type="button" onClick={remove} disabled={pending} className="btn-soft min-h-9 px-4 text-blush-ink">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete empty shelf
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {error}
        </p>
      )}
    </form>
  );
}
