"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { addManualMedia, type ActionState } from "@/lib/actions";
import type { MediaType } from "@/lib/types";

const MAX_SIDE = 600;

/** Shrink to a ~600px JPEG so uploads stay tiny (server cap is 1 MB). */
async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not read that image.");
  return new File([blob], "cover.jpg", { type: "image/jpeg" });
}

/** Add a book or show by hand, with an optional cover upload. */
export function ManualMediaForm({
  roomCode,
  shelf,
  onDone,
}: {
  roomCode: string;
  shelf: { id: string; kind: MediaType };
  onDone: () => void;
}) {
  const mediaType = shelf.kind;
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>({});
  const [pending, setPending] = useState(false);

  async function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const small = await shrinkImage(file);
      setCover(small);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(small);
      });
      setState({});
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : "Could not read that image." });
    }
  }

  async function submit(formData: FormData) {
    formData.set("room_code", roomCode);
    formData.set("media_type", mediaType);
    formData.set("shelf_id", shelf.id);
    formData.delete("cover");
    if (cover) formData.set("cover", cover);
    setPending(true);
    const result = await addManualMedia({}, formData);
    setPending(false);
    setState(result);
    if (result.ok) onDone();
  }

  return (
    <form action={submit} className="space-y-3">
      <div className="flex gap-4">
        <label className="flex aspect-[2/3] w-28 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-dashed border-line bg-paper text-center text-xs text-muted transition hover:bg-brand-soft/50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Cover preview" className="h-full w-full object-cover" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
              Add cover
            </>
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickCover} className="sr-only" />
        </label>

        <div className="min-w-0 flex-1 space-y-2">
          <input name="title" required maxLength={200} placeholder="Title *" aria-label="Title" className="input" />
          <input
            name="creator"
            maxLength={200}
            placeholder={mediaType === "book" ? "Author" : "Creator"}
            aria-label={mediaType === "book" ? "Author" : "Creator"}
            className="input"
          />
          <div className="flex gap-2">
            <input name="year" type="number" inputMode="numeric" min={1} max={3000} placeholder="Year" aria-label="Year" className="input" />
            {mediaType === "book" ? (
              <input name="pages" type="number" inputMode="numeric" min={1} max={10000} placeholder="Pages" aria-label="Total pages" className="input" />
            ) : mediaType === "movie" ? (
              <input name="minutes" type="number" inputMode="numeric" min={1} max={1500} required placeholder="Minutes *" aria-label="Length in minutes" className="input" />
            ) : (
              <input name="episodes" type="number" inputMode="numeric" min={1} max={5000} required placeholder="Episodes *" aria-label="Total episodes" className="input" />
            )}
          </div>
        </div>
      </div>

      <input name="genres" maxLength={200} placeholder="Genres, e.g. Sci-fi, Drama" aria-label="Genres" className="input" />
      <textarea name="description" rows={3} maxLength={2000} placeholder="What is it about? (shown when you hover the cover)" aria-label="Description" className="input resize-y" />

      {mediaType === "book" && (
        <p className="text-xs text-muted">Add the page count to track progress by page. Leave it empty for a percentage.</p>
      )}

      {state.error && (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Add to shelf
      </button>
    </form>
  );
}
