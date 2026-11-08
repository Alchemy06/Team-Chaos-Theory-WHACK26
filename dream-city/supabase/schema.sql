-- Dream City database schema for Supabase (Postgres)
-- Paste into Supabase: SQL Editor > New query > Run.
-- Row-level security means every user can only read and write their own rows.
--
-- What is stored:
--   dreams          one row per dream (one building)
--   works           one row per book, film, song or game (one library building)
--   links           one row per road, saved when it is computed
--   symbol_labels   one row per symbol per user: the Yours / Common / Too early label, saved
--   research_cards  shared, read-only research citations
--   base_rates      shared, read-only DreamBank baseline
--   journal_sessions one row per dream conversation (final markdown in conversation_md)
--   journal_messages one row per question or answer in that conversation
--   build_data       one row per completed session: what the AI read from the markdown for its building
--   media            one row per recently consumed book, film, song or game (no login, server-only like journal)

-- ---------- types ----------
create type emotion as enum ('anger', 'apprehension', 'sadness', 'confusion', 'happiness', 'wonder');
create type work_kind as enum ('book', 'film', 'song', 'game');
create type honesty_label as enum ('yours', 'common', 'too_early', 'no_baseline');

-- ---------- dreams: one row per journal entry ----------
create table dreams (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dreamt_on         date not null default current_date,
  transcript        text not null,                       -- full text, any length
  follow_ups        jsonb not null default '[]',         -- [{ "q": "...", "a": "..." }]
  -- filled by the AI extraction step
  summary           text,
  primary_emotion   emotion not null,                    -- district
  micro_emotion     text not null,                       -- street
  intensity         smallint not null check (intensity between 1 and 10),
  symbols           text[] not null default '{}',
  places            text[] not null default '{}',
  themes            text[] not null default '{}',
  -- filled by the AI insight step
  insight           text,
  insight_card_ids  text[] not null default '{}',
  extraction_model  text,                                -- which model produced the fields
  created_at        timestamptz not null default now()
);

-- ---------- works: books, films, songs, games ----------
create table works (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind            work_kind not null,
  title           text not null,
  creator         text,
  consumed_on     date,
  rating          real check (rating between 0 and 5),
  user_review     text,                                  -- the user's own review, any length
  description     text,                                  -- synopsis from Open Library / TMDB
  -- filled by the AI work-extraction step
  primary_emotion emotion not null,
  symbols         text[] not null default '{}',
  themes          text[] not null default '{}',
  source          text,                                  -- 'letterboxd' | 'storygraph' | 'manual'
  external_id     text,
  created_at      timestamptz not null default now()
);

-- ---------- links: roads, saved once computed ----------
create table links (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dream_id          uuid not null references dreams (id) on delete cascade,
  to_type           text not null check (to_type in ('work', 'dream')),
  to_id             uuid not null,                       -- a works.id or dreams.id
  shared_symbols    text[] not null default '{}',        -- the evidence
  shared_themes     text[] not null default '{}',
  days_before       integer,                             -- how long before the dream the work was finished
  strength          real not null check (strength between 0 and 1),
  explanation       text not null,
  research_card_ids text[] not null default '{}',
  computed_at       timestamptz not null default now(),
  unique (user_id, dream_id, to_id)
);

