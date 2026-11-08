import assert from "node:assert/strict";
import { test } from "node:test";

// ── (ADDED) Exercise the running insight endpoint with fictional evidence ──
// Uses real Groq generation. The insight endpoint does not save database rows.
const enabled = process.env.RUN_LIVE_LLM_TESTS === "1";
const base = process.env.TEST_APP_URL ?? "http://localhost:3000";
const earlier = {
  id: "test-earlier", date: "2026-11-06", transcript: "I was late for an exam at school, running down a corridor.",
  followUps: [], summary: "Running down a school corridor, late for an exam.", primaryEmotion: "apprehension",
  hvdcEmotion: "apprehension", emotionStated: true, microEmotion: "anxiety", intensity: 7, intensitySource: "self",
  symbols: ["school", "corridor", "exam", "clock"], places: ["school"], themes: ["performance", "being late"],
};
const dream = {
  ...earlier, id: "test-current", date: "2026-11-08", intensity: 8,
  transcript: "I returned to school and the corridor stretched endlessly before my exam. I felt anxious.",
  summary: "An anxious return to an endless school corridor before an exam.",
};
const link = {
  from: dream.id, to: earlier.id, toType: "dream", shared: ["school", "corridor", "exam", "clock"],
  sharedThemes: ["performance", "being late"], daysBefore: 2, strength: 0.85,
  explanation: "Recurring school, corridor, exam and clock symbols.", researchCardIds: [],
};

test("live insight feature produces a grounded AI reflection", {
  skip: enabled ? false : "Run npm run test:insight:live with the local app running.", timeout: 90000,
}, async (t) => {
  const url = new URL(base);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Run against the local app only.");
  const response = await fetch(`${base}/api/insight`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dream, dreams: [earlier, dream], links: [link], works: [], stats: [] }),
    signal: AbortSignal.timeout(80000),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  await t.test("response comes from the AI, rather than hiding failure behind a fallback", () => {
    assert.equal(result.source, "ai", `Fallback returned: ${JSON.stringify(result.problems)}`);
    assert.deepEqual(result.problems, []);
  });
  await t.test("reflection discusses the supplied dream content", () => {
    assert.equal(typeof result.insight, "string");
    assert.match(result.insight, /school|corridor|exam/i);
    assert.ok(result.insight.length > 30);
  });
  await t.test("citations refer only to supplied evidence, including the recurring-dream link", () => {
    const evidenceIds = new Set(result.evidence.map(item => item.id));
    assert.ok(result.cited.length > 0);
    for (const citation of result.cited) assert.ok(evidenceIds.has(citation), `Unknown citation: ${citation}`);
    assert.ok(result.cited.includes(`road:${earlier.id}`), "Expected evidence for the recurring dream connection");
    const inline = [...result.insight.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
    assert.ok(inline.length > 0);
    for (const citation of inline) assert.ok(evidenceIds.has(citation));
  });
  await t.test("reflection is brief, ends in a question and avoids diagnostic claims", () => {
    const prose = result.insight.replace(/\[[^\]]+\]/g, "").trim();
    assert.ok(prose.endsWith("?"));
    assert.ok(prose.split(/\s+/).length <= 90);
    assert.doesNotMatch(prose, /\b(diagnos\w*|disorder|ptsd|this proves|symbolizes|symbolises)\b/i);
  });
  t.diagnostic(`AI insight: ${result.insight}`);
});
