# Re-explore

The building's detail panel has a **Re-explore this dream** button below its
insight. It prepares exactly three new questions from the complete saved journal.
It uses the existing Groq model with a question-writing prompt; LLM 2 then reads
the expanded journal to refresh the same building after the answers are saved.

## Database setup

Apply `supabase/migrations/004_reexplore.sql` once in Supabase SQL Editor before
using the feature. It adds a server-only `journal_explorations` table and an atomic
save function. No existing rows are changed by the migration. Like the existing
journal routes, this feature uses the server's service-role client and the app's
current no-login access model.

Each saved round appends six messages to `journal_messages`, keeping answer links,
and appends a dated section to `journal_sessions.conversation_md`. The original
Markdown remains at the beginning, and each completed round retains a full
Markdown snapshot. Retries with identical answers do not append duplicates.
Changed answers to a completed round are rejected. A draft based on a changed
journal is rejected rather than overwriting newer history.

Closing the form keeps the generated questions in the database; unfinished typed
answers stay in this browser tab's session storage. Saving requires three answers
(“I don't know” is a valid answer). Questions are generated from the full history,
not from a summary. If generation fails, nothing is appended to the conversation.
If extraction fails, the answers remain saved and **Retry building update** is
available, including after reopening the panel.

The full-entry and transcript views continue to show every saved question/answer.
The original dream ID, date, text, and original completion timestamp are preserved.

## Checks

Run `npm test`, `npm run test:llm2`, `npm run test:reexplore`, `npm run build`, and
`npm run test:smoke`. Automated AI calls are mocked. Database migration tests use
a local disposable Postgres-compatible database, never the live Supabase project.
