# CLAUDE.md — Scenara (v1.5)

Single source of truth for AI agents and humans working in this repo. Read it fully before changing code. Code comments cite sections of this file as `CLAUDE.md §<n>`; keep section numbers stable.

> **Next.js here is a recent version with breaking changes.** Before using a Next API, read the matching guide in `node_modules/next/dist/docs/` (the dev server also writes an `AGENTS.md` pointing there). Do not rely on memory.

---

## 1. Project Overview
**Scenara** is a lightweight, private, spoiler-proof discussion club for friends watching TV series and reading books together at different paces.

**Core hook:** asynchronous watch-alongs and read-alongs with **"Fog of War" spoiler protection**. Friends' entries stay locked behind progress gates and unlock automatically as you catch up.

**Hosting goal:** 100% free tier (**GitHub + Vercel Hobby + Supabase Free**). Non-commercial.

**Product feel:** a cosy shared bookshelf. Rooms show media as books and posters on wooden shelves; opening one shows a modal with the cover on the left and "chapters & reviews" on the right.

---

## 2. Strict Scope and Non-Goals (do not over-engineer)

- **No login in v1.** No passwords, email verification, OAuth, or Supabase Auth. Pattern: **Room Link + Nickname** (`/room/[code]`). **Roles** (owner / collaborator / viewer, §6H) decide who may change things; the link alone only gives read access.
- **Only two mediums:** TV series (`tv`) and books (`book`). No movies.
- **One post type:** an *entry* (the `notes` table) with a required title, a body, and an optional tag (`note`, `theory`, `question`, `review`).
- **No live chat or Realtime.** Server fetch plus `revalidatePath` after each action is enough.
- **No nested threads, polls, or custom roles.** Comments are flat *highlight comments* on a selected passage (§6D), each entry and comment can have one flat list of replies (§6H).
- **Progress units:**
  - **TV:** integer episode `0..total_units` (`0` = not started), label `Ep 4`.
  - **Books in pages (preferred):** `room_media.total_pages` set, `total_units` = pages, progress `0..pages`, label `p. 120`. The percent is **derived** (`page / total`). Members type an exact page *or* drag the slider.
  - **Books in percent (fallback):** no page count, `total_units` = 100, label `42%`.
  - Book entries may carry a free-text chapter label, e.g. `p. 120 · Ch. 8`. Never fetch chapters from APIs.
  - **Total pages is the end of the book and can be set or corrected any time** from the modal. The SQL function `set_book_pages` atomically rescales every member's progress and every entry's anchor and label (percent→pages, or old pages→new pages).

---

## 3. Tech Stack
- **Next.js 16** (App Router, `cacheComponents` and `partialPrefetching` on), React 19, TypeScript strict. Package manager: **pnpm**.
- **Styling:** Tailwind CSS v4 + `lucide-react`. No `shadcn/ui` (not installed; a few shared classes in `globals.css` are enough).
- **Database:** Supabase Postgres, accessed **only on the server** (Server Components, Server Actions, Route Handlers) with the service-role/secret key.
- **Storage:** Supabase Storage bucket `covers` for manually uploaded covers.
- **Validation:** Zod v4 on every Server Action and API route.
- **External APIs (read-only, called when searching or adding):**
  - Books: **Open Library AND Google Books, queried in parallel on every book search** (`lib/media-api.ts` → `searchBooks`). Open Library needs no key; Google Books uses `GOOGLE_BOOK_API_KEY` (server-side only, free quota about 1000 requests/day). Results are merged and de-duplicated; a book found by both is listed first. Each source has a 6 s timeout (Open Library is often slow), and if one fails the other still answers; the API returns `status` per source so the UI can say which one didn't. With no Google key, search uses Open Library only.
  - TV: TMDB (`TMDB_API_KEY`, server-side). Footer must show TMDB attribution (done in `app/layout.tsx`).
- **Deploy:** Vercel Hobby.

---

