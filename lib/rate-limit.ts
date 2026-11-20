import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getSupabase } from "./supabase-server";

/**
 * Rate limiting (CLAUDE.md §4). No login and no extra service: counts live in the
 * `rate_events` table via the SQL function `rate_hit`. It fails OPEN: if the database
 * can't answer (e.g. schema not updated yet) the action is allowed rather than broken.
 */
export const TOO_FAST = "You're going a bit fast. Wait a moment and try again.";

/** A stable, privacy-friendly key for the caller's network address. */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/** True when the action may go ahead; false once `key` hit `max` within `windowSeconds`. */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("rate_hit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data !== false;
}

/** Limit per network address, e.g. `await ipLimit("join", 20, 3600)`. */
export async function ipLimit(action: string, max: number, windowSeconds: number): Promise<boolean> {
  return rateLimit(`ip:${await clientKey()}:${action}`, max, windowSeconds);
}

/** Limit per member for everything they write (entries, comments, replies, items). */
export async function writeLimit(memberId: string): Promise<boolean> {
  return rateLimit(`w:${memberId}`, 30, 60);
}
