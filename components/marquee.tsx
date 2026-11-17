const ITEMS = [
  { icon: "📚", title: "Dune", at: "p. 120" },
  { icon: "🎬", title: "Severance", at: "Ep 5" },
  { icon: "📖", title: "Emma", at: "42%" },
  { icon: "🎬", title: "The Bear", at: "Ep 3" },
  { icon: "📚", title: "Piranesi", at: "p. 88" },
  { icon: "🎬", title: "Shogun", at: "Ep 7" },
  { icon: "📖", title: "Laskar Pelangi", at: "p. 210" },
  { icon: "🎬", title: "Arcane", at: "Ep 2" },
  { icon: "📚", title: "Atomic Habits", at: "p. 150" },
  { icon: "🎬", title: "Andor", at: "Ep 9" },
];

/**
 * Edge-to-edge strip of what friends are reading and watching. Pure CSS: the list is
 * rendered twice and the track slides by half its width, so the loop is seamless.
 * Decorative only; hidden from assistive tech. Stops under reduced motion.
 */
export function Marquee() {
  return (
    <div
      aria-hidden="true"
      className="group relative overflow-hidden border-y border-line bg-cream/50 py-4 backdrop-blur [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
    >
      <div className="marquee flex w-max gap-3 group-hover:[animation-play-state:paused]">
        {[...ITEMS, ...ITEMS].map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-4 py-2 text-sm shadow-soft"
          >
            <span>{item.icon}</span>
            <span className="font-display">{item.title}</span>
            <span className="chip bg-brand-soft text-brand-ink">{item.at}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
