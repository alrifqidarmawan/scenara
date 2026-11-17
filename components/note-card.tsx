import { Lock } from "lucide-react";
import type { NoteCardData } from "@/lib/types";

/**
 * One note in the feed — unlocked or locked behind the Fog of War.
 * Pure and presentational: safe to render from Server or Client Components.
 *
 * Locked notes arrive with `content: null` (stripped on the server, see
 * lib/data.ts → getFeed), and the card never renders real text while locked,
 * so future notes cannot be read out of the HTML.
 */

const TAG_STYLES: Record<NoteCardData["tag"], string> = {
  note: "bg-paper text-muted ring-1 ring-line",
  theory: "bg-lavender text-lavender-ink",
  question: "bg-butter text-butter-ink",
  review: "bg-sky text-sky-ink",
};

const TAG_LABELS: Record<NoteCardData["tag"], string> = {
  note: "Note",
  theory: "Theory",
  question: "Question",
  review: "Review",
};

export function NoteCard({
  note,
  isUnlocked,
}: {
  note: NoteCardData;
  isUnlocked: boolean;
}) {
  if (!isUnlocked) {
    return (
      <article className="rounded-3xl border border-dashed border-butter-ink/25 bg-butter/50 p-5">
        <p className="flex items-start gap-2 text-sm font-medium text-butter-ink">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Locked until <span className="font-semibold">{note.anchor_label}</span> — posted by{" "}
            {note.author_name}
          </span>
        </p>
        {/* Decorative blur only — there is no real text behind it. */}
        <div aria-hidden="true" className="mt-3 space-y-2 opacity-40 blur-[3px] select-none">
          <div className="h-3 w-11/12 rounded-full bg-butter-ink/40" />
          <div className="h-3 w-7/12 rounded-full bg-butter-ink/40" />
        </div>
      </article>
    );
  }

  return (
    <article className="card p-5">
      <header className="flex flex-wrap items-center gap-2">
        <span className={`chip ${TAG_STYLES[note.tag]}`}>{TAG_LABELS[note.tag]}</span>
        <span className="chip bg-peach/40 text-ink">{note.anchor_label}</span>
        <span className="ml-auto text-xs text-muted">{note.author_name}</span>
      </header>
      {note.title && <h3 className="mt-3 font-display text-lg leading-snug">{note.title}</h3>}
      <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-ink/90">{note.content}</p>
    </article>
  );
}
