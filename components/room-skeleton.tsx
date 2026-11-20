import { Skeleton } from "./skeleton";

/** Shape of the room page while it loads: title, shelf tabs, one row of covers. */
export function RoomSkeleton() {
  return (
    <div role="status" aria-label="Loading room">
      <div className="border-b border-line bg-cream/70">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-9 w-[4.5rem] rounded-full" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10">
        <section className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </section>
        <section className="space-y-5">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
          <ShelfRowSkeleton />
        </section>
      </main>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** One row of covers standing on a board. */
export function ShelfRowSkeleton() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3 px-3 sm:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className={`aspect-[2/3] rounded-r-lg rounded-l-sm ${i > 2 ? "hidden sm:block" : ""}`} />
        ))}
      </div>
      <Skeleton className="h-3 w-full rounded-full" />
    </div>
  );
}

/** Stand-in for the media modal while its entries load. */
export function ModalSkeleton() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" role="status" aria-label="Loading">
      <div className="card flex max-h-[90vh] w-full max-w-4xl flex-col gap-6 overflow-hidden p-6 sm:flex-row">
        <div className="w-full shrink-0 space-y-4 sm:w-64">
          <Skeleton className="aspect-[2/3] w-full" />
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
