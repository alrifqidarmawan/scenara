"use client";

import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { createRoom, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

/** "Create a Room" CTA from CLAUDE.md §6F — a real room row in Supabase. */
export function CreateRoomForm() {
  const [state, formAction, pending] = useActionState(createRoom, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="room-name" className="block text-sm font-medium">
        Name your room
      </label>
      <input
        id="room-name"
        name="name"
        required
        maxLength={80}
        placeholder="e.g. Friday Night Club"
        className="input"
      />
      <button type="submit" disabled={pending} className="btn-primary group w-full">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        )}
        Create room
      </button>
      {state?.error && (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {state.error}
        </p>
      )}
    </form>
  );
}
