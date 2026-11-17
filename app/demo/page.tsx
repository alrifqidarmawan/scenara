"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Brand } from "@/components/brand";
import { NoteCard } from "@/components/note-card";
import { PersonaSwitcher } from "@/components/persona-switcher";
import { ProgressSlider } from "@/components/progress-slider";
import { Toast, unlockMessage } from "@/components/toast";
import {
  DEMO_MEDIA,
  DEMO_NOTES,
  DEMO_PERSONAS,
  type DemoPersona,
} from "@/lib/demo-data";
import { isNoteUnlocked } from "@/lib/types";

/**
 * Interactive demo (GEMINI.md §6C) — zero friction, no Supabase, no login.
 * Everything runs client-side so a visitor can slide progress forward and
 * watch notes unlock, from either persona's point of view.
 */
export default function DemoPage() {
  const [activeId, setActiveId] = useState<DemoPersona>(DEMO_PERSONAS[0]);

  // Progress per persona, so switching back and forth keeps each one's place.
  const [progress, setProgress] = useState<Record<string, number>>(() =>
    Object.fromEntries(DEMO_PERSONAS.map((p) => [p.id, p.initialUnit])),
  );

  const myUnit = progress[activeId.id];

  // Per-persona progress means "before" is always this persona's own current
  // unit — no shared counter to go stale when switching personas.
  function countUnlocked(unit: number) {
    return DEMO_NOTES.filter((n) => isNoteUnlocked(n, unit)).length;
  }

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  function handleProgress(next: number) {
    const current = progress[activeId.id];
    setProgress((p) => ({ ...p, [activeId.id]: next }));

    const gained = countUnlocked(next) - countUnlocked(current);
    if (gained > 0) {
      setToast(unlockMessage(gained));
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 3200);
    }
  }

  // Show the newest notes first, locked ones included — silence makes rooms
  // feel dead (GEMINI.md §6A).
  const feed = [...DEMO_NOTES].sort((a, b) => b.anchor_unit - a.anchor_unit);

  return (
    <div className="min-h-dvh pb-28">
      <header className="border-b border-line bg-cream/70">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Brand badge="Demo" />
          <span className="text-xs text-muted">Switch personas below</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <section className="card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl">{DEMO_MEDIA.title}</h1>
              <p className="text-sm text-muted">
                {DEMO_MEDIA.subtitle} · {DEMO_MEDIA.totalUnits} episodes
              </p>
            </div>
            <span className="chip bg-peach/50 px-3 py-1 text-sm text-ink">
              {activeId.name} · {myUnit === 0 ? "Not started" : `Ep ${myUnit}`}
            </span>
          </div>

          <div className="mt-6">
            <ProgressSlider
              mediaType={DEMO_MEDIA.mediaType}
              totalUnits={DEMO_MEDIA.totalUnits}
              value={myUnit}
              onChange={handleProgress}
            />
          </div>
        </section>

        <p className="flex items-center gap-2 text-sm text-muted">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          Drag the slider forward to unlock the notes below.
        </p>

        <section aria-label="Notes feed" className="space-y-3">
          {feed.map((note) => (
            <NoteCard
              key={`${note.author_name}-${note.anchor_unit}-${note.tag}`}
              note={note}
              isUnlocked={isNoteUnlocked(note, myUnit)}
            />
          ))}
        </section>

        <p className="pb-4 text-center text-sm text-muted">
          Want a room of your own?{" "}
          <Link href="/" className="link">
            Create one
          </Link>
        </p>
      </main>

      <Toast message={toast} />

      <PersonaSwitcher
        personas={DEMO_PERSONAS.map((p) => ({ id: p.id, name: p.name }))}
        activeId={activeId.id}
        onSelect={(id) => {
          const persona = DEMO_PERSONAS.find((p) => p.id === id);
          if (persona) setActiveId(persona);
        }}
        labelFor={(id) => {
          const unit = progress[id] ?? 0;
          return unit === 0 ? "Not started" : `Ep ${unit}`;
        }}
      />
    </div>
  );
}
