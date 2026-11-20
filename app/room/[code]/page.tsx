import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AddMediaDialog } from "@/components/add-media-dialog";
import { Brand } from "@/components/brand";
import { BookShelf } from "@/components/book-shelf";
import { ShelfBar } from "@/components/shelf-bar";
import { ShelfOverview } from "@/components/shelf-overview";
import { ShelfTitle } from "@/components/shelf-title";
import { MembersPanel } from "@/components/members-panel";
import { ModalSkeleton, RoomSkeleton } from "@/components/room-skeleton";
import { CopyLinkButton } from "@/components/copy-link-button";
import { JoinRoom } from "@/components/join-room";
import { ThemeToggle } from "@/components/theme-toggle";
import { MediaModal } from "@/components/media-modal";
import { SETUP_HINT, isSupabaseConfigured } from "@/lib/supabase-server";
import { canEditMedia, getAccess } from "@/lib/permissions";
import {
  getFeed,
  getHighlights,
  getMembers,
  getRoomByCode,
  getRoomOverview,
  isUuid,
} from "@/lib/data";
import { formatMediaUnit, type RoomMedia } from "@/lib/types";

/**
 * Room dashboard (CLAUDE.md §7): join prompt, or media list + member progress.
 * Request data (params, cookies) is read inside <Suspense> as required by
 * `cacheComponents`.
 */
