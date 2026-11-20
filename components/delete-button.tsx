"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/actions";
import { Spinner } from "./skeleton";

/**
 * Small trash button with a confirm step. `onDelete` is a Server Action call; errors are
 * shown next to the button. Visibility rules live with the caller (the server re-checks).
 */
export function DeleteButton({
  label,
  confirmText,
  onDelete,
  onDone,
  withLabel = false,
}: {
  label: string;
  confirmText: string;
  onDelete: () => Promise<ActionState>;
  onDone?: () => void;
  withLabel?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!window.confirm(confirmText)) return;
    setPending(true);
    setError(null);
    const result = await onDelete();
    setPending(false);
    if (result.error) return setError(result.error);
    onDone?.();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        aria-label={label}
        title={label}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted transition hover:bg-blush hover:text-blush-ink disabled:opacity-50"
      >
        {pending ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
        {withLabel && label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-blush-ink">
          {error}
        </span>
      )}
    </span>
  );
}
