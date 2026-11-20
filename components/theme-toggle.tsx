"use client";

import { Moon, Sun } from "lucide-react";

const KEY = "scenara-theme";
const DURATION_MS = 650;
const SKY_DURATION_MS = 1100;
const REVEAL_MS = 1000;
const FEATHER_PX = 140; // keep in sync with the mask in globals.css

const SLIDE_PX = 36; // orb travel: track width minus orb width minus both paddings

/**
 * Plays the orb's journey: slides across in an arc while the sun turns into the moon
 * (or back). The end states live in CSS (the `dark` class); this only animates from the
 * old state to the new one, so it can start exactly when the page is ready to be seen.
 */
function playOrb(button: HTMLElement, toDark: boolean) {
  const opts: KeyframeAnimationOptions = { duration: DURATION_MS, easing: "cubic-bezier(0.55, 0, 0.25, 1)" };
  const part = (name: string) => button.querySelector<HTMLElement>(`[data-part="${name}"]`);
  const flip = <T,>(a: T, b: T) => (toDark ? [a, b] : [b, a]);

  part("slide")?.animate({ translate: flip("0px 0px", `${SLIDE_PX}px 0px`) }, opts);
  part("arc")?.animate({ transform: ["translateY(0)", "translateY(-8px)", "translateY(0)"] }, { ...opts, easing: "ease-in-out" });
  part("sun")?.animate(
    { opacity: flip(1, 0), scale: flip("1", "0.5"), rotate: flip("0deg", "90deg") },
    opts,
  );
  part("moon")?.animate(
    { opacity: flip(0, 1), scale: flip("0.5", "1"), rotate: flip("-90deg", "0deg") },
    opts,
  );
  part("sky-night")?.animate({ opacity: flip(0, 1) }, { ...opts, easing: "ease-in-out" });
  part("sky-day")?.animate({ opacity: flip(1, 0) }, { ...opts, easing: "ease-in-out" });
  playSky(toDark);
}

/**
 * The big sun/moon on the page background makes the same journey, slower and wider:
 * across the whole sky (left corner to right corner), dipping through the middle.
 */
function playSky(toDark: boolean) {
  const opts: KeyframeAnimationOptions = { duration: SKY_DURATION_MS, easing: "cubic-bezier(0.55, 0, 0.25, 1)" };
  const part = (name: string) => document.querySelector<HTMLElement>(`[data-sky="${name}"]`);
  const flip = <T,>(a: T, b: T) => (toDark ? [a, b] : [b, a]);
  const FAR = "calc(100vw - var(--size) - 17vw) 0px";

  part("slide")?.animate({ translate: flip("0px 0px", FAR) }, opts);
  part("arc")?.animate({ transform: ["translateY(0)", "translateY(9vh)", "translateY(0)"] }, { ...opts, easing: "ease-in-out" });
  part("sun")?.animate({ opacity: flip(1, 0), scale: flip("1", "0.5"), rotate: flip("0deg", "90deg") }, opts);
  part("moon")?.animate({ opacity: flip(0, 1), scale: flip("0.5", "1"), rotate: flip("-90deg", "0deg") }, opts);
}

/**
 * Day/night switch: a dim sun at the left end, a dim moon at the right end, and a
 * glowing orb that glides between them in an arc, turning from sun to moon.
 *
 * The initial theme is applied before paint by the inline script in app/layout.tsx
 * (saved choice, else the system setting), so this component keeps no state: CSS reads
 * the `dark` class on <html> for the resting orb position and icons.
 *
 * Where supported, the page itself changes with a circular reveal that grows from the
 * switch (View Transitions API). Reduced motion and older browsers switch instantly.
 */
export function ThemeToggle() {
  async function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    const root = document.documentElement;
    const toDark = !root.classList.contains("dark");
    const next = toDark ? "dark" : "light";

    const apply = () => {
      root.classList.toggle("dark", toDark);
      root.style.colorScheme = next;
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Private mode: the choice just won't persist.
      }
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      apply();
      return;
    }
    if (typeof document.startViewTransition !== "function") {
      apply();
      playOrb(button, toDark);
      return;
    }

    const box = button.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    root.style.setProperty("--rx", `${x}px`);
    root.style.setProperty("--ry", `${y}px`);
    const transition = document.startViewTransition(apply);
    try {
      await transition.ready;
    } catch {
      playOrb(button, toDark); // transition skipped; the theme is already applied
      return;
    }
    // Both start together, after the browser has captured the page, so a slow
    // capture can never swallow the first half of the motion. The reveal is a little
    // slower than the orb and its edge is feathered, so the change reads as a soft wash.
    playOrb(button, toDark);
    root.animate(
      { "--reveal-r": ["0px", `${radius + FEATHER_PX}px`] },
      { duration: REVEAL_MS, easing: "cubic-bezier(0.45, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="theme-switch group relative h-9 w-[4.5rem] shrink-0 overflow-hidden rounded-full border border-line outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {/* Sky: soft day gradient, fading to a starry night in dark mode */}
      <span aria-hidden="true" data-part="sky-day" className="sky-day absolute inset-0 dark:opacity-0" />
      <span aria-hidden="true" data-part="sky-night" className="sky-night absolute inset-0 opacity-0 dark:opacity-100">
        <i className="star absolute top-[28%] left-[16%] h-[3px] w-[3px] rounded-full bg-white" />
        <i className="star absolute top-[62%] left-[34%] h-0.5 w-0.5 rounded-full bg-white [animation-delay:-1.2s]" />
        <i className="star absolute top-[24%] left-[48%] h-0.5 w-0.5 rounded-full bg-white [animation-delay:-2.1s]" />
      </span>

      {/* The two resting places: sun on the left, moon on the right */}
      <Sun className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted/70" aria-hidden="true" />
      <Moon className="absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted/70" aria-hidden="true" />

      {/* The orb: slides left to right in dark mode, right to left in light mode */}
      <span data-part="slide" className="orb-slide absolute top-1 left-1 h-7 w-7 dark:translate-x-9">
        <span data-part="arc" className="relative block h-full w-full">
          <span data-part="sun" className="sun-orb absolute inset-0 rounded-full dark:scale-50 dark:rotate-90 dark:opacity-0" />
          <span data-part="moon" className="moon-orb absolute inset-0 scale-50 -rotate-90 rounded-full opacity-0 dark:scale-100 dark:rotate-0 dark:opacity-100">
            <i className="absolute top-[22%] left-[30%] h-1.5 w-1.5 rounded-full bg-[#b9c4ea]/80" />
            <i className="absolute top-[52%] left-[56%] h-2 w-2 rounded-full bg-[#b9c4ea]/70" />
            <i className="absolute top-[64%] left-[22%] h-1 w-1 rounded-full bg-[#b9c4ea]/70" />
          </span>
        </span>
      </span>
    </button>
  );
}
