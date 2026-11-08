-- Adds the media table to a database that already ran schema.sql.
-- Paste into Supabase: SQL Editor > New query > Run.
create table if not exists media (
  id           uuid primary key default gen_random_uuid(),
  kind         work_kind not null,
  title        text not null,
  creator      text,
  consumed_on  date not null default current_date,
  user_note    text,
  themes       text[] not null default '{}',
  main_emotion emotion,
  external_id  text,
  created_at   timestamptz not null default now()
);
create index if not exists media_consumed_on on media (consumed_on desc);
create index if not exists media_themes on media using gin (themes);
alter table media enable row level security;
