"use client";

import { useState } from "react";
import { Cover } from "./cover";
import { MediaInfo } from "./media-info";
import type { RoomMedia } from "@/lib/types";

/**
 * Big cover for the modal. Hover (or keyboard focus, or a click/tap) slides the
 * book's details over the cover. Phones also get the details as a section below.
 */
export function CoverInfo({ media }: { media: RoomMedia }) {
  const [pinned, setPinned] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setPinned((p) => !p)}
      aria-expanded={pinned}
      aria-label={`About ${media.title}`}
      className="group relative block w-full rounded-xl text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-peach-deep"
    >
      <Cover
        url={media.cover_url}
        title={media.title}
        mediaType={media.media_type}
        className="aspect-[2/3] h-auto w-full shadow-[0_16px_32px_-12px_rgb(90_60_30/0.55)]"
      />
      <div
        className={`absolute inset-0 overflow-y-auto rounded-xl border border-line bg-cream/95 p-4 backdrop-blur-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 ${
          pinned ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <MediaInfo media={media} />
      </div>
    </button>
  );
}
