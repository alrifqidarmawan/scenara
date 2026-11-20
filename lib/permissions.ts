import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentMember } from "./data";
import type { Room, RoomMember } from "./types";

/**
 * Roles (CLAUDE.md §6H). There is no login, so ownership is proven with a secret
 * owner key: only its SHA-256 lives in `rooms.owner_key_hash`; the key itself sits in an
 * httpOnly cookie on the owner's device (and can be re-entered on another device).
 * The link alone never grants it.
 */
const ONE_YEAR = 60 * 60 * 24 * 365;
const ownerCookie = (roomCode: string) => `scenara_owner_${roomCode}`;

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** e.g. `k7f3-9mqa-x2pd-r8tw` — easy to copy and type. */
export function generateOwnerKey(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

const normalizeKey = (key: string) => key.trim().toLowerCase();

export function keyMatches(room: Room, key: string | undefined): boolean {
  if (!room.owner_key_hash || !key) return false;
  const a = Buffer.from(hashKey(normalizeKey(key)));
  const b = Buffer.from(room.owner_key_hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function readOwnerKey(roomCode: string): Promise<string | undefined> {
  return (await cookies()).get(ownerCookie(roomCode))?.value;
}

/** Only callable from a Server Action or Route Handler. */
export async function writeOwnerKey(roomCode: string, key: string): Promise<void> {
  (await cookies()).set(ownerCookie(roomCode), normalizeKey(key), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

/** Editing an item itself (pages, shelf): its adder and the owner. Older items have no adder. */
export function canEditMedia(access: Access, media: { added_by: string | null }): boolean {
  return access.isOwner || (access.canEdit && (media.added_by === null || media.added_by === access.member.id));
}

export interface Access {
  member: RoomMember;
  /** Holds the owner key AND is the owner's member row. */
  isOwner: boolean;
  /** May add media, write entries and comments, manage shelves. */
  canEdit: boolean;
  /** The owner key, only for the owner (so they can copy it). */
  ownerKey: string | null;
}

/** The current member plus what they may do. Null when not joined. */
export async function getAccess(room: Room): Promise<Access | null> {
  const member = await getCurrentMember(room);
  if (!member) return null;
  const key = await readOwnerKey(room.code);
  const isOwner = member.role === "owner" && keyMatches(room, key);
  return {
    member,
    isOwner,
    canEdit: isOwner || member.role === "collaborator",
    ownerKey: isOwner && key ? key : null,
  };
}
