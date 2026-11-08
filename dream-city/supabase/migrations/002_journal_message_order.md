# Journal conversation order

Run `002_journal_message_order.sql` in Supabase's SQL Editor while journal
submissions are paused, before restarting with the updated app. It only changes
`journal_messages.sequence`; message IDs, content, roles and reply links remain
unchanged. The transaction rolls back if legacy rows have ambiguous pairings.
The live database is not updated by building or starting the app.

In the Table Editor, filter to one `session_id` and sort `sequence` ascending:

| sequence | role | content |
| --- | --- | --- |
| 0 | user | Original dream |
| 1 | assistant | First question |
| 2 | user | First answer |
| 3 | assistant | Second question |
| 4 | user | Second answer |
| 5 | assistant | Third question |
| 6 | user | Third answer |

Skipped answers leave gaps. `reply_to_id` still points to the specific question.
SQL tables have no default row order, so always request an explicit sort:

```sql
select session_id, sequence, role, content, reply_to_id
from public.journal_messages
order by session_id, sequence;
```

Run `npm test` for ordering regressions and
`npm run build && npm run test:smoke` for production route checks.
These tests do not connect to Supabase or apply the SQL migration.
