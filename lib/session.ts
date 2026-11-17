import "server-only";
import { cookies } from "next/headers";

/**
 * Member identity (CLAUDE.md §6B). A per-room httpOnly cookie holds the
 * `room_members.id`. It is a cookie rather than localStorage so Server
 * Components can read it and gate spoilers before anything is sent to the browser.
 */
const ONE_YEAR = 60 * 60 * 24 * 365;

const cookieName = (roomCode: string) => `scenara_member_${roomCode}`;

export async function readMemberId(roomCode: string): Promise<string | undefined> {
  return (await cookies()).get(cookieName(roomCode))?.value;
}

/** Only callable from a Server Action or Route Handler. */
export async function writeMemberId(roomCode: string, memberId: string): Promise<void> {
  (await cookies()).set(cookieName(roomCode), memberId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}
