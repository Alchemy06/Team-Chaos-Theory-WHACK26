# Dream City by CHAOS THEORY @ WHACK26

This is a project that functions as an AI-powered dream and media journal that allows you to explore the world inside your mind.

Every night we spend around two hours dreaming, and by breakfast most of it is gone. Dream City turns your dream journal into a 3D voxel city you can walk through. Every dream becomes a building, every emotion becomes a district, and the films, books, songs and games you love become buildings in your library, connected to your dreams by glowing roads.

> Built in a weekend for WHACK26 (Marshall Wace track, theme: *New Worlds*). The most unexplored world isn't far away: it's the one each of us builds every night.

---

## What it does

- **Record a dream by voice or text.** The journal asks three short follow-up questions: how it felt, how intense it was (1–10), and one AI-written question that connects the dream to your waking life. The questions are read aloud.
- **Watch it become a building.** The dream rises in the district for its emotion. Its height is the intensity you gave it.
- **See what it contained.** Open a building to see a summary, the main and second emotion, the symbols and themes, places, any works you named, and which of the **55 typical dream themes** it matches (for example "Being chased: 81.5% of students have had this dream").
- **Read the full entry.** Click a dream's title or insight to open the whole journal entry: the dream and every question and answer.
- **Add your media.** Search for a film (TMDB) or game (Steam, or RAWG with a key), or add a book or song. Each work becomes a library building, and the app tags it with the same symbol and theme lists used for dreams.
- **Follow the roads.** When a dream and a work share symbols, themes, a feeling, or fall in the right time window, a road connects them. Bright roads are strong links, dashed roads weaker ones. Click any road and it explains exactly why it exists.
- **Find your own patterns.** A symbol that keeps coming back becomes a **landmark**, but only once a statistics test says it isn't chance.
- **Get a cited insight.** Each dream gets a short insight in which every claim cites its source (your dream, a road to your media, a research card or a typical-dream figure) and ends with a question to you. It never tells you what a dream "means".
- **Switch cities.** Each city belongs to one person. The menu under the logo switches between cities (including the fictional demo people) or creates a new one.

## How it works

Dream City is built like a research pipeline: **models read, rules decide, and everything is audited.**

```
Voice ─► text ─► 3 questions (LLM 1) ─► LLM 2a codes the dream ─► code builds the city ─► LLM 2b writes a cited insight
                                         (fixed vocabulary,         (roads, landmarks,       ─► code checks ─► judge model
                                          validated by code)          layout: no AI)          ─► saved with every attempt
```

1. **LLM 1 (questions).** Questions 1 and 2 are fixed so every dream is measured the same way. The AI writes only question 3, and it is not allowed to interpret.
2. **LLM 2a (extraction).** A Groq-hosted model (`openai/gpt-oss-120b` by default) reads **only the dream and its answers** and codes it into a fixed vocabulary:
   - six emotion districts with finer "street" feelings
   - 62 symbols and 46 themes
   - the 55 Typical Dreams Questionnaire themes

   Code validates every field, retries once, keeps a named work only if it really appears in the text, and lets your own intensity rating override the AI's. The model never sees your media or the research, so it can't bend a dream towards a film.
3. **Media tagging.** Each work is tagged separately into the same vocabulary, from its title, its TMDB or Steam description and your note. It never sees your dreams. The two are independent, with no leakage between them.
4. **The city (plain code, no AI).**
   - **Roads.** Each road is a transparent weighted score of shared symbols, shared themes, matching emotion, timing and whether you named the work. The timing follows dream research: dreams draw most on the previous day, and again about 5–7 days later (the *dream-lag* effect).
   - **Landmarks.** A symbol becomes a landmark only when it has appeared at least 3 times **and** an exact one-sided binomial test against its base rate gives p < 0.05.
   - **Layout.** It is deterministic, so the same journal always builds the same city.
5. **LLM 2b (insights).** The writer may use only an evidence pack built in code, and must cite it. Before an insight is shown:
   - Code rejects unknown citations, numbers that aren't in the evidence, interpretation words ("means", "represents", "your mind is processing"…), and anything over 90 words.
   - A **different** model (`llama-3.3-70b-versatile`, with `openai/gpt-oss-20b` as backup) checks every sentence against what it cites.
   - A failed draft goes back to the writer once. A second failure shows a template built only from the evidence.
   - Every insight is saved with all its attempts.

## The research behind it

| Source | How Dream City uses it |
|---|---|
| **Hall & Van de Castle** emotion classes, the standard coding system in dream research | Five of the six districts (anger, apprehension, sadness, confusion, happiness). We added **Wonder** for awe and discovery; it counts as happiness whenever we compare with research. |
| **Typical Dreams Questionnaire**, Nielsen et al. (2003), 1,181 students | All 55 themes and how common each one is. |
| **Dream-lag / day-residue research** | How the timing between watching something and dreaming changes a road's strength. |
| **DreamBank** (20,000+ dream reports) and **DReAMy** (a published DreamBank emotion model) | Evaluation scripts that compare our coding with DReAMy and hand labels (`npm run eval:*`). DreamBank is licensed CC BY-NC-SA 4.0 (non-commercial). |

