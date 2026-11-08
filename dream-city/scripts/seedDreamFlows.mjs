// Explicitly run this script to add ten fictional demo flows to the configured database.
// Stable IDs make rerunning safe; existing completed examples are left untouched.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { createClient } = require("@supabase/supabase-js");
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase server configuration is missing.");
const db = createClient(url, key, { auth: { persistSession: false } });
const flows = JSON.parse(await readFile("data/dreamFlowExamples.json", "utf8"));
const vocab = JSON.parse(await readFile("data/vocab.json", "utf8"));
function uuid(label) {
  const h = createHash("sha256").update("dream-city-demo-flows-v1:" + label).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
function checked(result) { if (result.error) throw new Error(result.error.message); return result.data; }
let added = 0;
for (const [index, flow] of flows.entries()) {
  const id = uuid(flow.id);
  const existing = checked(await db.from("journal_sessions").select("id,status").eq("id", id).maybeSingle());
  if (existing?.status === "completed") continue;
  const date = new Date(Date.UTC(2026, 10, index - 1, 8)).toISOString();
  checked(await db.from("journal_sessions").upsert({ id, status: "draft", created_at: date }, { onConflict: "id", ignoreDuplicates: true }));
  let previous = uuid(flow.id + ":dream");
  checked(await db.from("journal_messages").upsert({ id: previous, session_id: id, sequence: 0, role: "user", content: flow.dream, reply_to_id: null, created_at: date }, { onConflict: "id", ignoreDuplicates: true }));
  const sections = [`# Dream Journal — ${flow.title}`, `## User\n\n${flow.dream}`];
  for (const [i, turn] of flow.followUps.entries()) {
    const questionId = uuid(flow.id + ":q:" + i);
    const answerId = uuid(flow.id + ":a:" + i);
    checked(await db.from("journal_messages").upsert({ id: questionId, session_id: id, sequence: i * 2 + 1, role: "assistant", content: turn.question, reply_to_id: previous, created_at: date }, { onConflict: "id", ignoreDuplicates: true }));
    checked(await db.from("journal_messages").upsert({ id: answerId, session_id: id, sequence: i * 2 + 2, role: "user", content: turn.answer, reply_to_id: questionId, created_at: date }, { onConflict: "id", ignoreDuplicates: true }));
    previous = answerId;
    sections.push(`## Assistant\n\n${turn.question}`, `## User\n\n${turn.answer}`);
  }
  const text = (flow.dream + " " + flow.followUps.map(t => t.answer).join(" ")).toLowerCase();
  checked(await db.from("build_data").upsert({ journal_id: id, main_emotion: flow.suggestedEmotion,
    secondary_emotion: flow.suggestedEmotion, build_height: Number(flow.followUps[1].answer),
    hover_desc: flow.title + ": " + flow.dream, themes: flow.themes ?? vocab.themes.filter(theme => text.includes(theme.toLowerCase())) }));
  checked(await db.from("journal_sessions").update({ status: "completed", conversation_md: sections.join("\n\n") + "\n", completed_at: date }).eq("id", id));
  added++;
}
const ids = flows.map(flow => uuid(flow.id));
const sessions = checked(await db.from("journal_sessions").select("id,status").in("id", ids));
const buildings = checked(await db.from("build_data").select("journal_id").in("journal_id", ids));
const messages = checked(await db.from("journal_messages").select("session_id,sequence,role,reply_to_id").in("session_id", ids));
if (sessions.filter(s => s.status === "completed").length !== 10 || buildings.length !== 10 || messages.length !== 70) throw new Error("Example verification failed.");
console.log(JSON.stringify({ added, completedSessions: sessions.length, buildings: buildings.length, messages: messages.length }));
