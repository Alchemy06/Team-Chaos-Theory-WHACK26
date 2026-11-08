// Adds the fictional demo people in data/personas.json (Maya, Theo, Priya), each in their own city,
// to the configured Supabase database. Needs migrations 003 and 005. Safe to rerun: stable ids, upserts.
//
//   node scripts/seedPersonas.mjs            (all people)
//   node scripts/seedPersonas.mjs maya       (just Maya)
//
// No AI calls: every stored field (emotions, symbols, typical dreams, media symbols) is written in the
// data file, so the demo city looks the same every time. Insights are written live when a dream is opened.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { createClient } = require("@supabase/supabase-js");
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
const db = createClient(url, key, { auth: { persistSession: false } });

const { people } = JSON.parse(await readFile("data/personas.json", "utf8"));
const vocab = JSON.parse(await readFile("data/vocab.json", "utf8"));
const only = process.argv.slice(2).map((s) => s.toLowerCase());

function uuid(label) {
  const h = createHash("sha256").update("dream-city-personas-v1:" + label).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function checked(result, what) {
  if (result.error) {
    const hint = /city_id|cities|symbols|description|typical_dreams/.test(result.error.message)
      ? " Run supabase/migrations/003_build_data_llm2a.sql and 005_cities_media_symbols.sql first."
      : "";
    throw new Error(`${what}: ${result.error.message}.${hint}`);
  }
  return result.data;
}
const titleDate = (iso) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

const summary = [];
for (const person of people) {
  if (only.length && !only.includes(person.key)) continue;
  const cityId = uuid(`city:${person.key}`);
  checked(await db.from("cities").upsert({ id: cityId, name: person.name, blurb: person.blurb, is_demo: true }), `city ${person.name}`);

  for (const d of person.dreams) {
    const id = uuid(`${person.key}:${d.key}`);
    const at = `${d.date}T08:00:00Z`;
    // Same shape as a real recording: the dream, then each question and its answer (lib/journalSequence.ts)
    const messages = [{ id: uuid(`${person.key}:${d.key}:dream`), session_id: id, sequence: 0, role: "user", content: d.transcript, reply_to_id: null, created_at: at }];
    const sections = [`# Dream Journal — ${titleDate(at)}`, `## User\n\n${d.transcript}`];
    d.followUps.forEach((f, i) => {
      const qId = uuid(`${person.key}:${d.key}:q${i}`);
      messages.push({ id: qId, session_id: id, sequence: i * 2 + 1, role: "assistant", content: f.q, reply_to_id: null, created_at: at });
      sections.push(`## Assistant\n\n${f.q}`);
      if (f.a) {
        messages.push({ id: uuid(`${person.key}:${d.key}:a${i}`), session_id: id, sequence: i * 2 + 2, role: "user", content: f.a, reply_to_id: qId, created_at: at });
        sections.push(`## User\n\n${f.a}`);
      }
    });
    checked(
      await db.from("journal_sessions").upsert({ id, city_id: cityId, status: "completed", conversation_md: sections.join("\n\n") + "\n", created_at: at, completed_at: at }),
      `session ${person.key}/${d.key}`,
    );
    checked(await db.from("journal_messages").upsert(messages), `messages ${person.key}/${d.key}`);
    checked(
      await db.from("build_data").upsert({
        journal_id: id,
        main_emotion: d.primaryEmotion,
        secondary_emotion: d.secondaryEmotion,
        build_height: d.intensity,
        hover_desc: d.summary,
        themes: d.themes,
        description: d.description,
        micro_emotion: d.microEmotion,
        symbols: d.symbols,
        new_symbols: [],
        places: d.places,
        emotion_stated: d.emotionStated,
        hvdc_emotion: d.emotionStated ? vocab.hvdc[d.primaryEmotion] : null,
        intensity_source: d.intensitySource,
        mentioned_works: d.mentionedWorks,
        typical_dreams: d.typicalDreams,
      }),
      `building ${person.key}/${d.key}`,
    );
  }

  for (const m of person.media) {
    checked(
      await db.from("media").upsert({
        id: uuid(`${person.key}:media:${m.key}`),
        city_id: cityId,
        kind: m.kind,
        title: m.title,
        creator: m.creator,
        consumed_on: m.consumed_on,
        user_note: m.user_note,
        main_emotion: m.main_emotion,
        themes: m.themes,
        symbols: m.symbols,
      }),
      `media ${person.key}/${m.title}`,
    );
  }

  // Check everything landed
  const sessions = checked(await db.from("journal_sessions").select("id").eq("city_id", cityId).eq("status", "completed"), "verify sessions");
  const media = checked(await db.from("media").select("id").eq("city_id", cityId), "verify media");
  summary.push({ city: person.name, dreams: sessions.length, media: media.length });
}
console.log(JSON.stringify(summary));
console.log("Open the app and pick a city from the menu under the Dream City logo.");
