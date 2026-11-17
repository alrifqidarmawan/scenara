import { z } from "zod";
import { searchBooks, searchTvSeries } from "@/lib/media-api";

/**
 * Server proxy for Open Library (books) and TMDB (TV).
 * Keeps TMDB_API_KEY server-side only — it is never prefixed with NEXT_PUBLIC_
 * and never sent to the browser (CLAUDE.md §4).
 *
 *   GET /api/search?q=severance&type=tv
 */

const searchParamsSchema = z.object({
  q: z.string().min(2, "Type at least 2 characters.").max(120),
  type: z.enum(["tv", "book"]),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = searchParamsSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    type: url.searchParams.get("type") ?? "book",
  });

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid search." },
      { status: 400 },
    );
  }

  const query = parsed.data.q.trim();
  if (!query) {
    return Response.json({ error: "Type at least 2 characters." }, { status: 400 });
  }

  try {
    if (parsed.data.type === "tv") {
      return Response.json({ results: await searchTvSeries(query) });
    }
    // Books hit Open Library and Google Books together; `status` says who answered.
    const { results, status } = await searchBooks(query);
    return Response.json({ results, status });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Search failed." },
      { status: 502 },
    );
  }
}
