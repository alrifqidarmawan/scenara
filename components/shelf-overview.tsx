import Link from "next/link";
import { BookOpen, ChevronRight, Tv } from "lucide-react";
import { Cover } from "./cover";
import { ShelfPlant } from "./shelf-plant";
import type { RoomMedia, Shelf } from "@/lib/types";

const MAX_COVERS = 9;

/**
 * "Zoomed out": every shelf as one row, with its name and a strip of mini covers on its
 * own board. Each row links to that shelf (zoom in). Server component, CSS only.
 */
export function ShelfOverview({
  roomCode,
  shelves,
  itemsByShelf,
}: {
  roomCode: string;
  shelves: Shelf[];
  itemsByShelf: Record<string, RoomMedia[]>;
}) {
  return (
    <ul className="space-y-5">
      {shelves.map((shelf, row) => {
        const items = itemsByShelf[shelf.id] ?? [];
        const shown = items.slice(0, MAX_COVERS);
        const more = items.length - shown.length;
        const Icon = shelf.kind === "book" ? BookOpen : Tv;

        return (
          <li key={shelf.id}>
            <Link
              href={`/room/${roomCode}?shelf=${shelf.id}`}
              scroll={false}
              className={`group block rounded-3xl border border-line bg-cream/60 p-4 pb-5 transition duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                shelf.kind === "book" ? "shelf-light-warm" : "shelf-light-cool"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
                <h3 className="font-display text-lg">{shelf.name}</h3>
                <span className="chip bg-paper text-muted ring-1 ring-line">{items.length}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted transition group-hover:text-ink">
                  Open
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </div>

              <div className="mt-4 flex items-end gap-3 overflow-hidden px-1">
                {shown.map((m) => (
                  <span key={m.id} className="relative block h-24 w-16 shrink-0">
                    <span aria-hidden="true" className="cover-halo" />
                    <span aria-hidden="true" className="cover-glow" />
                    <Cover url={m.cover_url} title={m.title} mediaType={m.media_type} className="h-24 w-16 shadow-[0_6px_12px_-6px_rgb(0_0_0/0.4)]" />
                  </span>
                ))}
                {more > 0 && <span className="mb-1 shrink-0 text-sm text-muted">+{more}</span>}
                {items.length === 0 && <span className="mb-2 text-sm text-muted">Empty shelf</span>}
                <span aria-hidden="true" className="ml-auto block h-16 w-12 shrink-0">
                  <ShelfPlant kind={(row % 3) as 0 | 1 | 2} theme={shelf.kind} />
                </span>
              </div>
              <div
                aria-hidden="true"
                className={`shelf-board -mx-4 ${shelf.kind === "book" ? "shelf-board-wood" : "shelf-board-film"}`}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
