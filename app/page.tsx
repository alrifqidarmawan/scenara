import Link from "next/link";
import { EyeOff, Link2, PlayCircle, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { CreateRoomForm } from "@/components/create-room-form";
import { FogDemo } from "@/components/fog-demo";
import { Marquee } from "@/components/marquee";
import { ThemeToggle } from "@/components/theme-toggle";

const delay = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;

const FEATURES = [
  { icon: Link2, tone: "bg-brand-soft text-brand-ink", title: "Just a link", body: "Share the room link. No passwords, no email, no sign-up." },
  { icon: EyeOff, tone: "bg-sky text-sky-ink", title: "Fog of war", body: "Notes past your episode or page stay hidden until you catch up." },
  { icon: Users, tone: "bg-sage text-sage-ink", title: "Your own pace", body: "Everyone marks their own progress. Nobody gets spoiled." },
];

/** Landing page (CLAUDE.md §6G): Create a Room + Try Interactive Demo. */
export default function Home() {
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden">
      {/* Slow drifting colour behind everything */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora absolute top-[55%] -left-32 h-96 w-96 rounded-full bg-brand/35 blur-3xl" />
        <div className="aurora absolute top-48 -right-28 h-[28rem] w-[28rem] rounded-full bg-brand/20 blur-3xl [animation-delay:-6s]" />
        <div className="aurora absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky blur-3xl [animation-delay:-12s]" />
      </div>

      <header className="flex w-full items-center justify-between px-6 py-5 lg:px-12 2xl:px-20">
        <Brand />
        <nav className="flex items-center gap-2">
          <Link href="/demo" className="btn-soft hidden sm:inline-flex">
            Try the demo
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="grid w-full flex-1 items-center gap-14 px-6 pt-6 pb-14 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:px-12 lg:pt-10 lg:pb-24 2xl:px-20">
        <section className="text-center lg:max-w-3xl lg:justify-self-start lg:text-left 2xl:max-w-4xl">
          <p
            className="reveal inline-flex items-center gap-2 rounded-full border border-line bg-cream/70 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur"
            style={delay(0)}
          >
            <span className="pulse-dot h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            A spoiler-proof club for books &amp; shows
          </p>

          <h1
            className="reveal mt-6 font-display text-5xl leading-[1.03] tracking-tight text-balance sm:text-6xl xl:text-7xl 2xl:text-8xl"
            style={delay(0.1)}
          >
            Read and watch together,{" "}
            <span className="text-shimmer">without the spoilers.</span>
          </h1>

          <p
            className="reveal mx-auto mt-6 max-w-xl text-lg leading-8 text-muted text-pretty lg:mx-0 xl:text-xl xl:leading-9 2xl:max-w-2xl 2xl:text-2xl 2xl:leading-10"
            style={delay(0.2)}
          >
            Friends on different pages and episodes can still talk. Their notes stay locked until
            you catch up, then open on their own.
          </p>

          <div className="reveal mx-auto mt-10 max-w-md text-left lg:mx-0 2xl:max-w-lg" style={delay(0.3)}>
            <div className="card bg-cream/70! p-5 backdrop-blur-md">
              <CreateRoomForm />
            </div>
            <Link
              href="/demo"
              className="group mt-4 inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-muted transition hover:text-ink"
            >
              <PlayCircle className="h-4 w-4 text-brand transition group-hover:scale-110" aria-hidden="true" />
              or try the interactive demo, no room needed
            </Link>
          </div>
        </section>

        <FogDemo />
      </main>

      <Marquee />

      <section className="w-full px-6 py-16 lg:px-12 lg:py-20 2xl:px-20">
        <ul className="grid gap-5 sm:grid-cols-3 lg:gap-8">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className="reveal group rounded-3xl border border-line bg-cream/70 p-6 backdrop-blur lg:p-8 transition duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-soft"
              style={delay(0.45 + i * 0.1)}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-full transition group-hover:scale-110 ${f.tone}`}>
                <f.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-display text-xl">{f.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
