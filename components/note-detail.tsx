"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Highlighter, Loader2, X } from "lucide-react";
import { addHighlight } from "@/lib/actions";
import type { FeedNote, Highlight } from "@/lib/types";

const TAG_LABELS: Record<FeedNote["tag"], string> = {
  note: "Note",
  theory: "Theory",
  question: "Question",
  review: "Review",
};

interface Segment {
  text: string;
  ids: string[];
}

/** Split `content` at every highlight boundary so overlapping ranges render correctly. */
function buildSegments(content: string, highlights: Highlight[]): Segment[] {
  const cuts = new Set<number>([0, content.length]);
  for (const h of highlights) {
    cuts.add(Math.min(h.start_offset, content.length));
    cuts.add(Math.min(h.end_offset, content.length));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [from, to] = [points[i], points[i + 1]];
    segments.push({
      text: content.slice(from, to),
      ids: highlights.filter((h) => h.start_offset <= from && h.end_offset >= to).map((h) => h.id),
    });
  }
  return segments;
}

/**
 * Full entry + highlight comments.
 * Select any passage to comment on it. The text lives in ONE <p> whose
 * textContent equals `note.content`, so DOM offsets map 1:1 to string offsets
 * (the server re-validates them against the stored text).
 */
export function NoteDetail({
  roomCode,
  note,
  highlights,
  canComment,
  onBack,
}: {
  roomCode: string;
  note: FeedNote & { content: string };
  highlights: Highlight[];
  /** Owner and collaborators only; viewers just read. */
  canComment: boolean;
  onBack: () => void;
}) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [comment, setComment] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segments = useMemo(() => buildSegments(note.content, highlights), [note.content, highlights]);

  // Remember the latest non-empty selection inside the text. Empty selections are
  // ignored on purpose: focusing the comment box collapses the selection, but we
  // still want to comment on the passage that was selected.
  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      const root = textRef.current;
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !root) return;
      const range = sel.getRangeAt(0).cloneRange();
      if (!range.intersectsNode(root)) return;
      // A drag that strays outside the text is clamped to the text.
      const whole = document.createRange();
      whole.selectNodeContents(root);
      if (range.compareBoundaryPoints(Range.START_TO_START, whole) < 0) range.setStart(whole.startContainer, whole.startOffset);
      if (range.compareBoundaryPoints(Range.END_TO_END, whole) > 0) range.setEnd(whole.endContainer, whole.endOffset);

      const before = document.createRange();
      before.selectNodeContents(root);
      before.setEnd(range.startContainer, range.startOffset);
      const start = before.toString().length;
      const text = range.toString();
      if (!text.trim()) return;
      setSelection({ start, end: start + text.length, text });
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selection) return;
    setPending(true);
    setError(null);
    const result = await addHighlight({
      roomCode,
      noteId: note.id,
      start: selection.start,
      end: selection.end,
      comment,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setComment("");
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All entries
      </button>

      <header className="flex flex-wrap items-center gap-2">
        <span className="chip bg-brand-soft text-brand-ink">{note.anchor_label}</span>
        <span className="chip bg-paper text-muted ring-1 ring-line">{TAG_LABELS[note.tag]}</span>
        <span className="ml-auto text-xs text-muted">{note.author_name}</span>
      </header>

      {note.title && <h3 className="font-display text-2xl leading-snug">{note.title}</h3>}

      <p ref={textRef} className="text-[15px] leading-7 whitespace-pre-wrap text-ink/90">
        {segments.map((seg, i) =>
          seg.ids.length === 0 ? (
            seg.text
          ) : (
            <mark
              key={i}
              onClick={() => setActiveId(seg.ids[0])}
              className={`cursor-pointer rounded-sm px-0.5 text-ink transition ${
                seg.ids.includes(activeId ?? "") ? "bg-brand-soft text-brand-ink ring-1 ring-brand/40" : "bg-butter hover:bg-brand-soft"
              }`}
            >
              {seg.text}
            </mark>
          ),
        )}
      </p>

      {!canComment ? (
        <p className="text-xs text-muted">View-only: ask the owner to make you a collaborator to comment.</p>
      ) : selection ? (
        <form onSubmit={submit} className="space-y-2 rounded-2xl border border-brand/40 bg-brand-soft/50 p-3">
          <div className="flex items-start gap-2">
            <Highlighter className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
            <p className="line-clamp-2 flex-1 text-sm text-ink/80">“{selection.text.trim()}”</p>
            <button
              type="button"
              aria-label="Cancel highlight"
              onClick={() => setSelection(null)}
              className="text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              aria-label="Your comment on this passage"
              placeholder="Add your comment…"
              className="input"
            />
            <button type="submit" disabled={pending || !comment.trim()} className="btn-primary shrink-0">
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Comment
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-blush-ink">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Highlighter className="h-3.5 w-3.5" aria-hidden="true" />
          Select any lines above to comment on them.
        </p>
      )}

      {highlights.length > 0 && (
        <section aria-label="Highlight comments" className="space-y-2">
          <h3 className="eyebrow">Highlights · {highlights.length}</h3>
          <ul className="space-y-2">
            {highlights.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(h.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    activeId === h.id ? "border-brand bg-brand-soft/50" : "border-line bg-paper/60 hover:bg-paper"
                  }`}
                >
                  <p className="line-clamp-2 border-l-2 border-butter-ink/40 pl-2 text-xs text-muted italic">
                    {h.quote}
                  </p>
                  <p className="mt-1.5 text-sm text-ink">{h.comment}</p>
                  <p className="mt-1 text-xs text-muted">{h.author_name}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
