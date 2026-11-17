"use client";

import { Users } from "lucide-react";

/**
 * Floating persona bar for the demo (CLAUDE.md §6F).
 * Lets a solo visitor view the room as different members to feel the
 * Fog of War from both sides — e.g. "Sarah (Ep 2)" vs "Alex (Ep 5)".
 */
export function PersonaSwitcher({
  personas,
  activeId,
  onSelect,
  labelFor,
}: {
  personas: { id: string; name: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Renders each persona's current position, e.g. "Ep 2". */
  labelFor: (id: string) => string;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-cream/95 p-1.5 shadow-soft backdrop-blur">
        <span className="hidden items-center gap-1.5 pr-1 pl-3 text-xs font-medium text-muted sm:flex">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Viewing as
        </span>
        {personas.map((persona) => {
          const active = persona.id === activeId;
          return (
            <button
              key={persona.id}
              type="button"
              onClick={() => onSelect(persona.id)}
              aria-pressed={active}
              className={`min-h-10 rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand ${
                active ? "bg-brand text-on-brand" : "text-muted hover:bg-paper"
              }`}
            >
              {persona.name} <span className="opacity-70">({labelFor(persona.id)})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