## 4. Security and Environment Rules
- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` or `TMDB_API_KEY` to the browser (no `NEXT_PUBLIC_` prefix). `SUPABASE_SERVICE_ROLE_KEY` may hold a new-style `sb_secret_...` key; the variable name stays.
- All DB access and TMDB calls run on the server (`lib/supabase-server.ts`, `lib/data.ts`, `lib/session.ts` import `server-only`).
- **RLS is enabled on every table with no policies.** The service role bypasses RLS; the public anon/publishable key can read nothing.
- **Spoiler content never leaves the server while locked.** `getFeed` (lib/data.ts) sets `content` **and `title`** to `null` for locked entries before serialization. `getHighlights` is only called with unlocked entry ids. CSS blur is decoration only.
- **Never trust the client for identity or anchors.** `member_id`, `author_name`, `room_id`, `anchor_unit`, `anchor_label`, quote text and total units are derived on the server from the member cookie, `member_progress` and stored rows. The client sends only `room_code`, `media_id`/`note_id`, `title`, `content`, `tag`, optional chapter, and highlight offsets.
- **Cover URLs:** search results are allow-listed (`image.tmdb.org`, `covers.openlibrary.org`, `books.google.com`, `books.googleusercontent.com`; see `ALLOWED_COVER_HOSTS`). Never put a Google request URL in an error message: it contains the key. Manual covers are uploaded by the server (JPG/PNG/WebP, max 1 MB) and the URL comes from Storage, never from the client.
- Do not call external media APIs on room page loads. Copy metadata into `room_media` once, at add time.

Required `.env.local` (see `.env.example`; the real file is git-ignored):
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co   # NO /rest/v1 suffix
SUPABASE_SERVICE_ROLE_KEY=<service_role JWT or sb_secret_...>
TMDB_API_KEY=<TMDB v3 API key>                                 # optional: only TV search needs it
GOOGLE_BOOK_API_KEY=<Google Books API key>                     # optional: without it, books use Open Library only
```

**Accepted v1 trade-offs:** anyone with the room link can join and can claim any existing nickname ("I'm already here"), so the link *is* the password; no rate limiting yet. Do not use Scenara for sensitive content.

---

## 5. Database Schema
Canonical file: `supabase/schema.sql`. Run it in the Supabase SQL Editor; it is **idempotent** (safe to re-run) and also upgrades older databases with `alter table … add column if not exists`. **Whenever you change the data model, edit this file and tell the user to re-run it.** The agent cannot run DDL.

Contents (v1.5 adds `rooms.owner_key_hash` and `room_members.role`): 8 tables (`rooms`, `room_members`, `shelves`, `room_media`, `member_progress`, `notes`, `note_highlights`, `note_replies`), indexes, RLS, the function `set_book_pages(uuid, int)` (service role only), and the public `covers` bucket.

Rules enforced:
- `rooms.code`: unique, `^[a-z0-9]{4,16}$`.
- `room_members`: nickname 1-30 chars, unique per room case-insensitively.
- `shelves`: `name` 1-40 chars, unique per room (case-insensitive); `kind` `book|tv` (the kind sets the theme); `position` orders the tabs.
- `room_media`: `shelf_id` (which shelf it stands on); unique `(room_id, media_type, external_id)`; `total_units >= 1`; optional `total_pages`, `creator`, `description` (≤2000), `year`, `genres` (comma separated). Manual items use `external_id = 'manual:<uuid>'`.
- `member_progress`: unique `(member_id, media_id)`; `current_unit >= 0`.
- `notes`: optional `title` (≤80; the app requires it for new entries); `content` 1-2000; `anchor_unit >= 0`.
- `note_highlights`: `end_offset > start_offset`; comment 1-500; offsets are UTF-16 indices into `notes.content`; `quote` is copied server-side.

---

## 6. Core Product Mechanics and UX Rules

