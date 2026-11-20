import { Loader2 } from "lucide-react";

/** A quiet placeholder block. Size and shape come from `className`. Decorative only. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-xl ${className}`} />;
}

/** Small spinner for buttons and inline waits. */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden="true" />;
}
