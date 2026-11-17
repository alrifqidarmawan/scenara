-- Scenara — MVP v1.3 schema (GEMINI.md §5): 6 tables + a public `covers` storage bucket.
-- Run in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Idempotent: safe to re-run. Tables use `if not exists`; indexes use `if not exists`;
-- enabling RLS twice is a no-op.

-- 1. Rooms
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[a-z0-9]{4,16}$'),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz default now()
);

-- 2. Room Members (Nickname-based, no auth)
create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 30),
  created_at timestamptz default now()
);

-- 3. Media inside a Room
create table if not exists room_media (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  media_type text not null check (media_type in ('tv', 'book')),
  external_id text not null,
  title text not null,
  cover_url text,
  total_units int not null default 100 check (total_units >= 1), -- episodes (TV) | pages (book with total_pages) | 100 (book, percent)
  total_pages int check (total_pages is null or total_pages >= 1), -- set => book progress is tracked in pages
  creator text check (creator is null or char_length(creator) <= 200),        -- author (book) / creator (TV)
  description text check (description is null or char_length(description) <= 2000),
  year int check (year is null or year between 1 and 3000),                  -- first published / first aired
  genres text check (genres is null or char_length(genres) <= 200),          -- comma separated
  created_at timestamptz default now()
);

-- 4. Individual Member Progress
create table if not exists member_progress (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references room_members(id) on delete cascade,
  media_id uuid not null references room_media(id) on delete cascade,
  current_unit int not null default 0 check (current_unit >= 0),
  updated_at timestamptz default now(),
  unique (member_id, media_id)
);

-- 5. Contextual Notes (Spoiler-gated by anchor_unit)
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  media_id uuid not null references room_media(id) on delete cascade,
  member_id uuid not null references room_members(id) on delete cascade,
  author_name text not null,
  anchor_unit int not null default 0 check (anchor_unit >= 0), -- episode # or book %
  anchor_label text not null,           -- e.g. 'Ep 4', 'p. 120 · Ch. 9' or '42% · Ch. 9'
  title text check (title is null or char_length(title) <= 80), -- entry title, e.g. 'Chapter 8: The reveal'
  tag text not null default 'note' check (tag in ('note', 'theory', 'question', 'review')),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz default now()
);

-- 6. Highlight comments: a member selects part of an entry and comments on it.
--    Flat (no reply threads). Offsets are UTF-16 indices into notes.content.
create table if not exists note_highlights (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  member_id uuid not null references room_members(id) on delete cascade,
  author_name text not null,
  start_offset int not null check (start_offset >= 0),
  end_offset int not null,
  quote text not null,
  comment text not null check (char_length(comment) between 1 and 500),
  created_at timestamptz default now(),
  check (end_offset > start_offset)
);

-- Upgrades for databases created before v1.2 (no-ops on fresh installs) ---------
alter table room_media add column if not exists total_pages int check (total_pages is null or total_pages >= 1);
alter table notes add column if not exists title text check (title is null or char_length(title) <= 80);
alter table room_media add column if not exists creator text check (creator is null or char_length(creator) <= 200);
alter table room_media add column if not exists description text check (description is null or char_length(description) <= 2000);
alter table room_media add column if not exists year int check (year is null or year between 1 and 3000);
alter table room_media add column if not exists genres text check (genres is null or char_length(genres) <= 200);

-- Set or change a book's total pages. Atomically rescales every member's progress and
-- every note anchor (percent -> pages, or old pages -> new pages), so nothing drifts.
create or replace function set_book_pages(p_media_id uuid, p_pages int)
returns void
language plpgsql
as $$
declare
  m room_media%rowtype;
  old_total int;
begin
  if p_pages is null or p_pages < 1 or p_pages > 10000 then
    raise exception 'pages must be between 1 and 10000';
  end if;

  select * into m from room_media where id = p_media_id and media_type = 'book' for update;
  if not found then
    raise exception 'book not found';
  end if;

  old_total := m.total_units;
  if old_total = p_pages and m.total_pages = p_pages then
    return;
  end if;

  update member_progress
     set current_unit = least(p_pages, round(current_unit::numeric * p_pages / old_total)::int),
         updated_at = now()
   where media_id = p_media_id;

  update notes
     set anchor_label = regexp_replace(
           anchor_label,
           '^(p\. [0-9]+|[0-9]+%)',
           'p. ' || least(p_pages, round(anchor_unit::numeric * p_pages / old_total)::int)::text
         ),
         anchor_unit = least(p_pages, round(anchor_unit::numeric * p_pages / old_total)::int)
   where media_id = p_media_id;

  update room_media set total_units = p_pages, total_pages = p_pages where id = p_media_id;
end;
$$;

-- Only the server (service role) may call it.
revoke all on function set_book_pages(uuid, int) from public, anon, authenticated;

-- Indexes ------------------------------------------------------------------
create unique index if not exists room_members_nickname_uniq
  on room_members (room_id, lower(nickname));
create unique index if not exists room_media_unique_per_room
  on room_media (room_id, media_type, external_id);
create index if not exists room_media_room_idx on room_media (room_id);
create index if not exists member_progress_media_idx on member_progress (media_id);
create index if not exists notes_media_anchor_idx on notes (media_id, anchor_unit desc);
create index if not exists note_highlights_note_idx on note_highlights (note_id);

-- Security -----------------------------------------------------------------
-- v1 has no Supabase Auth: the app talks to these tables with the service role
-- key from the server only. RLS is enabled with NO policies, so the public anon
-- key can read and write nothing. (The service role bypasses RLS.)
alter table rooms           enable row level security;
alter table room_members    enable row level security;
alter table room_media      enable row level security;
alter table member_progress enable row level security;
alter table notes           enable row level security;
alter table note_highlights enable row level security;

-- Cover uploads (manual add) ----------------------------------------------
-- Public bucket: covers are shown to anyone with the room link. Uploads happen only
-- from the server with the service role key (no insert policy exists for anon).
-- The browser shrinks images to ~600px JPEG first; the bucket caps files at 1 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
