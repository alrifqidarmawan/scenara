"use client";

import { useActionState, useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { claimMember, joinRoom, recoverOwner, type ActionState } from "@/lib/actions";
import { Spinner } from "./skeleton";

const initialState: ActionState = {};

/** Frictionless identity (CLAUDE.md §6B): pick a nickname, or reclaim an existing one. */
export function JoinRoom({
  roomCode,
  members,
}: {
  roomCode: string;
  members: { id: string; nickname: string }[];
}) {
  const [state, formAction, pending] = useActionState(joinRoom, initialState);
  const [claiming, startClaim] = useTransition();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [recovering, startRecover] = useTransition();
  const [keyOpen, setKeyOpen] = useState(false);
  const [ownerKey, setOwnerKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

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
                  onClick={() => {
                    setClaimingId(m.id);
                    setClaimError(null);
                    startClaim(async () => {
                      const result = await claimMember(roomCode, m.id);
                      if (result.error) setClaimError(result.error);
                    });
                  }}
                  className="btn-soft min-h-9 px-4"
                >
                  {claiming && claimingId === m.id && <Spinner className="h-3.5 w-3.5" />}
                  {m.nickname}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-line pt-4">
        {keyOpen ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              setKeyError(null);
              startRecover(async () => {
                const result = await recoverOwner(roomCode, ownerKey);
                if (result.error) setKeyError(result.error);
              });
            }}
          >
            <label htmlFor="owner-key" className="eyebrow block">
              Owner key
            </label>
            <div className="flex gap-2">
              <input
                id="owner-key"
                value={ownerKey}
                onChange={(e) => setOwnerKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                className="input font-mono"
              />
              <button type="submit" disabled={recovering || !ownerKey.trim()} className="btn-primary shrink-0">
                {recovering && <Spinner />}
                Use key
              </button>
            </div>
            {keyError && (
              <p role="alert" className="text-sm text-blush-ink">
                {keyError}
              </p>
            )}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setKeyOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            I&apos;m the room owner
          </button>
        )}
      </div>

      {claimError && (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {claimError}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {state.error}
        </p>
      )}
    </div>
  );
}