### A. The Spoiler Lock ("Fog of War")
Never silently hide future entries; silence makes rooms feel dead.
- **Rule:** `isNoteUnlocked(note, myUnit)` = `note.anchor_unit <= myUnit` (one helper, `lib/types.ts`).
- **Exception:** entries tagged `review` are **always visible** (owner decision), so an end-of-book review can spoil early readers; they never count in the "Unlocked N" toast.
- **Unlocked:** title, body, author, tag, anchor badge.
- **Locked:** teaser card `🔒 Locked until [anchor_label] — posted by [author_name]`; no title, no body.
- **Unlock feedback:** `updateProgress` counts other members' entries with `old < anchor_unit <= new` and the client shows `Unlocked N new note(s)!`.
- Your own entries follow the same rule (they only lock if you move your own progress backwards).
- An entry's anchor is **where the author was when posting** (server reads their saved progress).

### B. Frictionless Identity
- No cookie for the room → inline prompt "What should we call you?" plus "Or I'm already here" (reclaim an existing nickname, e.g. new device).
- The member id is stored in an **httpOnly cookie** `scenara_member_<code>` (1 year, `SameSite=Lax`), written by Server Actions (`lib/session.ts`).
- **Why a cookie, not `localStorage`:** Server Components cannot read `localStorage`, so gating would run in the browser and locked text would already be in the HTML.
- A stale or missing cookie is treated as "not joined".

### H. Roles and Permissions (v1.5)
- **owner**: made by the room creator. Proof is a secret **owner key** (`xxxx-xxxx-xxxx-xxxx`): only its SHA-256 is in `rooms.owner_key_hash`; the key sits in the httpOnly cookie `scenara_owner_<code>`. The creator becomes the owner member when they pick a nickname (`joinRoom` checks the cookie). Another device: "I'm the room owner" on the join prompt calls `recoverOwner`. The owner sees and can copy the key in the members panel. The owner promotes viewers to **collaborator** and back (`setMemberRole`).
- **Item ownership:** `room_media.added_by` records who added an item. Only that member and the owner may edit the item itself (total pages, move shelf: `canEditMedia`). Any collaborator may still write entries and highlight comments on it; everyone reads. Items without an adder (older rows) stay editable by any collaborator.
- **Purpose of inviting someone:** they join the *conversation*, not the management. Every member (viewer included) can read, move their own progress, **comment on highlights** of any unlocked entry, and **reply** (flat, one level, under an entry or a highlight comment; table `note_replies`, `addReply`). The author, owner and everyone else can answer the same way.
- **collaborator**: additionally may add media (search and manual) and create/rename/delete shelves.
- **Writing entries and editing an item** (total pages, move shelf): only **who added the item and the owner** (`canEditMedia`, `room_media.added_by`). Everyone else cannot change it.
- **viewer** (default for every new joiner): read, own progress, highlight comments, replies. UI hides the other controls; the server enforces it (`getAccess(room).canEdit` / `canEditMedia` in `lib/permissions.ts`).
- **Reclaiming by name** (`claimMember`) works only for viewers, and the join prompt only receives viewer ids; otherwise anyone with the link could become a collaborator by picking its name.
- **Legacy rooms** (made before v1.5): existing members become collaborators (column default), there is no owner, and any member may "Claim room" once (`claimOwnership`).
- Loading UI: `components/skeleton.tsx` (`Skeleton`, `Spinner`), `room-skeleton.tsx` (room and modal skeletons used as `Suspense` fallbacks), `link-pending.tsx` (pulse on a link while its page loads).

