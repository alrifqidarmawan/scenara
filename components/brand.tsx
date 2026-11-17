import Link from "next/link";

/** Wordmark used in every page header. */
export function Brand({ href = "/", badge }: { href?: string; badge?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-peach font-display text-lg leading-none"
      >
        s
      </span>
      <span className="font-display text-xl tracking-tight">Scenara</span>
      {badge && <span className="chip bg-butter text-butter-ink">{badge}</span>}
    </Link>
  );
}
