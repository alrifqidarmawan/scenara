"use client";

import { useEffect, useRef, useState } from "react";
import { updateProgress } from "@/lib/actions";
import type { MediaType } from "@/lib/types";
import { ProgressSlider } from "./progress-slider";
import { Toast, unlockMessage } from "./toast";

const SAVE_DELAY_MS = 400;

/**
 * Saves the member's progress (debounced while dragging) and announces
 * newly unlocked notes. The server action revalidates the page, so the
 * notes feed below refreshes on its own.
 */
export function MediaProgress({
  roomCode,
  mediaId,
  mediaType,
  totalUnits,
  usesPages,
  initialUnit,
}: {
  roomCode: string;
  mediaId: string;
  mediaType: MediaType;
  totalUnits: number;
  usesPages: boolean;
  initialUnit: number;
}) {
  const [value, setValue] = useState(initialUnit);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  function handleChange(next: number) {
    setValue(next);
    setError(null);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const result = await updateProgress(roomCode, mediaId, next);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.unlocked) {
        setToast(unlockMessage(result.unlocked));
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 3200);
      }
    }, SAVE_DELAY_MS);
  }

  return (
    <>
      <ProgressSlider
        mediaType={mediaType}
        totalUnits={totalUnits}
        usesPages={usesPages}
        value={value}
        onChange={handleChange}
      />
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {error}
        </p>
      )}
      <Toast message={toast} />
    </>
  );
}
