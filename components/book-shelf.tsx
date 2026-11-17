import { ShelfBook } from "./shelf-book";
import { ShelfPlant } from "./shelf-plant";
import type { RoomMedia } from "@/lib/types";

const COLS = 6; // 6 cells per row on desktop (3 on phones)
const PER_ROW = COLS - 1; // 5 items, plus one flower pot at the end of every row

/**
 * One themed shelf. Two themes (set by the shelf's kind):
 * - `book`: warm wooden boards, warm light under each cover at night.
 * - `tv`:   painted pastel boards with a film-strip edge, cool light under each cover.
 *
 * Every cell draws its own board segment, so boards join into one continuous plank at
 * any column count. The last cell of each row holds a mini flower pot. At night each
 * cover gets its own soft glow from underneath (CSS only, see `cover-glow`).
 */
export function BookShelf({
  variant,
  items,
  hrefFor,
}: {
  variant: "book" | "tv";
  items: { media: RoomMedia; progressLabel: string }[];
  hrefFor: (mediaId: string) => string;
}) {
  const rows = Math.max(1, Math.ceil(items.length / PER_ROW));
  let next = 0;

  return (
    <ul className={`grid grid-cols-3 gap-y-8 md:grid-cols-6 ${variant === "book" ? "shelf-light-warm" : "shelf-light-cool"}`}>
      {Array.from({ length: rows * COLS }, (_, i) => {
        const isPlant = i % COLS === COLS - 1;
        const row = Math.floor(i / COLS);
        const item = isPlant ? undefined : items[next++];

        return (
          <li key={item?.media.id ?? `${isPlant ? "plant" : "empty"}-${i}`} className="relative min-w-0">
            {item ? (
              <ShelfBook
                href={hrefFor(item.media.id)}
                title={item.media.title}
                coverUrl={item.media.cover_url}
                mediaType={item.media.media_type}
                progressLabel={item.progressLabel}
              />
            ) : (
              <div aria-hidden="true" className="px-3 pt-5">
                <div className="flex aspect-[2/3] items-end justify-center">
                  {isPlant && (
                    <div className="h-[46%] w-[72%]">
                      <ShelfPlant kind={(row % 3) as 0 | 1 | 2} theme={variant} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              aria-hidden="true"
              className={`shelf-board ${variant === "book" ? "shelf-board-wood" : "shelf-board-film"}`}
            />

            <p className="mt-2 truncate px-2 text-center text-xs text-muted">
              {item?.media.title ?? " "}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
