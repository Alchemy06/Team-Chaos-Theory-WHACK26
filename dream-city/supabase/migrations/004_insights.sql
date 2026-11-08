-- LLM 2b: save every insight with its evidence, citations, support check and attempts, so insights
-- follow the user across devices and we can measure how often the AI passes, retries or falls back.
-- Safe to run more than once. Paste into Supabase: SQL Editor > New query > Run.
create table if not exists public.insights (
  id           uuid primary key default gen_random_uuid(),
  journal_id   uuid not null references public.journal_sessions (id) on delete cascade,
  text         text not null,                            -- the insight shown, with [id] citations
  source       text not null check (source in ('ai', 'fallback')),
  cited        text[] not null default '{}',             -- evidence ids it cites
  problems     text[] not null default '{}',             -- why AI drafts were rejected
  support      jsonb not null default '{}',              -- second-model check: verdict per sentence
  attempts     jsonb not null default '[]',              -- every draft with its problems
  evidence     jsonb not null default '[]',              -- the evidence pack it was written from
  writer_model text,
  created_at   timestamptz not null default now()
);

create index if not exists insights_journal_newest on public.insights (journal_id, created_at desc);

-- Server-only like the journal tables: RLS on, no policies, written with the service role key.
alter table public.insights enable row level security;
