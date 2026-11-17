import type { RoomMedia } from "@/lib/types";

/** True when there is anything worth showing besides the title. */
export function hasInfo(media: RoomMedia): boolean {
  return Boolean(media.creator || media.year || media.genres || media.description || media.total_pages);
}

/** Details saved when the media was added: creator, year, length, genres, description. */
export function MediaInfo({ media }: { media: RoomMedia }) {
  const facts = [
    media.creator,
    media.year ? String(media.year) : null,
    media.media_type === "book" && media.total_pages ? `${media.total_pages} pages` : null,
    media.media_type === "tv" ? `${media.total_units} episodes` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-2">
      <h3 className="font-display text-lg leading-snug">{media.title}</h3>
      {facts.length > 0 && <p className="text-xs font-medium text-ink/80">{facts.join(" · ")}</p>}
      {media.genres && (
        <ul className="flex flex-wrap gap-1">
          {media.genres.split(",").map((g) => (
            <li key={g} className="chip bg-lavender text-lavender-ink">
              {g.trim()}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs leading-5 text-muted">{media.description ?? "No description saved for this one."}</p>
    </div>
  );
}
