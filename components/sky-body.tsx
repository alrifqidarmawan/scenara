/**
 * The big sun / moon on the page background (CLAUDE.md §8).
 *
 * Light mode: a glowing sun in the top-left corner. Dark mode: a glowing moon in the
 * top-right corner. Switching theme sends the orb across the sky in an arc, turning
 * from sun into moon (and back). The resting state comes from the `dark` class (CSS);
 * the journey itself is played by components/theme-toggle.tsx (`data-sky` parts).
 *
 * Decorative and purely visual: pointer-events none, hidden from assistive tech, and
 * always behind the page content.
 */
export function SkyBody() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div data-sky="slide" className="sky-orb absolute">
        <div data-sky="arc" className="relative h-full w-full">
          {/* Sun: soft halo, slowly turning rays, warm body */}
          <div data-sky="sun" className="absolute inset-0 dark:scale-50 dark:rotate-90 dark:opacity-0">
            <span className="sky-halo-sun absolute -inset-[65%] rounded-full" />
            <span className="sky-rays absolute -inset-[55%] rounded-full" />
            <span className="sky-sun absolute inset-0 rounded-full" />
          </div>
          {/* Moon: cool halo, pale body with craters */}
          <div data-sky="moon" className="absolute inset-0 scale-50 -rotate-90 opacity-0 dark:scale-100 dark:rotate-0 dark:opacity-100">
            <span className="sky-halo-moon absolute -inset-[65%] rounded-full" />
            <span className="sky-moon absolute inset-0 rounded-full">
              <i className="absolute top-[20%] left-[26%] h-[14%] w-[14%] rounded-full bg-[#b9c4ea]/70" />
              <i className="absolute top-[50%] left-[58%] h-[20%] w-[20%] rounded-full bg-[#b9c4ea]/60" />
              <i className="absolute top-[66%] left-[22%] h-[10%] w-[10%] rounded-full bg-[#b9c4ea]/60" />
              <i className="absolute top-[28%] left-[62%] h-[8%] w-[8%] rounded-full bg-[#b9c4ea]/60" />
            </span>
            <StargazerPrince />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A tiny golden-haired boy with a long scarf, standing on the moon's upper-left shoulder and
 * looking up at a twinkling star. An original drawing inspired by the story of the little
 * prince, not a copy of any published artwork. Feet sit on the rim; the whole figure is
 * rotated to follow the curve. Only the scarf moves.
 */
function StargazerPrince() {
  return (
    <svg
      viewBox="0 0 44 64"
      className="absolute w-[25%] overflow-visible"
      style={{ left: "17%", top: "14%", transform: "translate(-50%, -96%) rotate(-42deg)", transformOrigin: "50% 100%" }}
    >
      {/* scarf (waves in the moonlight) */}
      <g className="scarf">
        <path d="M20 31 C27 30 33 33 40 30 C37 35 31 36 25 35 C30 38 36 38 41 37 C36 42 28 41 21 36Z" fill="#f2b84b" />
        <path d="M20 31 C27 30 33 33 40 30" stroke="#fff1c4" strokeWidth="1" fill="none" opacity="0.7" />
      </g>
      {/* legs + boots */}
      <path d="M16 48 V56 M24 48 V56" stroke="#e7cdb0" strokeWidth="3.2" strokeLinecap="round" />
      <ellipse cx="15.5" cy="58.5" rx="4.2" ry="2.4" fill="#6b5a7a" />
      <ellipse cx="24.5" cy="58.5" rx="4.2" ry="2.4" fill="#6b5a7a" />
      {/* tunic */}
      <path d="M13 32 Q20 28 27 32 L29 50 H11 Z" fill="#8fcab5" />
      <path d="M13 32 Q20 28 27 32 L26.4 36 Q20 33 13.6 36Z" fill="#a9dcc9" />
      {/* arms: one raised towards the star */}
      <path d="M13.5 35 L8 43" stroke="#fbe0c4" strokeWidth="3" strokeLinecap="round" />
      <path d="M26.5 34 L33 26" stroke="#fbe0c4" strokeWidth="3" strokeLinecap="round" />
      {/* head */}
      <circle cx="20" cy="20" r="9" fill="#fbe0c4" />
      {/* golden spiky hair */}
      <path d="M10.5 18 L8 12 L13.5 13 L14 6.5 L18.5 11.5 L21 4.5 L23.5 11.5 L28 7 L28.5 13.5 L33 12 L29.5 18 C26 13 14 13 10.5 18Z" fill="#f6cf62" />
      {/* face, looking up and to the right */}
      <circle cx="22.5" cy="20" r="1.1" fill="#4a3a31" />
      <circle cx="27" cy="20" r="1.1" fill="#4a3a31" />
      <path d="M23 24.5 Q25 26 27 24.5" stroke="#c98966" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* a tiny star he is watching */}
      <path className="star" d="M40 8 L41.2 11.2 L44.5 12.4 L41.2 13.6 L40 17 L38.8 13.6 L35.5 12.4 L38.8 11.2Z" fill="#fff1c4" />
    </svg>
  );
}
