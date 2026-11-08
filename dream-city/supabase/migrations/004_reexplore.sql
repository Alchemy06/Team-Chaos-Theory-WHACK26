-- (added) Append-only re-exploration history; service-role access only, like the journal.
begin;
create table public.journal_explorations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.journal_sessions(id) on delete cascade,
  questions text[] not null check (cardinality(questions) = 3),
  answers text[] check (answers is null or cardinality(answers) = 3),
  base_markdown text not null,
  completed_markdown text,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  build_updated boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (status <> 'completed' or (answers is not null and completed_markdown is not null and completed_at is not null))
);
create index journal_explorations_session on public.journal_explorations(session_id, created_at);
create unique index journal_explorations_one_draft on public.journal_explorations(session_id) where status = 'draft';
alter table public.journal_explorations enable row level security;
revoke all on public.journal_explorations from anon, authenticated;
grant all on public.journal_explorations to service_role;

create function public.complete_journal_exploration(p_session_id uuid, p_round_id uuid, p_answers text[])
returns void language plpgsql security invoker set search_path = public as $$
declare
  journal public.journal_sessions%rowtype;
  round public.journal_explorations%rowtype;
  next_sequence integer;
  question_id uuid;
  final_markdown text;
  i integer;
begin
  if cardinality(p_answers) <> 3 or p_answers is null or exists (
    select 1 from unnest(p_answers) a where a is null or length(trim(a)) = 0 or length(a) > 4000
  ) then raise exception 'Three non-empty answers required' using errcode = 'P0001'; end if;

  -- (added) Serialise writers for this dream and keep the retry operation idempotent.
  select * into journal from public.journal_sessions where id = p_session_id for update;
  if not found then raise exception 'Dream not found' using errcode = 'P0002'; end if;
  select * into round from public.journal_explorations where id = p_round_id and session_id = p_session_id for update;
  if not found then raise exception 'Round not found' using errcode = 'P0002'; end if;
  if round.status = 'completed' then
    if round.answers <> p_answers then raise exception 'Round already answered' using errcode = 'P0001'; end if;
    return;
  end if;
  if journal.status <> 'completed' or journal.conversation_md is distinct from round.base_markdown then
    raise exception 'Journal changed since this round started' using errcode = 'P0001';
  end if;
  select coalesce(max(sequence), 0) + 1 into next_sequence from public.journal_messages where session_id = p_session_id;
  if next_sequence % 2 = 0 then next_sequence := next_sequence + 1; end if;
  final_markdown := rtrim(journal.conversation_md) || E'\n\n## Re-exploration — '
    || to_char(current_timestamp at time zone 'UTC', 'FMDD FMMonth YYYY') || E'\n';
  for i in 1..3 loop
    insert into public.journal_messages(session_id, sequence, role, content)
      values (p_session_id, next_sequence, 'assistant', round.questions[i]) returning id into question_id;
    insert into public.journal_messages(session_id, sequence, role, content, reply_to_id)
      values (p_session_id, next_sequence + 1, 'user', p_answers[i], question_id);
    next_sequence := next_sequence + 2;
    final_markdown := final_markdown || E'\n## Assistant\n\n' || round.questions[i] || E'\n\n## User\n\n' || p_answers[i] || E'\n';
  end loop;
  update public.journal_sessions set conversation_md = final_markdown where id = p_session_id;
  update public.journal_explorations set answers = p_answers, status = 'completed',
    completed_markdown = final_markdown, completed_at = now() where id = p_round_id;
end;
$$;
revoke all on function public.complete_journal_exploration(uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.complete_journal_exploration(uuid, uuid, text[]) to service_role;
commit;
