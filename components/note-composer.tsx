"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { addNote, type ActionState } from "@/lib/actions";
import type { MediaType, NoteTag } from "@/lib/types";

/**
 * Quick note input. The anchor shown here is informational — the server
 * re-derives it from the member's saved progress (CLAUDE.md §6A).
 */
const TAG_OPTIONS: { value: NoteTag; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "theory", label: "Theory" },
  { value: "question", label: "Question" },
  { value: "review", label: "Review" },
];

const initialState: ActionState = {};

export function NoteComposer({
  roomCode,
  mediaId,
  mediaType,
  authorName,
  anchorLabel,
  onPosted,
}: {
  roomCode: string;
  mediaId: string;
  mediaType: MediaType;
  authorName: string;
  anchorLabel: string;
  onPosted?: () => void;
}) {
  const [state, setState] = useState<ActionState>(initialState);
  const [pending, setPending] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<NoteTag>("note");

  // Plain async form action so the box can be cleared after a successful post.
  async function submit(formData: FormData) {
    setPending(true);
    const result = await addNote(initialState, formData);
    setPending(false);
    setState(result);
    if (result.ok) {
      setContent("");
      setTitle("");
      onPosted?.();
    }
  }

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !pending;

  return (
    <form action={submit} className="card space-y-3 p-5">
      <input type="hidden" name="room_code" value={roomCode} />
      <input type="hidden" name="media_id" value={mediaId} />
      <input type="hidden" name="tag" value={tag} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Posting as <span className="font-medium text-ink">{authorName}</span>
        </p>
        <span className="chip bg-brand-soft text-brand-ink">at {anchorLabel}</span>
      </div>

      <input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={80}
        aria-label="Entry title"
        placeholder={mediaType === "book" ? "Title, e.g. Chapter 8: The reveal" : mediaType === "movie" ? "Title, e.g. The twist at the hour mark" : "Title, e.g. Ep 4: That ending"}
        className="input font-display text-base"
      />

      <textarea
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={2000}
        aria-label="Your note"
        placeholder="What did you think? It stays locked for friends who haven't caught up…"
        className="input resize-y"
      />

      {mediaType === "book" && (
        <input
          name="chapter"
          maxLength={40}
          aria-label="Chapter (optional)"
          placeholder="Chapter, e.g. Ch. 8 (optional)"
          className="input"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TAG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTag(opt.value)}
              aria-pressed={tag === opt.value}
              className={`chip min-h-8 px-3 transition ${
                tag === opt.value
                  ? "bg-brand text-on-brand"
                  : "bg-paper text-muted ring-1 ring-line hover:bg-brand-soft"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button type="submit" disabled={!canSubmit} className="btn-primary ml-auto">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Post
        </button>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {state.error}
        </p>
      )}
    </form>
  );
}
