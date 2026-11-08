# Dream City

A map of your mind: dreams become a voxel night city you can explore.
Districts are emotions, streets are micro-emotions, each dream is a building
(height = intensity, lit windows = recency), and glowing roads link dreams to
the books, films, songs and games that share their symbols.

## Run

```bash
npm install
echo "GROQ_API_KEY=..." > .env.local   # optional: without it the app uses fallbacks
npm run dev                            # http://localhost:3000
```

## How the code is split

| Area | Folder | Notes |
| --- | --- | --- |
| Data | `data/` | vocab, the 55 typical dreams, research cards, base rates |
| Logic | `lib/` | types, `computeLinks`, `symbolStats`, deterministic `layoutCity`, prompts, checks |
| API | `app/api/{followup,extract,insight}` | Groq-backed; server-side only |
| State | `store/` | Zustand store (user dreams + insights persisted to `localStorage`) and `cityModel.ts`, which derives the city from `lib/` |
| API client | `services/api.ts` | the only place the frontend calls the backend |
| 3D world | `components/world/` | React Three Fiber, client-only (`next/dynamic`, `ssr: false`). `cityGeometry.ts` maps `layoutCity()` output onto the voxel grid |
| HUD | `components/hud/` | Tailwind panels, record flow, time-lapse, legend (never imports three) |

## Recording a dream (frontend ↔ backend)

1. `POST /api/journal { transcript }` saves the dream and LLM 1's three questions (Q1/Q2 fixed, Q3 by the AI).
2. Each answer is saved with `POST /api/journal/<id>/answers`; `POST /api/journal/<id>/complete`
   writes the whole conversation to `journal_sessions.conversation_md`.
3. **LLM 2a**: `POST /api/extract { sessionId }` reads that saved dream and Q&A (never the user's media
   or research papers), checks the answer in code (`lib/extraction.ts`) and stores every field in
   `build_data`: summary, description, main and second emotion, street, intensity, symbols, themes,
   places, works the dreamer named, and which of the 55 Typical Dreams Questionnaire themes it contains
   (`data/typicalDreams.json`, Nielsen et al. 2003). `/api/journal/<id>/build` re-runs the same step.
4. `GET /api/city` turns the stored rows into buildings; roads, honesty labels and the layout are computed in code.
5. **LLM 2b**: `POST /api/insight { dream, links, works, dreams, stats }` → cited insight
   (`[card:…]`, `[road:…]`, `[label:…]`, `[db:…]`, `[typical:…]` render as chips).
   Click a dream's title or insight to read the full journal entry.

Database: run `supabase/schema.sql` on a new project, or `supabase/migrations/003_build_data_llm2a.sql`
on an existing one (safe to re-run). Rows saved before 003 still show; their symbols are estimated
by keyword until LLM 2a is re-run on them.

Fallbacks: if follow-ups fail, the fixed questions are used; if extraction
fails (e.g. no `GROQ_API_KEY`), the user can choose an **offline estimate**
(`services/offline.ts`, keyword matching against the same vocab); the insight
route always returns a checked template if the model fails.

## 3D assets

All voxel models are generated in code (`components/world/voxel.ts`). To use a
Blender model instead, export a `.glb` on a 1-unit grid (origin at the
footprint centre, ground at 0, Closest texture filtering), put it in
`public/models/`, and render it with Drei's `useGLTF` inside the matching
component's wrapper `group` so hover, selection and the rise animation still work.
