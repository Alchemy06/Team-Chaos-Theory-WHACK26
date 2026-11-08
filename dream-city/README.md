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

## Several cities and the demo people

Each dream city is a person. "My city" is everything recorded without a city; the menu under the logo
switches city or makes a new one (table `cities`, migration 005). Media are tagged with symbols as well
as themes, so they become library buildings with roads to the dreams they share symbols, themes or a
named title with.

To load the fictional demo people (Maya, Theo, Priya; `data/personas.json`) into the database:

```bash
npm run seed:demo        # or: node scripts/seedPersonas.mjs maya
```

## How LLM 2b stays honest, and how we measure it

`lib/insight.ts` builds an evidence pack in code (dream, links to your media and earlier dreams, honesty
labels, DreamBank rates, typical dreams, research cards). The writer may only cite those ids. Code then
rejects unknown ids, invented numbers and interpretation words; a second model (`GROQ_JUDGE_MODEL`,
default `llama-3.3-70b-versatile`) checks every sentence is backed by what it cites. One retry, then a
template made only from evidence. Every insight is saved in `insights` with its attempts (migration 004).

Evaluation (run on your machine; needs GROQ_API_KEY in .env.local):

```bash
npm run eval:sample       # download DreamBank once, draw a fair sample + the 991 norm dreams
npm run eval:llm2a        # run the real LLM 2a on them (resumable)
pip install transformers torch && npm run eval:dreamy   # DReAMy's expert-trained emotion model
npm run eval:base-rates   # real DreamBank base rates, measured by LLM 2a itself
npm run eval:labels       # sheet for two people to hand-label 100 dreams
npm run eval:score        # data/eval/report_llm2a.md
npm run eval:llm2b        # data/eval/report_llm2b.md, plus 50 sentences to check by hand
```

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