### C. The Shelf and the Media Modal
- **Shelves are named by members** (table `shelves`) and each holds **one kind of media**; the kind sets the theme: **book** = warm wooden shelf with terracotta pots, **tv** = painted pastel board with a film-strip edge and pastel pots. New rooms get "Books" and "Shows" lazily (`ensureShelves` in `lib/data.ts`, which also moves older media onto the first shelf of its kind).
- **One shelf at a time.** `components/shelf-bar.tsx`: tab per shelf (links to `?shelf=<id>`, so every shelf has a shareable URL), a dashed **New shelf** tab (name + Books/Shows), and a **Zoom out** button. The open shelf's name has a pencil to **rename**; an empty shelf can be **deleted** (a room keeps at least one). Items can be **moved** to another shelf of the same kind from the modal ("On shelf").
- **Zoom out** (`?view=all`, `shelf-overview.tsx`): every shelf as one **row** (name, count, a strip of mini covers on its own board, a plant); clicking a row zooms into it. The button only shows when there are 2+ shelves. Zoom uses `zoom-in` / `zoom-out` keyframes.
- **Adding** goes to the open shelf and its kind decides what is searched (books or shows); there is no media-type toggle any more.
- Layout of a shelf: 5 items per row plus one **mini flower pot** (`shelf-plant.tsx`) in the row's last cell; 6 cells per row on desktop, 3 on phones; each cell draws its own board segment so boards join at any width.
- **Night light** (dark mode, CSS only): NOT a strip along the board. Each cover gets a **soft pool of light from underneath** (`.cover-glow`) plus a faint halo up its face (`.cover-halo`); warm on book shelves, cool on tv shelves (`--lc` set by `shelf-light-warm|cool`).
- **Click** opens a modal through `/room/[code]?media=<id>` (shareable; the server decides what is locked). The old `/room/[code]/media/[id]` URL redirects there.
- Modal left: large cover (hover/focus/tap slides media details over it, §6E), progress (slider + exact number input), total-pages box for books, friends' progress. Phones show an "About" section instead of the hover.
- Modal right: entries in reading order. Each shows **title first**, then chips (anchor, tag), then a body preview. Clicking an unlocked entry shows the full text; "Write" opens the composer.

### D. Highlight Comments
- In the full entry view, select any lines (max 600 chars), write a comment (max 500), submit. Highlights render as `<mark>`; a list below shows quote, comment and author. Click a mark or list item to emphasise it.
- Flat comments; replies are a separate flat list (§6H). No editing, no deleting in v1.
- Offsets come from the DOM Range inside a single `<p>` whose `textContent` equals `note.content`; the server re-validates bounds and re-slices the quote from stored text. The server rejects comments on locked entries.

### E. Media Details and Manual Add
- **Details** (creator, year, genres, description, length) are saved once at add time: TMDB details for TV; for books, the Google Books volume (`gb:<id>`) or Open Library work (`/works/OL…W`) record, depending on which id the search result carries (best effort, never blocks adding). Google descriptions are stripped of HTML. A book found by both APIs keeps the Google id and the larger Open Library cover.
- **Add manually** (tab in the add dialog): title, creator, year, pages (book) or episodes (TV, required), genres, description, optional cover. The browser shrinks the image to a ~600px JPEG before upload (server cap 1 MB; Server Action body limit is 1 MB).
- Books added via search can include a "Pages" box (prefilled from Open Library when known). Empty = percent mode; fix later via the total-pages box.

### F. Demo Mode
The landing page (`/`) offers **Create a Room** (real Supabase room) and **Try Interactive Demo** (`/demo`): fully client-side with sample data (`lib/demo-data.ts`) and a floating **Persona Switcher** (`Sarah (Ep 2)` vs `Alex (Ep 5)`), so a solo visitor can slide progress and watch entries unlock. The demo needs no env vars.

### G. Landing Page
`app/page.tsx`: animated, still simple. Left: pill, headline with a shimmering blue phrase, one-line pitch, the Create Room card, a quiet "try the demo" link. Right: `FogDemo`, a looping 10 s **pure-CSS** illustration (slider moves Ep 2 → Ep 5, locked entries unlock on the way, "Unlocked 2 new notes!" toast, then resets). Behind: three slowly drifting colour blobs. Between the hero and the features: an edge-to-edge `Marquee` strip of sample books and shows. Below: three feature cards. **The landing page is full-bleed** (no centred max-width; padding `px-6 lg:px-12 2xl:px-20`) and the hero scales up on `2xl`. Entrance uses staggered `reveal` fade-ups. `prefers-reduced-motion` stops every loop and shows the finished (unlocked) state. No JS drives any of it; keep it that way.

---

