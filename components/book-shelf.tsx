import { ShelfBook } from "./shelf-book";
import type { RoomMedia } from "@/lib/types";

const PER_ROW = 6;

/**
 * Wooden shelves: 6 per row on desktop (3 on phones). Every cell draws its own
 * plank segment, so planks join into one continuous board at any column count.
 * Empty slots are padded so unfinished rows still look like a shelf.
 */
export function BookShelf({
  items,
  hrefFor,
}: {
  items: { media: RoomMedia; progressLabel: string }[];
  hrefFor: (mediaId: string) => string;
}) {
  const slots = Math.max(PER_ROW, Math.ceil(items.length / PER_ROW) * PER_ROW);

  return (
    <ul className="grid grid-cols-3 gap-y-6 md:grid-cols-6">
      {Array.from({ length: slots }, (_, i) => {
        const item = items[i];
        return (
          <li key={item?.media.id ?? `empty-${i}`} className="min-w-0">
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
                <div className="aspect-[2/3]" />
              </div>
            )}
            <div
              aria-hidden="true"
              className="-mt-0.5 h-3 bg-gradient-to-b from-wood to-wood-deep shadow-[0_3px_6px_-3px_rgb(90_60_30/0.35)]"
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