**What is and isn't validated yet:**
- The evaluation scripts are built but haven't been run, so there are no accuracy numbers yet.
- The base rates in `data/baseRates.json` are placeholders, so treat landmarks as a demonstration of the method.
- The road weights are hand-set heuristics, not fitted.

## Tech

- **App:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Zustand
- **3D city:** React Three Fiber + Drei. Every voxel building, road and island is generated in code.
- **AI:** Groq (OpenAI-compatible API), with outputs checked by Zod schemas
- **Voice:** the browser's speech recognition for dictation; ElevenLabs reads the questions aloud
- **Data:** Supabase (Postgres) through server-side API routes only
- **Media search:** TMDB (films), Steam store search (games, no key needed), RAWG (optional)

---

## How to run it

### What you need

- **Node.js 22+** and npm, **or** Docker Desktop. With WSL or Linux, turn on WSL integration in Docker's settings.
- A **Groq API key** (free at [console.groq.com](https://console.groq.com)).
- A **Supabase** project: its URL and service-role key.
- *Optional:* a TMDB read token (film search), a RAWG key (game search; Steam is used without one) and ElevenLabs keys (spoken questions).

### 1. Get the code

```bash
git clone https://github.com/Alchemy06/Team-Chaos-Theory-WHACK26.git
cd Team-Chaos-Theory-WHACK26/dream-city
```

### 2. Add your keys

Copy the example file to `.env.local` and fill it in:

```bash
cp .env.local.example .env.local            # macOS / Linux
Copy-Item .env.local.example .env.local     # Windows PowerShell
```

| Variable | Needed? | What it's for |
|---|---|---|
| `GROQ_API_KEY` | Yes | Questions, extraction, media tagging and insights |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only database key. **Never** commit it or expose it to the browser |
| `TMDB_TOKEN` | Optional | Film search and descriptions |
| `RAWG_KEY` | Optional | Game search (otherwise Steam is used) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Optional | Reading the questions aloud |
| `GROQ_MODEL` | Optional | Writer model (default `openai/gpt-oss-120b`) |
| `GROQ_JUDGE_MODEL` | Optional | Checker models, comma-separated (default `llama-3.3-70b-versatile,openai/gpt-oss-20b`) |
| `INSIGHT_SUPPORT_CHECK` | Optional | Set to `off` to skip the second-model check |

`.env.local` is git-ignored. Keep real keys only there.

### 3. Set up the database

In the Supabase dashboard, open **SQL Editor** and run one of these:

- **New project:** run `supabase/schema.sql`.
- **Existing project:** run the migrations in `supabase/migrations/` in order (`001` → `005`). They are safe to re-run. Migrations 003–005 add the full dream data, saved insights, and cities with media symbols.

### 4. Start the app

**With Docker**, from the `dream-city` folder:

```bash
docker compose up --build -d
```

**Or with Node:**

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

### 5. Optional: load the demo cities

Load three fictional people, Maya, Theo and Priya, each with their own dreams and media:

```bash
npm run seed:demo           # everyone
node scripts/seedPersonas.mjs maya   # just one person
```

Pick them from the city menu under the Dream City logo. The seed makes no AI calls and is safe to re-run.

### Tests

```bash
npm test             # journal sequence, journal markdown, saved-dream loading
npm run test:llm2    # extraction pipeline (mocked)
npm run test:smoke   # smoke test
```

Live tests that call Groq: `npm run test:llm2:live` and `npm run test:insight:live`. These use `VAR=1 command` syntax, so on Windows run them from WSL or Git Bash.

### If something doesn't work

- **No questions, or "could not extract":** check `GROQ_API_KEY`. The app falls back to the fixed questions, and offers an offline keyword estimate for the dream.
- **City is empty or saving fails:** check the Supabase keys, and that the schema or migrations have been run.
- **Insight says "Template":** the AI was unavailable or failed the checks twice. Every sentence was filled in from the evidence by code.
- **Insight says "second check not run":** the judge model was unavailable. The code checks still ran.
- **`Can't resolve '@react-three/drei'` in Docker:** rebuild with `docker compose down -v` then `docker compose up --build -d`, so the container's `node_modules` are reinstalled.

## Project structure

The app lives in [`dream-city/`](dream-city). See [`dream-city/README.md`](dream-city/README.md) for how the code is split, the API flow, and the evaluation scripts.

## What's next

- Run the DreamBank evaluation and publish accuracy, with confidence intervals.
- Replace the placeholder base rates with real DreamBank rates.
- Fit the road weights on labelled data.
- A smaller, specialised model trained on labelled dream data.
- Private accounts.

---

Made by **Team Chaos Theory** at WHACK26.
