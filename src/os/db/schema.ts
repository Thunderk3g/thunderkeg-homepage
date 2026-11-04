/**
 * Research workspace schema. Every table except `events` is a one-way mirror
 * of the Research app's local store (src/os/db/mirror.ts): edit in the app,
 * query here. Writes made in psql are overwritten on the next sync.
 *
 * Every statement is idempotent so it runs on every boot, and the first block
 * retires the Metasploit-style lab tables older visitors still have in
 * IndexedDB.
 */
export const MIGRATIONS = `
drop table if exists creds, loot, notes, services, hosts, workspaces cascade;

create table if not exists papers (
  id         text primary key,
  title      text not null,
  authors    text[] not null default '{}',
  published  date,
  status     text,
  tags       text[] not null default '{}',
  abstract   text,
  saved_at   timestamptz
);

alter table papers add column if not exists rq_ids text[] not null default '{}';
alter table papers add column if not exists venue text;
alter table papers add column if not exists year int;
alter table papers add column if not exists citation_count int;
alter table papers add column if not exists arxiv_id text;
alter table papers add column if not exists bib_key text;
alter table papers add column if not exists source text;
alter table papers add column if not exists status_changed_at timestamptz;

create table if not exists paper_notes (
  paper_id     text primary key references papers(id) on delete cascade,
  five_cs      jsonb not null default '{}',
  problem      text not null default '',
  method       text not null default '',
  results      text not null default '',
  limitations  text not null default '',
  critique     text not null default '',
  delta        text not null default '',
  freeform     text not null default ''
);

create table if not exists highlights (
  id          text primary key,
  paper_id    text not null references papers(id) on delete cascade,
  text        text not null,
  location    text,
  why         text,
  card_id     text,
  created_at  timestamptz not null default now()
);

create table if not exists cards (
  id             text primary key,
  paper_id       text not null references papers(id) on delete cascade,
  prompt         text not null,
  answer         text not null,
  elaboration    text,
  rq_ids         text[] not null default '{}',
  origin         text,
  due            date not null,
  interval_days  int not null,
  step           int not null default 0,
  ease           numeric(4, 3),
  reps           int not null default 0,
  lapses         int not null default 0,
  suspended      boolean not null default false,
  created_at     timestamptz,
  last_reviewed  date
);

comment on column cards.interval_days is 'gap the scheduler used last time: the expanding ladder 1,3,7,16,35,80,180 days at this step';
comment on column cards.ease is 'share of this card''s reviews graded hard/good/easy (not again); null before the first review. The scheduler is a fixed ladder, not SM-2, so there is no ease factor to mirror.';

create table if not exists reviews (
  card_id       text not null references cards(id) on delete cascade,
  at            timestamptz not null,
  grade         text not null check (grade in ('again', 'hard', 'good', 'easy')),
  typed_recall  boolean not null default false,
  primary key (card_id, at)
);

create table if not exists events (
  id      bigserial primary key,
  kind    text not null,
  detail  jsonb,
  at      timestamptz not null default now()
);

create index if not exists events_at_idx on events (at desc);
create index if not exists cards_due_idx on cards (due);
create index if not exists highlights_paper_idx on highlights (paper_id);
create index if not exists reviews_card_idx on reviews (card_id);
`;
