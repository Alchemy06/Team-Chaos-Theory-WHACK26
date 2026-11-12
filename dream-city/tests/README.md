# Dream Journal tests

Run from `dream-city`:

```bash
npm test            # Every offline test; no external requests or live database writes
npm run test:all    # Offline tests, production build, then built-server smoke checks
npm run test:live   # Opt-in real Groq and assistant-audio checks; local app must be running
```

`test:live` uses configured provider credentials and may consume provider credits.
Its journals are fictional, database access is mocked, and its insight/audio HTTP
requests use non-persisted test IDs. It never creates test journals in Supabase.
Never use real journal text as a test fixture or add environment keys to this folder.

## Coverage

| Feature | Tests |
| --- | --- |
| Full journal → Markdown → extraction → insight → two Re-explore rounds | `journalJourney.test.mjs` |
| Input validation, failed writes, fallback questions, cross-session answers, completion retry | `journalFailures.test.mjs` |
| Markdown date, content and alternating message order | `journalMarkdown`, `journalSequence` |
| LLM 1, JSON mode retry, invalid responses, missing API key | `llmClient.test.mjs` |
| LLM 2 reads saved Markdown, validates outputs and retries | `llm2Markdown.test.mjs` |
| Insight citations, prohibited interpretations, support checker and fallback | `insightSafety.test.mjs` |
| Re-explore prompts, answer saves, previous reflections, update retry | `reexplore`, `reexploreRefresh` |
| Actual SQL migrations, duplicate prevention, stale workers, atomic building/insight snapshots | `reexploreDatabase`, `reexploreFinalDatabase` |
| Evidence does not mix different cities | `reexploreContext.test.mjs` |
| Voice/keyboard switching, late microphone events, manual Mic reset, answer isolation | `sharedVoiceAnswer.test.mjs` |
| City loading, stalled requests and retry | `loadSavedDreams.test.mjs` |
| Built app startup, journal redirect and API input validation | `smoke.test.mjs` |
| Real extraction, insight, question generation and playable assistant audio | `*.live.test.mjs` |

The full-journey harness runs the real routes, validators, AI orchestration and
database functions against the real schema in a disposable PGlite Postgres
database. Only the external Supabase transport and AI responses are replaced.
Tests run serially to limit the memory used by independent database instances.

## Browser/device checks

Automated microphone tests simulate recognition events. They do not establish
whether a particular browser grants microphone permission, transcribes your real
voice accurately, or routes audio to your speakers. Check those once on the
device: listen to a question, speak, stop, retry Mic, switch to Type, go Back/Next,
close/reopen, and save a round. Browser appearance and focus also need visual QA.
