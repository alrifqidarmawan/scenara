import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AddMediaDialog } from "@/components/add-media-dialog";
import { Brand } from "@/components/brand";
import { BookShelf } from "@/components/book-shelf";
import { CopyLinkButton } from "@/components/copy-link-button";
import { JoinRoom } from "@/components/join-room";
import { MediaModal } from "@/components/media-modal";
import { SETUP_HINT, isSupabaseConfigured } from "@/lib/supabase-server";
import {
  getCurrentMember,
  getFeed,
  getHighlights,
  getMembers,
  getRoomByCode,
  getRoomOverview,
  isUuid,
} from "@/lib/data";
import { formatMediaUnit } from "@/lib/types";

/**
 * Room dashboard (GEMINI.md §7): join prompt, or media list + member progress.
 * Request data (params, cookies) is read inside <Suspense> as required by
 * `cacheComponents`.
 */
export default function RoomPage(props: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<p className="py-24 text-center text-sm text-muted">Loading room…</p>}>
      <RoomContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

function Header({ code }: { code: string }) {
  return (
    <header className="border-b border-line bg-cream/70">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <Brand />
        <span className="chip bg-paper font-mono text-muted ring-1 ring-line">{code}</span>
      </div>
    </header>
  );
}

async function RoomContent({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ media?: string | string[] }>;
}) {
  const { code } = await params;
  const { media: mediaParam } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <>
        <Header code={code} />
        <p className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted">{SETUP_HINT}</p>
      </>
    );
  }

  const room = await getRoomByCode(code);
  if (!room) notFound();

  const member = await getCurrentMember(room);

  if (!member) {
    const members = await getMembers(room.id);
    return (
      <>
        <Header code={code} />
        <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-12">
          <div className="text-center">
            <p className="eyebrow">You&apos;re invited to</p>
            <h1 className="mt-2 font-display text-3xl">{room.name}</h1>
          </div>
          <JoinRoom
            roomCode={room.code}
            members={members.map((m) => ({ id: m.id, nickname: m.nickname }))}
          />
        </main>
      </>
    );
  }

  const { media, members, progress } = await getRoomOverview(room);
  const nameById = new Map(members.map((m) => [m.id, m.nickname]));
  const roomPath = `/room/${room.code}`;

  // `?media=<id>` opens the modal. Locked notes are stripped inside getFeed.
  const openId = typeof mediaParam === "string" && isUuid(mediaParam) ? mediaParam : null;
  const open = openId ? media.find((m) => m.id === openId) : undefined;
  let modal: React.ReactNode = null;
  if (open) {
    const myUnit = progress[open.id]?.[member.id] ?? 0;
    const feed = await getFeed(open.id, myUnit);
    const highlights = await getHighlights(feed.filter((n) => n.isUnlocked).map((n) => n.id));
    modal = (
      <MediaModal
        roomCode={room.code}
        roomPath={roomPath}
        media={open}
        myUnit={myUnit}
        memberName={member.nickname}
        feed={feed}
        highlights={highlights}
        others={Object.entries(progress[open.id] ?? {})
          .filter(([id]) => id !== member.id)
          .map(([id, unit]) => ({ name: nameById.get(id) ?? "Someone", unit }))}
      />
    );
  }

  return (
    <>
      <Header code={code} />
      <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10">
        <section>
          <p className="eyebrow">Welcome, {member.nickname}</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight">{room.name}</h1>
          <div className="mt-5 flex flex-wrap items-start gap-3">
            <CopyLinkButton />
            <AddMediaDialog roomCode={room.code} />
          </div>
        </section>

        <section>
          <h2 className="eyebrow">Our shelf</h2>
          <div className="mt-2">
            <BookShelf
              hrefFor={(id) => `${roomPath}?media=${id}`}
              items={media.map((m) => {
                const unit = progress[m.id]?.[member.id] ?? 0;
                return {
                  media: m,
                  progressLabel: unit === 0 && m.media_type === "tv" ? "Not started" : formatMediaUnit(m, unit),
                };
              })}
            />
          </div>
          {media.length === 0 && (
            <p className="mt-4 text-center text-sm text-muted">
              Your shelf is empty. Add a show or a book to get started.
            </p>
          )}
        </section>

        <section>
          <h2 className="eyebrow">In this room · {members.length}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {members.map((m) => (
              <li
                key={m.id}
                className={`chip px-3.5 py-1.5 text-sm ${
                  m.id === member.id ? "bg-peach/50 text-ink" : "bg-cream text-muted ring-1 ring-line"
                }`}
              >
                {m.nickname}
                {m.id === member.id && " (you)"}
              </li>
            ))}
          </ul>
        </section>
      </main>
      {modal}
    </>
  );
}
