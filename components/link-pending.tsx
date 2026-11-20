"use client";

import { useLinkStatus } from "next/link";

/**
 * Put inside a `<Link>`: while that link's page is loading it shows a soft pulse over
 * the link, so a click always gives instant feedback.
 */
export function LinkPending({ className = "rounded-lg" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`skeleton pointer-events-none absolute inset-0 z-10 transition-opacity duration-200 ${className} ${
        pending ? "opacity-60" : "opacity-0"
      }`}
    />
  );
}
