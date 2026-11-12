import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { loadTypeScript } from "./helpers/appHarness.mjs";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const enabled = process.env.RUN_LIVE_LLM_TESTS === "1";
const id = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const journal = "# Dream Journal\n\n## User\n\nI was flying over the ocean towards my childhood home. I felt happy.\n\n## Assistant\n\nHow did you feel during the dream?\n\n## User\n\nHappy and curious.\n\n## Assistant\n\nHow intense did it feel?\n\n## User\n\n7\n";
const transport = async (url, options) => {
  assert.equal(String(url), "https://api.groq.com/openai/v1/chat/completions");
  return fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(35000) });
};

test("live LLM 1 produces a valid personalised third question", { skip: !enabled, timeout: 45000 }, async () => {
  const load = loadTypeScript({}, { process, fetch: transport });
  const result = await load("lib/journalQuestions.ts").generateJournalQuestions("I flew over the ocean towards my childhood home and felt happy.");
  assert.equal(result.questions.length, 3); assert.equal(result.aiUsed, true, "Live provider must generate the third question rather than use fallback");
  assert.ok(result.questions[2].trim().length > 5);
});

test("live Re-explore produces three new questions from full Markdown and an earlier reflection", { skip: !enabled, timeout: 45000 }, async () => {
  let saved;
  const client = { from(table) {
    let payload;
    const query = { select() { return query; }, eq() { return query; }, order() { return query; },
      insert(value) { payload = value; return query; }, single() { return query; }, maybeSingle() { return query; },
      then(resolve, reject) { if (payload) saved = payload;
        return Promise.resolve({ data: payload ? { id: "round", ...payload, status: "draft" } : table === "build_data" ? { journal_id: id } : [], error: null }).then(resolve, reject); },
    }; return query;
  } };
  const load = loadTypeScript({ "@/lib/db": { db: () => client, getSession: async () => ({ id, status: "completed", conversation_md: journal }), latestInsights: async () => new Map([[id, { text: "The dream includes flight and a familiar home. What detail stays with you?", source: "ai", cited: ["dream"] }]]) } }, { process, fetch: transport });
  const round = await load("lib/reexplore.ts").startExploration(id);
  assert.equal(round.questions.length, 3); assert.equal(new Set(round.questions.map((q) => q.toLowerCase())).size, 3);
  assert.equal(saved.base_markdown, journal); assert.ok(saved.previous_insight.text);
  for (const question of round.questions) { assert.ok(question.trim().length >= 8); assert.ok(!journal.includes(question)); }
});
