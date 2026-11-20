import Image from "next/image";
import { BookOpen, Film, Tv } from "lucide-react";
import type { MediaType } from "@/lib/types";

/**
 * Cover art with a soft fallback when the API returned no image.
 * `unoptimized`: covers are tiny and already CDN-hosted; skipping Vercel's
 * image optimizer keeps us inside the Hobby plan's source-image quota.
 */
export function Cover({
  url,
  title,
  mediaType,
  className = "h-14 w-10",
}: {
  url: string | null;
  title: string;
  mediaType: MediaType;
  className?: string;
}) {
  if (!url) {
    const Icon = mediaType === "book" ? BookOpen : mediaType === "movie" ? Film : Tv;
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink ${className}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={`Cover of ${title}`}
      width={80}
      height={112}
      unoptimized
      className={`shrink-0 rounded-xl object-cover ${className}`}
    />
  );
}
