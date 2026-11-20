"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMedia, deleteNote, moveMedia } from "@/lib/actions";
import { DeleteButton } from "./delete-button";
import { Lock, PenLine, X } from "lucide-react";
import { CoverInfo } from "./cover-info";
import { MediaInfo, hasInfo } from "./media-info";
import { BookPages } from "./book-pages";
import { MediaProgress } from "./media-progress";
import { NoteComposer } from "./note-composer";
import { NoteDetail } from "./note-detail";
import {
  formatMediaUnit,
  type FeedNote,
  type Highlight,
  type Reply,
  type RoomMedia,
} from "@/lib/types";

const TAG_STYLES: Record<FeedNote["tag"], string> = {
  note: "bg-paper text-muted ring-1 ring-line",
  theory: "bg-lavender text-lavender-ink",
  question: "bg-butter text-butter-ink",
  review: "bg-sky text-sky-ink",
};

/**
 * Media detail modal: cover + progress on the left, entries on the right
 * (CLAUDE.md §6). It is rendered from `/room/[code]?media=<id>`, so the
 * server already stripped locked entries' text before this component sees them.
 */
export function MediaModal({
  roomCode,
  roomPath,
  media,
  shelves,
  myUnit,
  memberName,
  canEditItem,
  memberId,
  isOwner,
  others,
  feed,
  highlights,
  replies,
}: {
  roomCode: string;
  roomPath: string;
  media: RoomMedia;
  /** Shelves of this item's kind (where it can be moved). */
  shelves: { id: string; name: string }[];
  myUnit: number;
  memberName: string;
  /** May edit the item itself (pages, shelf): who added it, or the owner. */
  canEditItem: boolean;
  memberId: string;
  isOwner: boolean;
  others: { name: string; unit: number }[];
  feed: FeedNote[];
  highlights: Highlight[];
  replies: Reply[];
}) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  async function move(shelfId: string) {
    setMoveError(null);
    const result = await moveMedia(roomCode, media.id, shelfId);
    if (result.error) return setMoveError(result.error);
    router.push(`/room/${roomCode}?shelf=${shelfId}&media=${media.id}`, { scroll: false });
  }

  const close = () => router.push(roomPath, { scroll: false });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(roomPath, { scroll: false });
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [router, roomPath]);

  // Reading order: earliest chapter first.
  const entries = useMemo(() => [...feed].reverse(), [feed]);
  const selected = entries.find((n) => n.id === selectedId && n.isUnlocked && n.content !== null);
  const lockedCount = entries.filter((n) => !n.isUnlocked).length;
  const isBook = media.media_type === "book";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={media.title}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-line bg-paper shadow-soft sm:rounded-3xl md:flex-row"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-cream/90 text-muted shadow-soft hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left: cover + progress */}
        <aside className="shrink-0 space-y-5 overflow-y-auto border-b border-line bg-cream/60 p-5 md:w-[24rem] md:border-r md:border-b-0 md:p-6">
          <div className="flex items-center gap-4 md:block">
            <div className="w-32 shrink-0 md:mx-auto md:w-64 md:[perspective:900px]">
              <div className="md:[transform:rotateY(-8deg)] md:transition-transform md:duration-500 md:hover:[transform:rotateY(0deg)]">
                <CoverInfo media={media} />
              </div>
            </div>
            <div className="min-w-0 md:mt-5 md:text-center">
              <p className="eyebrow">{isBook ? "Book" : media.media_type === "movie" ? "Movie" : "TV series"}</p>
              <h2 className="font-display text-xl leading-tight">{media.title}</h2>
            </div>
          </div>

          {/* Phones: details as a section (the cover is small there). */}
          {hasInfo(media) && (
            <details className="rounded-2xl border border-line bg-cream p-4 md:hidden">
              <summary className="eyebrow cursor-pointer">About</summary>
              <div className="mt-3">
                <MediaInfo media={media} />
              </div>
            </details>
          )}

          <div className="rounded-2xl border border-line bg-cream p-4">
            <MediaProgress
              key={`${media.total_units}-${media.total_pages ?? "pct"}`}
              roomCode={roomCode}
              mediaId={media.id}
              mediaType={media.media_type}
              totalUnits={media.total_units}
              usesPages={media.total_pages != null}
              initialUnit={myUnit}
            />
          </div>

          {isBook && canEditItem && (
            <div className="rounded-2xl border border-line bg-cream p-4">
              <BookPages roomCode={roomCode} mediaId={media.id} totalPages={media.total_pages} />
            </div>
          )}

          {canEditItem && shelves.length > 1 && (
            <label className="block">
              <span className="eyebrow">On shelf</span>
              <select
                value={media.shelf_id ?? ""}
                onChange={(e) => move(e.target.value)}
                className="input mt-2 py-2"
              >
                {shelves.map((sh) => (
                  <option key={sh.id} value={sh.id}>
                    {sh.name}
                  </option>
                ))}
              </select>
              {moveError && <span role="alert" className="mt-1 block text-xs text-blush-ink">{moveError}</span>}
            </label>
          )}

          {canEditItem && (
            <DeleteButton
              withLabel
              label={isBook ? "Remove this book" : media.media_type === "movie" ? "Remove this movie" : "Remove this show"}
              confirmText={`Remove “${media.title}” with all its entries and everyone's progress? This can't be undone.`}
              onDelete={() => deleteMedia(roomCode, media.id)}
              onDone={close}
            />
          )}

          {others.length > 0 && (
            <div>
              <p className="eyebrow">Friends</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {others.map((o) => (
                  <li key={o.name} className="chip bg-cream text-muted ring-1 ring-line">
                    {o.name} · {formatMediaUnit(media, o.unit)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Right: entries */}
        <section className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 md:p-6">
          {selected ? (
            <NoteDetail
              roomCode={roomCode}
              note={selected as FeedNote & { content: string }}
              highlights={highlights.filter((h) => h.note_id === selected.id)}
              replies={replies.filter((r) => r.note_id === selected.id)}
              memberId={memberId}
              isOwner={isOwner}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 pr-10">
                <h3 className="font-display text-xl">{isBook ? "Chapters & reviews" : media.media_type === "movie" ? "Thoughts & reviews" : "Episodes & reviews"}</h3>
                {canEditItem && (
                  <button type="button" onClick={() => setWriting((w) => !w)} className="btn-primary min-h-9 px-4">
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    {writing ? "Close" : "Write"}
                  </button>
                )}
              </div>

              {!canEditItem && (
                <p className="text-xs text-muted">
                  Open an entry to comment on its lines or reply. Only who added this {isBook ? "book" : "show"}, and the owner, can write entries.
                </p>
              )}

              {canEditItem && writing && (
                <NoteComposer
                  roomCode={roomCode}
                  mediaId={media.id}
                  mediaType={media.media_type}
                  authorName={memberName}
                  anchorLabel={formatMediaUnit(media, myUnit)}
                  onPosted={() => setWriting(false)}
                />
              )}

              {lockedCount > 0 && (
                <p className="inline-flex items-center gap-1.5 text-xs text-butter-ink">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  {lockedCount} locked past your progress
                </p>
              )}

              {entries.length === 0 ? (
                <p className="empty">{canEditItem ? "No entries yet. Be the first to write one." : "No entries yet."}</p>
              ) : (
                <ul className="space-y-2.5">
                  {entries.map((n) => {
                    const count = highlights.filter((h) => h.note_id === n.id).length;
                    return (
                      <li key={n.id}>
                        {n.isUnlocked ? (
                          <button
                            type="button"
                            onClick={() => setSelectedId(n.id)}
                            className="card w-full p-4 text-left transition hover:-translate-y-0.5"
                          >
                            <span className="block font-display text-lg leading-snug">
                              {n.title ?? n.anchor_label}
                            </span>
                            <span className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className="chip bg-brand-soft text-brand-ink">{n.anchor_label}</span>
                              <span className={`chip ${TAG_STYLES[n.tag]}`}>{n.tag}</span>
                              {count > 0 && <span className="text-xs text-muted">{count} highlight{count === 1 ? "" : "s"}</span>}
                              <span className="ml-auto text-xs text-muted">{n.author_name}</span>
                            </span>
                            <span className="mt-2 line-clamp-2 block text-sm leading-6 text-ink/80">{n.content}</span>
                          </button>
                        ) : (
                          <div className="rounded-3xl border border-dashed border-butter-ink/25 bg-butter/50 p-4">
                            <p className="flex items-start gap-2 text-sm font-medium text-butter-ink">
                              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                              <span>
                                Locked until <span className="font-semibold">{n.anchor_label}</span> — posted by{" "}
                                {n.author_name}
                              </span>
                            </p>
                            <div aria-hidden="true" className="mt-3 space-y-2 opacity-40 blur-[3px] select-none">
                              <div className="h-3 w-11/12 rounded-full bg-butter-ink/40" />
                              <div className="h-3 w-6/12 rounded-full bg-butter-ink/40" />
                            </div>
                            {(isOwner || n.member_id === memberId) && (
                              <div className="mt-2">
                                <DeleteButton
                                  label="Delete entry"
                                  confirmText="Delete this locked entry?"
                                  onDelete={() => deleteNote(roomCode, n.id)}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
