-- LLM 2a: store every field the extraction returns, so the city reads them from the database
-- instead of re-guessing them with keyword matching. Safe to run more than once.
-- Paste into Supabase: SQL Editor > New query > Run.
begin;

alter table public.build_data
  add column if not exists description      text,
  add column if not exists micro_emotion    text,
  add column if not exists symbols          text[] not null default '{}',
  add column if not exists new_symbols      text[] not null default '{}',
  add column if not exists places           text[] not null default '{}',
  add column if not exists emotion_stated   boolean,
  add column if not exists hvdc_emotion     text,
  add column if not exists intensity_source text,
  add column if not exists mentioned_works  text[] not null default '{}',
  add column if not exists typical_dreams   text[] not null default '{}';

-- A second emotion is optional, and is never the same as the main one.
-- (Rows saved before this migration copied the main emotion into it.)
alter table public.build_data alter column secondary_emotion drop not null;
update public.build_data set secondary_emotion = null where secondary_emotion = main_emotion;

alter table public.build_data drop constraint if exists build_data_hvdc_emotion_check;
alter table public.build_data add constraint build_data_hvdc_emotion_check
  check (hvdc_emotion in ('anger', 'apprehension', 'sadness', 'confusion', 'happiness'));
alter table public.build_data drop constraint if exists build_data_intensity_source_check;
alter table public.build_data add constraint build_data_intensity_source_check
  check (intensity_source in ('self', 'ai'));
alter table public.build_data drop constraint if exists build_data_secondary_differs;
alter table public.build_data add constraint build_data_secondary_differs
  check (secondary_emotion is distinct from main_emotion);
alter table public.build_data drop constraint if exists build_data_typical_ids;
alter table public.build_data add constraint build_data_typical_ids check (
  array_to_string(typical_dreams, ',') ~ '^(tdq-(0[1-9]|[1-4][0-9]|5[0-5])(,tdq-(0[1-9]|[1-4][0-9]|5[0-5]))*)?$'
);

create index if not exists build_data_symbols on public.build_data using gin (symbols);
create index if not exists build_data_typical on public.build_data using gin (typical_dreams);

commit;

-- Older rows keep empty symbols and a null description. The city fills those from keyword
-- matching until you re-run LLM 2a on them: POST /api/journal/<session id>/build
