import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (CLAUDE.md §4).
 *
 * NEVER import this from a client component — it holds the service role key,
 * which bypasses all row-level security. All reads/writes happen in Server
 * Components, Server Actions, or `/api/*` Route Handlers.
 *
 * Uses the service role key on purpose: v1 has no Supabase Auth, so there is
 * no end-user session to scope queries with.
 */

let client: SupabaseClient | null = null;

export const SETUP_HINT =
  "Supabase isn't configured yet. Copy .env.example to .env.local and fill in " +
  "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.";

/** True when both Supabase env vars are present. Lets pages show a friendly setup hint instead of throwing. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Lazily create and reuse a single service-role client. */
export function getSupabase(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("lib/supabase-server.ts must never run in the browser.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(SETUP_HINT);
  }

  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
}
