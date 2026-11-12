# Test results — 8 November 2026

- Offline suite: 83 checks passed.
- Production build: passed, including TypeScript.
- Built-server smoke suite: 5 checks passed.
- Live provider checks: 11 checks passed across extraction, insight, follow-up questions, Re-explore questions and assistant audio.
- New test files: ESLint passed.

The journey integration test covers initial journal creation, three answers, final Markdown, extraction, insight, two Re-explore rounds, preserved snapshots and frontend city data. Failure tests cover provider outages, invalid input, persistence errors, retries and city isolation.

Offline database tests use disposable Postgres instances. Live checks use fictional fixtures and do not write test journals to Supabase. Real microphone permissions, physical audio playback and visual browser layout still require a device check.

See README.md for commands and coverage details.
