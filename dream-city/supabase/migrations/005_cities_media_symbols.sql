-- Several dream cities (your own plus demo people such as Maya), and symbols on media so
-- books, films, songs and games link to dreams on shared symbols as well as themes.
-- Safe to run more than once. Paste into Supabase: SQL Editor > New query > Run.
begin;

create table if not exists public.cities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  blurb      text,
  is_demo    boolean not null default false,       -- fictional demo people
  created_at timestamptz not null default now()
);
alter table public.cities enable row level security;  -- server-only, like the journal tables

-- null city_id = the default "My city", so every existing dream and media row stays where it was
alter table public.journal_sessions add column if not exists city_id uuid references public.cities (id) on delete cascade;
alter table public.media add column if not exists city_id uuid references public.cities (id) on delete cascade;
alter table public.media add column if not exists symbols text[] not null default '{}';

create index if not exists journal_sessions_city on public.journal_sessions (city_id);
create index if not exists media_city on public.media (city_id);

-- The same title may now be in two different cities, but still only once per city
drop index if exists public.media_unique_title;
create unique index if not exists media_unique_title_city
  on public.media (coalesce(city_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, lower(trim(title)));

commit;