## 7. App Structure (no `src/` folder)
```text
app/
├── layout.tsx                      fonts (Fraunces + Geist), metadata, TMDB attribution footer
├── globals.css                     light/dark tokens, @utility classes (card, btn-primary, input, chip, ...), range slider, landing keyframes
├── page.tsx                        landing
├── demo/page.tsx                   client-only demo
├── room/[code]/page.tsx            join prompt, or shelf + members; `?media=<id>` renders the modal
├── room/[code]/media/[mediaId]/page.tsx   redirect to ?media=<id>
└── api/search/route.ts             GET proxy for Open Library + TMDB (Zod-validated)
components/
├── add-media-dialog.tsx            search tab + manual tab
├── manual-media-form.tsx           manual add + client-side cover shrink
├── shelf-bar.tsx / shelf-title.tsx / shelf-overview.tsx   tabs + new shelf + zoom, rename/delete, zoomed-out rows
├── book-shelf.tsx / shelf-book.tsx themed shelf grid (variant book|tv) / 3D book or poster
├── shelf-plant.tsx                 mini flower pots on the shelf boards
├── media-modal.tsx                 modal shell (client); entry list; composer toggle
├── cover.tsx / cover-info.tsx / media-info.tsx   cover w/ fallback / hover overlay / details block
├── media-progress.tsx              debounced progress save + unlock toast
├── progress-slider.tsx             slider + number input (episodes, pages, or percent)
├── book-pages.tsx                  set/correct total pages
├── note-card.tsx                   card (used by demo); locked vs unlocked
├── note-composer.tsx               title + body + tag (+ chapter for books)
├── note-detail.tsx                 full entry + highlight selection and comments
├── fog-demo.tsx                    landing hero: looping CSS-only unlock illustration
├── sky-body.tsx                    big sun (light, top-left) / moon (dark, top-right) on the page background
├── theme-toggle.tsx                day/night switch + plays the sun/moon journey
├── join-room.tsx, create-room-form.tsx, copy-link-button.tsx, persona-switcher.tsx, brand.tsx, toast.tsx
lib/
├── actions.ts                      all Server Actions (below)
├── data.ts                         server-only reads; getFeed strips locked content/title
├── media-api.ts                    Open Library + TMDB helpers (search, getTvDetails, getBookDetails)
├── session.ts                      member cookie read/write
├── supabase-server.ts              service-role client (lazy singleton), isSupabaseConfigured
├── types.ts                        shared types, isNoteUnlocked, formatUnitLabel/formatMediaUnit
└── demo-data.ts
supabase/schema.sql                 canonical DB setup
```

**Server Actions** (`lib/actions.ts`): `createRoom`, `joinRoom`, `claimMember`, `recoverOwner`, `claimOwnership`, `setMemberRole`, `createShelf`, `renameShelf`, `deleteShelf`, `moveMedia`, `addMedia` (from search), `addManualMedia`, `updateProgress`, `setBookPages`, `addNote`, `addHighlight`, `addReply`. Each re-derives the member from the cookie and validates with Zod. Mutations call `revalidatePath` (`/room/<code>`, `"layout"` for progress/notes/highlights so the open modal refreshes).

---

## 8. Design System: warm, minimalist, blue-branded, light + dark
Calm, soft, lots of air. **Soft periwinkle blue is the brand/action colour** (buttons, focus rings, slider, logo, selected toggles); there is **no pink/peach accent any more**, so the UI reads as one blue family. Other pastels only carry meaning: lavender (blue-violet, `theory` tag), butter (`question` tag, locked cards), sage (success), sky (`review` tag), blush (the only pink: error messages). Tokens live in `app/globals.css`: raw values in `:root` / `.dark`, exposed to Tailwind through `@theme inline`, so components use token classes (`bg-brand`, `text-muted`) and adapt to dark mode automatically. **Do not hard-code hex colours in components**; add a token with a light and a dark value instead.

