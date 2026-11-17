import Link from "next/link";
import { EyeOff, Link2, PlayCircle, Users } from "lucide-react";
import { CreateRoomForm } from "@/components/create-room-form";

/** Landing page (GEMINI.md §6C): Create a Room + Try Interactive Demo. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-14">
      <header className="text-center">
        <p className="eyebrow">Scenara</p>
        <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          Watch and read together, at your own pace.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted text-pretty">
          A cozy club for friends on different episodes. Notes stay{" "}
          <span className="font-medium text-ink">locked behind your progress</span> and unlock as
          you catch up. No spoilers, no sign-up.
        </p>
      </header>

      <section className="card mt-10 p-6">
        <CreateRoomForm />
        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-line" />
          or
          <div className="h-px flex-1 bg-line" />
        </div>
        <Link href="/demo" className="btn-soft w-full">
          <PlayCircle className="h-4 w-4" aria-hidden="true" />
          Try the interactive demo
        </Link>
      </section>

      <ul className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Link2, tone: "bg-sky text-sky-ink", title: "Just a link", body: "Share the room link. No passwords or email." },
          { icon: EyeOff, tone: "bg-lavender text-lavender-ink", title: "Fog of war", body: "Notes past your episode stay hidden." },
          { icon: Users, tone: "bg-sage text-sage-ink", title: "Your pace", body: "Everyone marks their own progress." },
        ].map((f) => (
          <li key={f.title} className="rounded-3xl border border-line bg-cream/60 p-4">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${f.tone}`}>
              <f.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-sm font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{f.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
