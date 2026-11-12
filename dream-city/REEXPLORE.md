# Re-explore — final flow

Each round asks three fresh questions using the complete saved conversation and previous AI reflections. Reflections are explicitly labelled as AI context, never evidence about the dreamer.

Answers are saved first to journal_messages and appended to journal_sessions.conversation_md. A separate retryable refresh uses LLM 2a, server-side evidence from the same city, and the shared LLM 2b writer and support checker. The resulting building, cited insight, and permanent round snapshots are committed atomically. Earlier rounds retain their questions, answers, Markdown, building snapshot and reflection. The first round also captures the prior reflection and building when available.

The popup reuses the original assistant voice, microphone, keyboard mode, Next/Back and manual Mic retry behaviour. Closing preserves unfinished typed answers in this tab. Refresh errors never remove saved answers. Retry update works after reopening the panel; overlapping workers are leased and expired workers cannot overwrite a newer update.

Database setup: apply 004_reexplore.sql first, then 20261108105134_reexplore_insights.sql. The final migration adds missing extraction/insight storage and snapshot fields without rewriting existing dream text or building values. All new functions are service-role-only. Existing no-login journal access remains unchanged.

Tests: npm test; npm run test:llm2; npm run test:reexplore; npm run build; npm run test:smoke. AI and microphone tests use mocks. SQL transaction tests execute the actual migrations in disposable local Postgres; they never write to the live database.