**Dark mode:** class `dark` on `<html>`. An inline script in `app/layout.tsx` sets it before first paint from `localStorage["scenara-theme"]`, else the system setting (no flash). `components/theme-toggle.tsx` (in the landing, room and demo headers) flips it and saves the choice. It is a **day/night switch**: dim sun at the left end, dim moon at the right end, and a glowing orb that glides between them in an arc, turning from sun to moon (right to left in reverse). The page changes with a **circular reveal growing from the switch** (View Transitions API, with `view-transition-name: theme-toggle` so the switch stays live). The orb is animated with the Web Animations API, started *after* the transition is ready, because the capture can freeze the page for a moment and CSS transitions would be partly swallowed. **The big sun/moon** (`components/sky-body.tsx`, mounted once in `app/layout.tsx`, `fixed -z-10`, behind all content) is a sun with a soft halo and slowly turning rays in the top-left corner in light mode, and a moon with craters in the top-right corner in dark mode. On toggle it travels across the sky (1.1 s, dipping through the middle) while turning sun↔moon; the toggle drives it through `data-sky` parts. Resting positions are CSS (`.sky-orb` / `.dark .sky-orb`). In dark mode a small boy with a golden scarf (`StargazerPrince` in `sky-body.tsx`) stands on the moon's upper-left shoulder watching a twinkling star; only the scarf and star move. **It is an original drawing inspired by the story of the little prince, not the published artwork, and it is not named in the UI.** If Scenara is ever released commercially, check the rights position of that character before keeping the homage. Cards that sit over it on the landing page are frosted (`bg-cream/70! backdrop-blur-md`) so it glows through. Reduced motion and browsers without View Transitions switch instantly. The component holds no state; resting positions come from the `dark` class. The sun/moon colours are fixed illustration colours (the only hard-coded colours allowed). Dark palette is deep navy with the same soft blue, slightly lighter. Use `text-on-brand` on `bg-brand`; "you" chips and anchor badges are `bg-brand-soft text-brand-ink`.

| Token | Value | Use |
|---|---|---|
| `paper` / `cream` | light `#FBF5EC` / `#FFFDF8`; dark `#0F1424` / `#171E33` | page / cards |
| `line` | `#EBDFCF` | borders |
| `ink` / `muted` | `#4A3A31` / `#7B6858` | text (≥4.5:1) |
| `brand` / `brand-deep` | light `#9DB4EA` / `#8AA3E0`; dark `#8EA5E0` / `#A6B9EC` | primary buttons, focus, slider, logo (soft dusty periwinkle, deliberately muted) |
| `on-brand` | light `#26324F`; dark `#0F1424` | text on `bg-brand` (dark navy, never white) |
| `brand-soft` / `brand-ink` | light `#E4EAF8` / `#3F5393`; dark `#222C4D` / `#B4C4F0` | soft blue fills, hover, highlights |
| `brand-text` / `brand-glow` | light `#4E68BD` / `#6F8BE0`; dark `#A9BCF0` / `#C2CFF5` | headline gradient (readable on `paper`) |
| `sage(-ink)` | `#D3E0C8` / `#46613F` | success, unlock toast |
| `lavender(-ink)` | `#E0E3F7` / `#4A4F9A` | theory tag |
| `butter(-ink)` | `#F8EBBE` / `#7A5E12` | question tag, locked cards, highlights |
| `sky(-ink)` | `#D0E4EE` / `#3A6479` | review tag |
| `blush(-ink)` | `#F6D8DC` / `#8A4455` | errors |
| `wood` / `wood-deep` | `#EAD7BD` / `#D8BD9A` | shelf planks |

**Type:** Fraunces (soft serif) for headings and logo; Geist for UI.
**Shape:** large radii, 1px `line` borders, light warm shadows. **Motion:** subtle; honour `prefers-reduced-motion`.
The table lists light values unless a dark value is shown; every token has a dark value in `.dark`.
**Rules:** text on pastel fills uses the matching `*-ink` colour or `ink`, never white. Tap targets ≥40px. Visible focus rings. Prefer the shared classes (`card`, `btn-primary`, `btn-soft`, `input`, `chip`, `eyebrow`, `empty`, `link`) over long utility strings.

---

