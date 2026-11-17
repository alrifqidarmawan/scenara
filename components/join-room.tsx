"use client";

import { useActionState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { claimMember, joinRoom, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

/** Frictionless identity (GEMINI.md §6B): pick a nickname, or reclaim an existing one. */
export function JoinRoom({
  roomCode,
  members,
}: {
  roomCode: string;
  members: { id: string; nickname: string }[];
}) {
  const [state, formAction, pending] = useActionState(joinRoom, initialState);
  const [claiming, startClaim] = useTransition();

  return (
    <div className="card mx-auto w-full max-w-md space-y-5 p-6">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="room_code" value={roomCode} />
        <label htmlFor="nickname" className="block font-display text-xl">
          What should we call you?
        </label>
        <input
          id="nickname"
          name="nickname"
          required
          maxLength={30}
          autoComplete="nickname"
          placeholder="Your name"
          className="input"
        />
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Join room
        </button>
      </form>

      {members.length > 0 && (
        <div className="border-t border-line pt-4">
          <p className="eyebrow">Or I&apos;m already here</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {members.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={claiming}
                  onClick={() => startClaim(() => void claimMember(roomCode, m.id))}
                  className="btn-soft min-h-9 px-4"
                >
                  {m.nickname}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state?.error && (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {state.error}
        </p>
      )}
    </div>
  );
}
