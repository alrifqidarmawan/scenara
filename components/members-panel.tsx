"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Crown, Eye, KeyRound, PenLine } from "lucide-react";
import { claimOwnership, setMemberRole } from "@/lib/actions";
import type { MemberRole } from "@/lib/types";
import { Spinner } from "./skeleton";

export interface PanelMember {
  id: string;
  nickname: string;
  role: MemberRole;
  isYou: boolean;
}

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  collaborator: "Collaborator",
  viewer: "Viewer",
};

/**
 * Who is in the room and what they may do (CLAUDE.md §6H). The owner can promote a viewer
 * to collaborator (and back) and can copy the owner key; everyone else just sees the roles.
 */
export function MembersPanel({
  roomCode,
  members,
  isOwner,
  ownerKey,
  roomHasOwner,
}: {
  roomCode: string;
  members: PanelMember[];
  isOwner: boolean;
  ownerKey: string | null;
  /** False for rooms made before roles existed: any member may claim them once. */
  roomHasOwner: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [claiming, startClaim] = useTransition();
  const [, startRole] = useTransition();

  function changeRole(id: string, role: "collaborator" | "viewer") {
    setBusyId(id);
    setError(null);
    startRole(async () => {
      const result = await setMemberRole(roomCode, id, role);
      if (result.error) setError(result.error);
      setBusyId(null);
    });
  }

  async function copyKey() {
    if (!ownerKey) return;
    try {
      await navigator.clipboard.writeText(ownerKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy. Select the key and copy it by hand.");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="eyebrow">In this room · {members.length}</h2>
      <ul className="space-y-2">
        {members.map((m) => {
          const Icon = m.role === "owner" ? Crown : m.role === "collaborator" ? PenLine : Eye;
          const canChange = isOwner && m.role !== "owner";
          return (
            <li
              key={m.id}
              className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm ${
                m.isYou ? "border-brand/40 bg-brand-soft/60 text-brand-ink" : "border-line bg-cream"
              }`}
            >
              <span className="font-medium">
                {m.nickname}
                {m.isYou && <span className="font-normal opacity-70"> (you)</span>}
              </span>
              <span className="chip bg-paper text-muted ring-1 ring-line">
                <Icon className="h-3 w-3" aria-hidden="true" />
                {ROLE_LABEL[m.role]}
              </span>
              {canChange && (
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => changeRole(m.id, m.role === "collaborator" ? "viewer" : "collaborator")}
                  className="btn-soft ml-auto min-h-8 px-3 text-xs"
                >
                  {busyId === m.id && <Spinner className="h-3 w-3" />}
                  {m.role === "collaborator" ? "Make viewer" : "Make collaborator"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {isOwner && (
        <p className="text-xs text-muted">
          Viewers can read and move their own progress. Collaborators can also add books and shows, write entries and
          comments, and manage shelves.
        </p>
      )}

      {isOwner && ownerKey && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <KeyRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Owner key</p>
            <p className="text-xs text-muted">Keep it private. Enter it on another device to manage this room.</p>
            <code className="mt-1 block truncate font-mono text-sm">{ownerKey}</code>
          </div>
          <button type="button" onClick={copyKey} className="btn-soft min-h-9 px-4">
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {!roomHasOwner && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <p className="min-w-0 flex-1 text-sm text-muted">
            This room has no owner yet. Claim it to manage who can edit.
          </p>
          <button
            type="button"
            disabled={claiming}
            onClick={() =>
              startClaim(async () => {
                const result = await claimOwnership(roomCode);
                if (result.error) setError(result.error);
              })
            }
            className="btn-primary min-h-9 px-4"
          >
            {claiming && <Spinner />}
            Claim room
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-2 text-sm text-blush-ink">
          {error}
        </p>
      )}
    </section>
  );
}