## 9. Coding Conventions
- TypeScript strict; Zod for all Server Actions and API routes.
- Mobile first: most users arrive from a WhatsApp/Discord link.
- Handle loading, empty, error and missing-cover states everywhere.
- Read code before editing; make the smallest change; reuse helpers (`formatMediaUnit`, `isNoteUnlocked`, `getCurrentMember`, ...).
- Dependencies stay limited to Next.js, Tailwind, `lucide-react`, `zod`, `@supabase/supabase-js`. `import "server-only"` works without installing the package (Next resolves it).
- Any new user-visible content that could spoil (titles, quotes, comments) must be stripped on the server while locked.

---

## 10. Dev Workflow and Gotchas
**Commands:** `pnpm dev`, `pnpm build`, `pnpm lint`, `npx tsc --noEmit`. Verify with tsc + eslint + `next build` after edits.

**Gotchas learned the hard way:**
- **`cacheComponents` is on.** Reading `params`, `searchParams` or `cookies()` must happen inside a `<Suspense>` boundary (pages are a sync shell wrapping an async content component). A page that awaits `params` at the top level fails `next build` ("uncached or runtime data during prerendering").
- **Tailwind v4:** custom classes used inside `@apply` must be `@utility`, not `@layer components`. Dark variant is class-based via `@custom-variant dark` in `globals.css`.
- **React lint:** `react-hooks/set-state-in-effect` is enforced. Do not call `setState` synchronously in `useEffect`; use plain async form actions that set state after `await`.
- **Supabase URL** must not include `/rest/v1`. Changing `.env.local` needs a dev-server restart.
- **Stale servers:** killing `npx next start` can leave the child node process on the port, serving an old build with missing CSS. Kill by port (`ss -ltnp | grep :<port>`), not by wrapper PID.
- **Open Library is slow and flaky** (4-10 s, occasional connection errors). Keep the per-source timeout and the fallback; never make a search depend on it.
- **Images:** `next/image` is used with `unoptimized` for covers (stays inside Vercel Hobby limits). `next.config.ts` still lists remote hosts, including the Supabase project host.
- **The agent cannot run SQL.** After schema changes, ask the user to re-run `supabase/schema.sql`, then verify with a REST probe or browser test.
- **Testing approach used so far:** throwaway Playwright scripts kept **outside the repo** (e.g. `/tmp/pw`), seeding a temporary room through the Supabase REST API with the service key, driving the real UI with a pre-set member cookie, then deleting the room. Do not touch the user's real rooms.
- **Git:** remote is named `github`, branch `main` (`git push -u github main`). Auth needs a personal access token or `gh auth login`. Never commit `.env.local`; only commit when the user asks.

---

## 11. Current Status (update this when it changes)
**Built and verified in a browser against the real DB (30/30 Playwright checks):** rooms, shelves (create/rename/delete/switch/zoom/move), modal, highlight comments, manual add with cover upload, page tracking and rescale, locked entries never in HTML, search-add.

**Verified in a browser against the real DB (27/27, schema v1.5 applied):** owner key (hash only in DB, cookie, recovery on another device, wrong key rejected), viewer vs collaborator UI, locked text absent from viewer HTML, reviews always visible, viewer highlight comment and reply saved, owner promotes a viewer, non-adder cannot write on an item (legacy items stay open), collaborators/owner not offered for name reclaim. **Not browser-tested:** server-side rejection of forged write actions (covered by code review only), skeleton loading states, the feathered theme reveal (check smoothness by eye).

**Gotchas:** `next.config.ts` must not contain `output: "export"` (breaks the build; GitHub Pages cannot run this app). Fetch memoization is bypassed in `lib/supabase-server.ts`.

**Next step:** delete/moderation, rate limiting, then the activity timeline (ask the owner before building public rooms).

---

## 12. Roadmap
- **Done:** blue brand + dark mode + animated landing page, scaffold, search API, demo, identity cookie, rooms, add media, progress, gated entries, redesign, shelf + modal, highlight comments, entry titles, page tracking, media details, manual add.
- **Later:** rate limiting; edit/delete own entries and comments; per-season TV progress (`S01E04`); edit media details after adding; warm dark theme; a real test suite in the repo.
