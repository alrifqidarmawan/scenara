/**
 * Mini flower pots that stand on the shelf boards (decoration only).
 * Original, simple vector drawings. Colours are fixed illustration colours.
 * Three kinds, picked by row so neighbouring rows differ. `theme` swaps the pot:
 * terracotta on the wooden book shelf, pastel on the painted show shelf.
 */
type Kind = 0 | 1 | 2;

const POTS = {
  book: { body: "#dca182", rim: "#e9b79b", shade: "#c98966" },
  tv: { body: "#a9bde8", rim: "#c2d0f0", shade: "#8fa6d9" },
} as const;

export function ShelfPlant({ kind, theme }: { kind: Kind; theme: "book" | "tv" }) {
  const pot = POTS[theme];
  return (
    <svg viewBox="0 0 64 80" className="h-full w-full overflow-visible" aria-hidden="true">
      {/* leaves + flowers sway gently from the pot */}
      <g className="sway" style={{ transformOrigin: "32px 56px" }}>
        {kind === 0 && (
          // daisies
          <>
            <path d="M32 56 C32 44 30 34 26 24 M32 56 C33 46 38 38 44 30 M32 56 C32 48 33 42 34 34" stroke="#7fb28a" strokeWidth="2" fill="none" strokeLinecap="round" />
            <ellipse cx="22" cy="46" rx="6" ry="3" fill="#9ccaa3" transform="rotate(-25 22 46)" />
            <ellipse cx="43" cy="47" rx="6" ry="3" fill="#9ccaa3" transform="rotate(25 43 47)" />
            {[[26, 22], [44, 28], [34, 31]].map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`}>
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <ellipse key={a} cx="0" cy="-5" rx="2.6" ry="4.4" fill="#fffaf0" transform={`rotate(${a})`} />
                ))}
                <circle r="2.8" fill="#f6c453" />
              </g>
            ))}
          </>
        )}
        {kind === 1 && (
          // tulips
          <>
            <path d="M28 56 C27 46 26 38 26 28 M37 56 C38 46 40 38 41 30" stroke="#7fb28a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M26 50 C18 46 16 40 17 34 C22 38 25 43 27 50Z" fill="#9ccaa3" />
            <path d="M38 50 C46 47 48 41 47 36 C42 39 39 44 37 50Z" fill="#9ccaa3" />
            <path d="M20 28 C20 20 23 17 26 17 C29 17 32 20 32 28 C29 31 23 31 20 28Z" fill="#9db4ea" />
            <path d="M23 20 L26 25 L29 20" fill="#c4d2f4" />
            <path d="M35 30 C35 22 38 19 41 19 C44 19 47 22 47 30 C44 33 38 33 35 30Z" fill="#b7c4f0" />
            <path d="M38 22 L41 27 L44 22" fill="#d6defa" />
          </>
        )}
        {kind === 2 && (
          // succulent with one tiny flower
          <>
            {[-50, -25, 0, 25, 50].map((a) => (
              <path key={a} d="M32 56 C26 48 27 36 32 30 C37 36 38 48 32 56Z" fill={a === 0 ? "#8fc09a" : "#a6d0ae"} transform={`rotate(${a} 32 56)`} />
            ))}
            <path d="M32 56 C32 44 32 36 32 26" stroke="#7fb28a" strokeWidth="2" fill="none" strokeLinecap="round" />
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="32" cy="21" rx="2.4" ry="3.6" fill="#9db4ea" transform={`rotate(${a} 32 24)`} />
            ))}
            <circle cx="32" cy="24" r="2" fill="#f6c453" />
          </>
        )}
      </g>
      {/* pot */}
      <path d="M17 56 H47 L43 76 Q42 78 40 78 H24 Q22 78 21 76 Z" fill={pot.body} />
      <path d="M17 56 H47 L46 60 H18 Z" fill={pot.rim} />
      <path d="M21 76 Q22 78 24 78 H40 Q42 78 43 76 L44 70 H20 Z" fill={pot.shade} opacity="0.35" />
    </svg>
  );
}
