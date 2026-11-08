-- Run once in Supabase SQL Editor before using the new message writer.
-- Keeps message IDs, content, roles and reply_to_id unchanged.
begin;
lock table public.journal_messages in exclusive mode;

create temporary table journal_message_positions on commit drop as
with questions as (
  select id, session_id,
    (2 * row_number() over (partition by session_id order by sequence, id) - 1)::integer as position
  from public.journal_messages where role = 'assistant'
), ranked as (
  select m.id, m.session_id,
    coalesce(q.position, parent.position, 0) as turn,
    case when m.role = 'user' and parent.id is not null then 1 else 0 end as after_question,
    m.sequence
  from public.journal_messages m
  left join questions q on q.id = m.id
  left join questions parent on parent.id = m.reply_to_id and parent.session_id = m.session_id
)
select id,
  -- Negative temporary slots avoid the existing unique(session_id, sequence).
  (-row_number() over (partition by session_id order by turn, after_question, sequence, id))::integer as temporary_position,
  case when turn = 0 then 0 else turn + after_question end as position
from ranked;

-- Refuse ambiguous legacy conversations instead of overwriting their ordering.
do $$ begin
  if exists (
    select m.session_id, p.position
    from journal_message_positions p join public.journal_messages m using (id)
    group by m.session_id, p.position having count(*) > 1
  ) then
    raise exception 'Ambiguous conversation: multiple original dreams or answers for one question. No rows changed.';
  end if;
end $$;

update public.journal_messages m set sequence = p.temporary_position
from journal_message_positions p where p.id = m.id;
update public.journal_messages m set sequence = p.position
from journal_message_positions p where p.id = m.id;
commit;
