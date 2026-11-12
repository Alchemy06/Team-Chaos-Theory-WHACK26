import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScript } from "./helpers/appHarness.mjs";

const dream = { id: "test", date: "2026-11-08", transcript: "I saw water inside a house and felt anxious.", followUps: [], summary: "Water inside a house.", primaryEmotion: "apprehension", microEmotion: "anxiety", intensity: 8, intensitySource: "self", emotionStated: true, hvdcEmotion: "apprehension", symbols: ["water", "house"], places: ["house"], themes: ["home"] };
const body = { dream, dreams: [dream], works: [], links: [], stats: [] };
test("fabricated citations and interpretive claims fall back without being shown as AI insight", async () => {
  for (const text of ["This proves hidden fears [made-up]. What do you think?", "Water appears here [unknown]. What stands out?"]) {
    const load = loadTypeScript({ "@/lib/groq": { groqJSON: async () => ({ insight: text }) } });
    const result = await load("lib/insight.ts").generateInsight(body);
    assert.equal(result.source, "fallback"); assert.equal(result.attempts.length, 2);
    assert.ok(result.problems.length); assert.ok(!result.insight.includes("made-up")); assert.ok(!result.insight.includes("[unknown]"));
  }
});
test("the support checker can reject otherwise well-formed insight claims", async () => {
  const load = loadTypeScript({ "@/lib/groq": { groqJSON: async (system) => system.includes('"results"') ? { results: [{ n: 1, verdict: "unsupported", reason: "Not in the evidence" }] } : { insight: "Water appears in this dream [dream]. What stands out?" } } });
  const result = await load("lib/insight.ts").generateInsight(body);
  assert.equal(result.source, "fallback"); assert.equal(result.attempts.length, 2);
  assert.ok(result.attempts.every((attempt) => attempt.support?.unsupported > 0));
});
test("AI outage produces an explicitly labelled evidence template", async () => {
  const load = loadTypeScript({ "@/lib/groq": { groqJSON: async () => { throw new Error("Provider outage"); } } });
  const result = await load("lib/insight.ts").generateInsight(body);
  assert.equal(result.source, "fallback"); assert.equal(result.support.checked, false);
  assert.ok(result.insight.endsWith("?")); assert.ok(result.attempts[0].error);
});
