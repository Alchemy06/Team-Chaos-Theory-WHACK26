-- (added) Final Re-explore storage. Existing journal text and building values are preserved.
begin;
alter table public.build_data
  add column if not exists description text,
  add column if not exists micro_emotion text,
  add column if not exists symbols text[] not null default '{}',
  add column if not exists new_symbols text[] not null default '{}',
  add column if not exists places text[] not null default '{}',
  add column if not exists emotion_stated boolean,
  add column if not exists hvdc_emotion text,
  add column if not exists intensity_source text,
  add column if not exists mentioned_works text[] not null default '{}',
  add column if not exists typical_dreams text[] not null default '{}';
alter table public.build_data alter column secondary_emotion drop not null;

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journal_sessions(id) on delete cascade,
  text text not null,
  source text not null check (source in ('ai','fallback')),
  cited text[] not null default '{}',
  problems text[] not null default '{}',
  support jsonb not null default '{}',
  attempts jsonb not null default '[]',
  evidence jsonb not null default '[]',
  writer_model text,
  created_at timestamptz not null default now()
);
create index if not exists insights_journal_newest on public.insights(journal_id,created_at desc);
alter table public.insights enable row level security;
revoke all on public.insights from anon,authenticated;
grant all on public.insights to service_role;

alter table public.journal_explorations
  add column if not exists previous_insight jsonb,
  add column if not exists previous_building jsonb,
  add column if not exists insight_snapshot jsonb,
  add column if not exists building_snapshot jsonb,
  add column if not exists processing_token uuid,
  add column if not exists processing_until timestamptz;
alter table public.insights add column if not exists exploration_id uuid references public.journal_explorations(id) on delete set null;
create unique index if not exists insights_one_per_exploration on public.insights(exploration_id) where exploration_id is not null;

create or replace function public.claim_exploration_refresh(p_session_id uuid,p_round_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare journal public.journal_sessions%rowtype; round public.journal_explorations%rowtype; token uuid;
begin
  select * into journal from public.journal_sessions where id=p_session_id for update;
  if not found then raise exception 'Dream not found' using errcode='P0002'; end if;
  select * into round from public.journal_explorations where id=p_round_id and session_id=p_session_id for update;
  if not found then raise exception 'Round not found' using errcode='P0002'; end if;
  if round.build_updated and round.insight_snapshot is not null then return '{"done":true}'::jsonb; end if;
  if round.status<>'completed' or round.completed_markdown is distinct from journal.conversation_md then
    raise exception 'Round must be completed and match current history' using errcode='P0001';
  end if;
  if round.processing_until>clock_timestamp() then raise exception 'Update already running' using errcode='P0001'; end if;
  token:=gen_random_uuid();
  update public.journal_explorations set processing_token=token,processing_until=clock_timestamp()+interval '3 minutes' where id=p_round_id;
  return jsonb_build_object('token',token);
end;
$$;

create or replace function public.finish_exploration_refresh(p_session_id uuid,p_round_id uuid,p_token uuid,p_build jsonb,p_insight jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare journal public.journal_sessions%rowtype; round public.journal_explorations%rowtype; building public.build_data%rowtype; reflection public.insights%rowtype; saved_insight jsonb;
begin
  select * into journal from public.journal_sessions where id=p_session_id for update;
  if not found then raise exception 'Dream not found' using errcode='P0002'; end if;
  select * into round from public.journal_explorations where id=p_round_id and session_id=p_session_id for update;
  if not found then raise exception 'Round not found' using errcode='P0002'; end if;
  if p_token is null or round.processing_token is distinct from p_token or round.processing_until<clock_timestamp()
     or round.status<>'completed' or round.completed_markdown is distinct from journal.conversation_md then
    raise exception 'Expired or stale dream update' using errcode='P0001';
  end if;
  if p_insight->>'text' is null or length(trim(p_insight->>'text'))=0 then raise exception 'Reflection required'; end if;
  building:=jsonb_populate_record(null::public.build_data,p_build||jsonb_build_object('journal_id',p_session_id));
  insert into public.build_data(journal_id,main_emotion,secondary_emotion,build_height,hover_desc,themes,description,micro_emotion,symbols,new_symbols,places,emotion_stated,hvdc_emotion,intensity_source,mentioned_works,typical_dreams)
  values (p_session_id,building.main_emotion,building.secondary_emotion,building.build_height,building.hover_desc,building.themes,building.description,building.micro_emotion,building.symbols,building.new_symbols,building.places,building.emotion_stated,building.hvdc_emotion,building.intensity_source,building.mentioned_works,building.typical_dreams)
  on conflict(journal_id) do update set main_emotion=excluded.main_emotion,secondary_emotion=excluded.secondary_emotion,
    build_height=excluded.build_height,hover_desc=excluded.hover_desc,themes=excluded.themes,description=excluded.description,
    micro_emotion=excluded.micro_emotion,symbols=excluded.symbols,new_symbols=excluded.new_symbols,places=excluded.places,
    emotion_stated=excluded.emotion_stated,hvdc_emotion=excluded.hvdc_emotion,intensity_source=excluded.intensity_source,
    mentioned_works=excluded.mentioned_works,typical_dreams=excluded.typical_dreams;
  reflection:=jsonb_populate_record(null::public.insights,p_insight);
  insert into public.insights(journal_id,exploration_id,text,source,cited,problems,support,attempts,evidence,writer_model)
  values(p_session_id,p_round_id,reflection.text,reflection.source,coalesce(reflection.cited,'{}'),coalesce(reflection.problems,'{}'),coalesce(reflection.support,'{}'),coalesce(reflection.attempts,'[]'),coalesce(reflection.evidence,'[]'),reflection.writer_model)
  returning to_jsonb(insights.*) into saved_insight;
  update public.journal_explorations set build_updated=true,building_snapshot=to_jsonb(building),
    insight_snapshot=saved_insight,processing_token=null,processing_until=null where id=p_round_id;
end;
$$;

create or replace function public.release_exploration_refresh(p_session_id uuid,p_round_id uuid,p_token uuid)
returns void language sql security invoker set search_path=public as $$
  update public.journal_explorations set processing_token=null,processing_until=null
    where id=p_round_id and session_id=p_session_id and processing_token=p_token;
$$;
revoke all on function public.claim_exploration_refresh(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_exploration_refresh(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.release_exploration_refresh(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_exploration_refresh(uuid,uuid) to service_role;
grant execute on function public.finish_exploration_refresh(uuid,uuid,uuid,jsonb,jsonb) to service_role;
grant execute on function public.release_exploration_refresh(uuid,uuid,uuid) to service_role;
commit;
