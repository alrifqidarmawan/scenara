import Link from "next/link";
import { Cover } from "./cover";
import { LinkPending } from "./link-pending";
import type { MediaType } from "@/lib/types";

/**
 * One item on the shelf. Pure CSS 3D, no JS:
 * - book: on hover/focus the cover swings open on its left hinge and the
 *   page shows the reader's own progress.
 * - tv:   tilts like a poster case with a soft sheen.
 */
export function ShelfBook({
  href,
  title,
  coverUrl,
  mediaType,
  progressLabel,
}: {
  href: string;
  title: string;
  coverUrl: string | null;
  mediaType: MediaType;
  progressLabel: string;
}) {
  const isBook = mediaType === "book";

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={`Open ${title}`}
      className="group relative block rounded-lg px-3 pt-5 outline-none"
    >
      {/* Night only: a soft pool of light under this cover (see globals.css) */}
      <span aria-hidden="true" className="cover-halo" />
      <span aria-hidden="true" className="cover-glow" />
      <LinkPending className="rounded-lg" />
      <div className="relative [perspective:1100px]">
        <div
          className={`relative aspect-[2/3] transition-transform duration-500 ease-out [transform-style:preserve-3d] ${
            isBook
              ? "group-hover:[transform:translateY(-6px)_rotateY(-12deg)] group-focus-visible:[transform:translateY(-6px)_rotateY(-12deg)]"
              : "group-hover:[transform:translateY(-8px)_rotateY(-18deg)_rotateX(5deg)] group-focus-visible:[transform:translateY(-8px)_rotateY(-18deg)_rotateX(5deg)]"
          }`}
        >
          {isBook && (
            <div
              aria-hidden="true"
              className="absolute inset-y-[2%] right-[-3%] left-[4%] flex items-center justify-center rounded-r-md bg-cream shadow-[2px_0_0_var(--line),4px_0_0_var(--wood)]"
            >
              <span className="font-display text-lg text-muted">{progressLabel}</span>
            </div>
          )}

          <div
            className={`absolute inset-0 overflow-hidden rounded-r-lg rounded-l-sm shadow-[0_6px_14px_-6px_rgb(0_0_0/0.4)] transition-transform duration-500 ease-out ${
              isBook
                ? "origin-left group-hover:[transform:rotateY(-58deg)] group-focus-visible:[transform:rotateY(-58deg)]"
                : ""
            }`}
          >
            <Cover
              url={coverUrl}
              title={title}
              mediaType={mediaType}
              className="h-full w-full !rounded-none"
            />
            {/* spine shading */}
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-[8%] bg-gradient-to-r from-black/25 to-transparent"
            />
            {!isBook && (
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
