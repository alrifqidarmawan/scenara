/** Small floating status pill — used for "Unlocked N new notes!" (CLAUDE.md §6A). */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-sage-ink/15 bg-sage px-5 py-2.5 text-sm font-medium text-sage-ink shadow-soft"
    >
      ✨ {message}
    </div>
  );
}

export function unlockMessage(n: number): string {
  return `Unlocked ${n} new note${n === 1 ? "" : "s"}!`;
}
