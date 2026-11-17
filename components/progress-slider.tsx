"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { formatUnitLabel, type MediaType } from "@/lib/types";

/**
 * Progress control (CLAUDE.md §2 "Progress Units").
 * - TV:    episode stepper, integer 0..total_units (0 = not started)
 * - Books: page slider + exact page input when the page count is known,
 *          otherwise a 0..100 percentage
 *
 * Controlled component — the parent owns the value so it can react to
 * progress changes (e.g. the "Unlocked N new notes!" toast).
 */
export function ProgressSlider({
  mediaType,
  totalUnits,
  usesPages = false,
  value,
  onChange,
}: {
  mediaType: MediaType;
  /** Episodes (TV), pages (book in pages) or 100 (book in percent). */
  totalUnits: number;
  usesPages?: boolean;
  value: number;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const max = totalUnits;
  const clamp = (n: number) => Math.max(0, Math.min(max, Math.round(n)));
  const unitName = mediaType === "tv" ? "Episode" : usesPages ? "Page" : "Percent";
  const label =
    value === 0 && mediaType === "tv"
      ? "Not started"
      : usesPages
        ? `p. ${value} / ${max}`
        : formatUnitLabel(mediaType, value);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">
          {mediaType === "book" ? "Where are you?" : "Last episode watched"}
        </span>
        <span className="font-display text-2xl tabular-nums">
          {label}
          {usesPages && max > 0 && (
            <span className="ml-2 font-sans text-sm text-muted">· {Math.round((value / max) * 100)}%</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {mediaType === "tv" && (
          <StepButton
            onClick={() => onChange(clamp(value - 1))}
            disabled={value <= 0}
            label="Previous episode"
          >
            <Minus className="h-4 w-4" />
          </StepButton>
        )}

        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          aria-label={`${unitName} slider`}
          style={{ "--p": `${max > 0 ? (value / max) * 100 : 0}%` } as React.CSSProperties}
          className="w-full cursor-pointer"
        />

        {mediaType === "tv" && (
          <StepButton
            onClick={() => onChange(clamp(value + 1))}
            disabled={value >= max}
            label="Next episode"
          >
            <Plus className="h-4 w-4" />
          </StepButton>
        )}
      </div>

      {/* Exact entry for people who know the number (or are too lazy to drag). */}
      <label className="flex items-center gap-2 text-sm text-muted">
        <span>Or type {mediaType === "tv" ? "the episode" : usesPages ? "your page" : "a percent"}:</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={draft ?? String(value)}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(Number(e.target.value))) {
              onChange(clamp(Number(e.target.value)));
            }
          }}
          onBlur={() => setDraft(null)}
          aria-label={`${unitName} number`}
          className="input w-24 py-1.5 text-center tabular-nums"
        />
        <span>/ {max}</span>
      </label>

      <p className="text-xs text-muted">
        {mediaType === "tv"
          ? `Out of ${max} episodes. Notes past this point stay locked.`
          : `Entries anchored past this ${usesPages ? "page" : "percentage"} stay locked.`}
      </p>
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-cream text-ink transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
