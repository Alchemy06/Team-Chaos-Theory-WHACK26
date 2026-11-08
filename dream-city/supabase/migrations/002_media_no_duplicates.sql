-- Removes duplicate media and stops new ones. Paste into Supabase: SQL Editor > New query > Run.
-- A duplicate = same kind + same title (ignoring case and spaces at the ends). The oldest row is kept.
delete from media m
using media older
where m.kind = older.kind
  and lower(trim(m.title)) = lower(trim(older.title))
  and (older.created_at, older.id) < (m.created_at, m.id);

create unique index if not exists media_unique_title on media (kind, lower(trim(title)));