-- ---------- symbol_labels: honesty labels, saved and refreshed after each new dream ----------
create table symbol_labels (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol      text not null,
  dream_count integer not null,
  user_rate   real not null,                             -- share of the user's dreams with this symbol
  base_rate   real,                                      -- share of DreamBank reports; null if unknown
  label       honesty_label not null,
  computed_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

-- ---------- shared reference data ----------
create table research_cards (
  id         text primary key,                           -- e.g. 'media-2018'
  claim      text not null,
  citation   text not null,
  url        text,
  confidence text not null,
  tags       text[] not null default '{}'
);

create table base_rates (
  symbol      text primary key,
  rate        real not null check (rate between 0 and 1),
  sample_size integer not null
);

-- ---------- journal: the question-and-answer conversation behind each dream ----------
-- No user_id (no login yet). RLS is on with no policies, so only the server
-- (service role key, lib/db.ts) can read or write these three tables.
create table journal_sessions (
  id              uuid primary key default gen_random_uuid(),
  status          text not null default 'draft' check (status in ('draft', 'questioning', 'completed')),
  conversation_md text,                                  -- final markdown journal
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create table journal_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references journal_sessions (id) on delete cascade,
  sequence    integer not null,                          -- order within the session, from 0
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  reply_to_id uuid references journal_messages (id) on delete set null,  -- the question an answer replies to
  created_at  timestamptz not null default now(),
  unique (session_id, sequence)
);

-- One row per building: everything LLM 2a read from the session (lib/buildData.ts, lib/extraction.ts).
-- Existing databases: run supabase/migrations/003_build_data_llm2a.sql instead of recreating the table.
create table build_data (
  journal_id        uuid primary key references journal_sessions (id) on delete cascade,
  main_emotion      emotion not null,                    -- district
  secondary_emotion emotion,                             -- a second stated feeling; null if none
  build_height      smallint not null check (build_height between 1 and 10),
  hover_desc        text not null,                       -- one line: building title and hover label
  themes            text[] not null default '{}',        -- from data/vocab.json themes
  description       text,                                -- up to two sentences on what happened
  micro_emotion     text,                                -- street, from data/vocab.json emotions
  symbols           text[] not null default '{}',        -- from data/vocab.json symbols (roads, labels, towers)
  new_symbols       text[] not null default '{}',        -- not in the vocab; kept for review
  places            text[] not null default '{}',
  emotion_stated    boolean,                             -- Hall and Van de Castle: only stated emotions are coded
  hvdc_emotion      text check (hvdc_emotion in ('anger', 'apprehension', 'sadness', 'confusion', 'happiness')),
  intensity_source  text check (intensity_source in ('self', 'ai')),
  mentioned_works   text[] not null default '{}',        -- titles the dreamer named, checked against the entry
  typical_dreams    text[] not null default '{}',        -- Typical Dreams Questionnaire ids, data/typicalDreams.json
  constraint build_data_secondary_differs check (secondary_emotion is distinct from main_emotion),
  constraint build_data_typical_ids check (
    array_to_string(typical_dreams, ',') ~ '^(tdq-(0[1-9]|[1-4][0-9]|5[0-5])(,tdq-(0[1-9]|[1-4][0-9]|5[0-5]))*)?$'
  )
);

-- ---------- media: what the user recently read, watched, played or listened to ----------
-- Same rules as the journal tables: no user_id, server-only via the service role key.
-- (works above needs a login and a required emotion; media is the no-login version.)
create table media (
  id           uuid primary key default gen_random_uuid(),
  kind         work_kind not null,                       -- book | film | song | game
  title        text not null,
  creator      text,                                     -- author, director, artist, studio
  consumed_on  date not null default current_date,
  user_note    text,                                     -- how it felt, in the user's words
  themes       text[] not null default '{}',             -- from data/vocab.json themes
  main_emotion emotion,                                  -- optional, user- or AI-set
  external_id  text,                                     -- e.g. 'tmdb:603', 'ol:OL82563W'
  created_at   timestamptz not null default now()
);

-- ---------- indexes ----------
create index dreams_user_date on dreams (user_id, dreamt_on);
create index dreams_symbols on dreams using gin (symbols);
create index works_user on works (user_id);
create index works_symbols on works using gin (symbols);
create index links_user_dream on links (user_id, dream_id);
create index links_to on links (to_id);
create index media_consumed_on on media (consumed_on desc);
create index media_themes on media using gin (themes);
create index build_data_symbols on build_data using gin (symbols);
create index build_data_typical on build_data using gin (typical_dreams);

-- ---------- row-level security ----------
alter table dreams enable row level security;
alter table works enable row level security;
alter table links enable row level security;
alter table symbol_labels enable row level security;
alter table research_cards enable row level security;
alter table base_rates enable row level security;
alter table journal_sessions enable row level security;
alter table journal_messages enable row level security;
alter table build_data enable row level security;
alter table media enable row level security;

create policy "own dreams" on dreams for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own works" on works for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own links" on links for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own labels" on symbol_labels for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "anyone reads research cards" on research_cards for select using (true);
create policy "anyone reads base rates" on base_rates for select using (true);