export default function RoomPage(props: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <RoomContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

function Header({ code }: { code: string }) {
  return (
    <header className="border-b border-line bg-cream/70">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <Brand />
        <div className="flex items-center gap-2">
          <span className="chip bg-paper font-mono text-muted ring-1 ring-line">{code}</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

async function RoomContent({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ media?: string | string[]; shelf?: string | string[]; view?: string | string[] }>;
}) {
  const { code } = await params;
  const { media: mediaParam, shelf: shelfParam, view: viewParam } = await searchParams;

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

  const access = await getAccess(room);

  if (!access) {
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
            // Only viewers can be reclaimed by name (the link must not hand out edit rights),
            // and only their ids are ever sent to the browser.
            members={members.filter((m) => m.role === "viewer").map((m) => ({ id: m.id, nickname: m.nickname }))}
          />
        </main>
      </>
    );
  }

  const { member, canEdit, isOwner, ownerKey } = access;
  const { shelves, media, members, progress } = await getRoomOverview(room);
  if (shelves.length === 0) {
    // The `shelves` table doesn't exist yet (older database): say how to fix it.
    return (
      <>
        <Header code={code} />
        <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl">One database step left</h1>
          <p className="mt-3 text-sm text-muted">
            Shelves need a new table. Open the Supabase SQL Editor, run <code>supabase/schema.sql</code>, then reload.
          </p>
        </main>
      </>
    );
  }

  const nameById = new Map(members.map((m) => [m.id, m.nickname]));
  const base = `/room/${room.code}`;

  // `?media=<id>` opens the modal. Locked notes are stripped inside getFeed.
  const openId = typeof mediaParam === "string" && isUuid(mediaParam) ? mediaParam : null;
  const open = openId ? media.find((m) => m.id === openId) : undefined;

  // One shelf is shown at a time: `?shelf=<id>`; a shared media link opens on its own shelf.
  const wanted = typeof shelfParam === "string" ? shelfParam : undefined;
  const current =
    shelves.find((s) => s.id === wanted) ??
    (open ? shelves.find((s) => s.id === open.shelf_id) : undefined) ??
    shelves[0];
  const roomPath = `${base}?shelf=${current.id}`;
  const overview = viewParam === "all" && shelves.length > 1 && !open;

  const itemsByShelf: Record<string, typeof media> = {};
  for (const m of media) (itemsByShelf[m.shelf_id ?? ""] ??= []).push(m);
  const currentItems = itemsByShelf[current.id] ?? [];

  const modal = open ? (
    <Suspense key={open.id} fallback={<ModalSkeleton />}>
      <ModalLoader
        roomCode={room.code}
        roomPath={roomPath}
        media={open}
        shelves={shelves.filter((sh) => sh.kind === open.media_type).map((sh) => ({ id: sh.id, name: sh.name }))}
        myUnit={progress[open.id]?.[member.id] ?? 0}
        memberId={member.id}
        memberName={member.nickname}
        canEdit={canEdit}
        canEditItem={canEditMedia(access, open)}
        names={Object.fromEntries(nameById)}
        progressByMember={progress[open.id] ?? {}}
      />
    </Suspense>
  ) : null;

  return (
    <>
      <Header code={code} />
      <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10">
        <section>
          <p className="eyebrow">Welcome, {member.nickname}</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight">{room.name}</h1>
          <div className="mt-5 flex flex-wrap items-start gap-3">
            <CopyLinkButton />
          </div>
        </section>

        <section className="space-y-5">
          <ShelfBar
            roomCode={room.code}
            canEdit={canEdit}
            currentId={current.id}
            overview={overview}
            shelves={shelves.map((sh) => ({ id: sh.id, name: sh.name, kind: sh.kind, count: (itemsByShelf[sh.id] ?? []).length }))}
          />

          {overview ? (
            <div key="overview" className="zoom-out">
              <ShelfOverview roomCode={room.code} shelves={shelves} itemsByShelf={itemsByShelf} />
            </div>
          ) : (
            <div key={current.id} className="zoom-in space-y-4">
              <ShelfTitle
                roomCode={room.code}
                shelf={{ id: current.id, name: current.name }}
                count={currentItems.length}
                canDelete={shelves.length > 1}
                canEdit={canEdit}
              />
              {canEdit && (
                <AddMediaDialog roomCode={room.code} shelf={{ id: current.id, name: current.name, kind: current.kind }} />
              )}
              <BookShelf
                variant={current.kind}
                hrefFor={(id) => `${roomPath}&media=${id}`}
                items={currentItems.map((m) => {
                  const unit = progress[m.id]?.[member.id] ?? 0;
                  return {
                    media: m,
                    progressLabel: unit === 0 && m.media_type === "tv" ? "Not started" : formatMediaUnit(m, unit),
                  };
                })}
              />
              {currentItems.length === 0 && (
                <p className="text-center text-sm text-muted">
                  This shelf is empty.{" "}
                  {canEdit
                    ? `${current.kind === "book" ? "Add a book" : "Add a show"} to start it.`
                    : "A collaborator can add the first one."}
                </p>
              )}
            </div>
          )}
        </section>

        <MembersPanel
          roomCode={room.code}
          isOwner={isOwner}
          ownerKey={ownerKey}
          roomHasOwner={room.owner_key_hash != null}
          members={members.map((m) => ({ id: m.id, nickname: m.nickname, role: m.role, isYou: m.id === member.id }))}
        />
      </main>
      {modal}
    </>
  );
}

/** Loads the open item's entries and highlights; shows a skeleton modal until they arrive. */
async function ModalLoader({
  roomCode,
  roomPath,
  media,
  shelves,
  myUnit,
  memberId,
  memberName,
  canEdit,
  canEditItem,
  names,
  progressByMember,
}: {
  roomCode: string;
  roomPath: string;
  media: RoomMedia;
  shelves: { id: string; name: string }[];
  myUnit: number;
  memberId: string;
  memberName: string;
  canEdit: boolean;
  canEditItem: boolean;
  names: Record<string, string>;
  progressByMember: Record<string, number>;
}) {
  // Locked notes are stripped inside getFeed.
  const feed = await getFeed(media.id, myUnit);
  const highlights = await getHighlights(feed.filter((n) => n.isUnlocked).map((n) => n.id));
  return (
    <MediaModal
      roomCode={roomCode}
      roomPath={roomPath}
      media={media}
      shelves={shelves}
      myUnit={myUnit}
      memberName={memberName}
      canEdit={canEdit}
      canEditItem={canEditItem}
      feed={feed}
      highlights={highlights}
      others={Object.entries(progressByMember)
        .filter(([id]) => id !== memberId)
        .map(([id, unit]) => ({ name: names[id] ?? "Someone", unit }))}
    />
  );
}
