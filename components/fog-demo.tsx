import { Lock } from "lucide-react";

type Entry =
  | { kind: "open"; anchor: string; tag: string; author: string; title: string; body: string }
  | { kind: "gated"; step: 1 | 2; anchor: string; tag: string; author: string; title: string; body: string }
  | { kind: "locked"; anchor: string; author: string };

const ENTRIES: Entry[] = [
  { kind: "open", anchor: "Ep 1", tag: "note", author: "Sarah", title: "That opening song", body: "Already stuck in my head. The waffle party feels like a clue." },
  { kind: "gated", step: 1, anchor: "Ep 4", tag: "theory", author: "Alex", title: "The break room theory", body: "It isn't a room at all. It's a protocol." },
  { kind: "gated", step: 2, anchor: "Ep 5", tag: "review", author: "Alex", title: "The dinner party", body: "Genuinely unhinged. I had to pause twice to breathe." },
  { kind: "locked", anchor: "Ep 8", author: "Sarah" },
];

const TAG_STYLE: Record<string, string> = {
  note: "bg-paper text-muted ring-1 ring-line",
  theory: "bg-lavender text-lavender-ink",
  review: "bg-sky text-sky-ink",
};

function LockedCard({ anchor, author }: { anchor: string; author: string }) {
  return (
    <div className="h-full rounded-2xl border border-dashed border-butter-ink/30 bg-butter/60 p-3.5">
      <p className="flex items-start gap-2 text-sm font-medium text-butter-ink">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Locked until <b>{anchor}</b> · {author}
        </span>
      </p>
      <div aria-hidden="true" className="mt-3 space-y-2 opacity-40 blur-[3px]">
        <div className="h-2.5 w-11/12 rounded-full bg-butter-ink/40" />
        <div className="h-2.5 w-6/12 rounded-full bg-butter-ink/40" />
      </div>
    </div>
  );
}

function OpenCard({ e }: { e: Extract<Entry, { kind: "open" | "gated" }> }) {
  return (
    <div className="h-full rounded-2xl border border-line bg-cream p-3.5 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="chip bg-brand-soft text-brand-ink">{e.anchor}</span>
        <span className={`chip ${TAG_STYLE[e.tag]}`}>{e.tag}</span>
        <span className="ml-auto text-xs text-muted">{e.author}</span>
      </div>
      <p className="mt-2 font-display text-base leading-snug">{e.title}</p>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted">{e.body}</p>
    </div>
  );
}

/**
 * Looping, pure-CSS illustration of the product idea: sliding your progress
 * forward unlocks friends' notes. Decorative, so it is hidden from assistive tech.
 */
export function FogDemo() {
  return (
    <div
      aria-hidden="true"
      className="reveal relative mx-auto w-full max-w-md select-none lg:mx-0 lg:justify-self-end xl:max-w-xl 2xl:max-w-[44rem]"
      style={{ "--d": "0.35s" } as React.CSSProperties}
    >
      <span
        className="float chip absolute -top-4 -left-4 z-10 hidden bg-brand-soft px-3 py-1.5 text-brand-ink shadow-soft sm:inline-flex"
        style={{ "--r": "-6deg" } as React.CSSProperties}
      >
        📚 Dune · p. 120
      </span>
      <span
        className="float chip absolute -right-5 bottom-24 z-10 hidden bg-sage px-3 py-1.5 text-sage-ink shadow-soft sm:inline-flex"
        style={{ "--r": "5deg", "--d": "-2s" } as React.CSSProperties}
      >
        🎬 Ep 5 ✓
      </span>

      <div className="card relative bg-cream/70! p-5 backdrop-blur-md sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-glow font-display text-lg text-on-brand shadow-soft">
            S
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight">Severance</p>
            <p className="text-xs text-muted">Season 1 · 9 episodes</p>
          </div>
          <div className="relative h-7 w-20 text-right font-display text-xl tabular-nums">
            <span className="fog-label-a absolute inset-y-0 right-0">Ep 2</span>
            <span className="fog-label-m absolute inset-y-0 right-0">Ep 4</span>
            <span className="fog-label-b absolute inset-y-0 right-0 text-brand-ink">Ep 5</span>
          </div>
        </div>

        <div className="relative mt-5 h-2 rounded-full bg-line">
          <div className="fog-fill absolute inset-y-0 left-0 rounded-full bg-brand" />
          <div className="fog-thumb absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-cream bg-brand shadow-soft" />
        </div>

        <ul className="mt-5 space-y-2.5">
          {ENTRIES.map((e) => (
            <li key={e.anchor} className="relative h-[104px]">
              {e.kind === "open" && <OpenCard e={e} />}
              {e.kind === "locked" && <LockedCard anchor={e.anchor} author={e.author} />}
              {e.kind === "gated" && (
                <>
                  <div className={`absolute inset-0 ${e.step === 1 ? "fog-locked-1" : "fog-locked-2"}`}>
                    <LockedCard anchor={e.anchor} author={e.author} />
                  </div>
                  <div className={`absolute inset-0 ${e.step === 1 ? "fog-open-1" : "fog-open-2"}`}>
                    <OpenCard e={e} />
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="fog-toast absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-sage-ink/15 bg-sage px-4 py-2 text-xs font-medium whitespace-nowrap text-sage-ink shadow-soft">
          ✨ Unlocked 2 new notes!
        </div>
      </div>
    </div>
  );
}
