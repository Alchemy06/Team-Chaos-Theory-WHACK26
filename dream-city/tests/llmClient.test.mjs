import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScript } from "./helpers/appHarness.mjs";

const response = (content) => Response.json({ choices: [{ message: { content } }] });
test("Groq retries unsupported JSON mode while retaining model, messages and abort signal", async () => {
  const calls = [], signal = new AbortController().signal;
  const load = loadTypeScript({}, { fetch: async (_url, options) => { calls.push(options); return calls.length === 1 ? new Response("No JSON mode", { status: 400 }) : response('{"ok":true}'); } });
  const result = await load("lib/groq.ts").groqJSON("System", "Dream", { model: "test-model", signal, temperature: 0.3 });
  assert.equal(result.ok, true); assert.equal(calls.length, 2);
  const first = JSON.parse(calls[0].body), second = JSON.parse(calls[1].body);
  assert.equal(first.response_format.type, "json_object"); assert.equal(second.response_format, undefined);
  assert.equal(second.model, "test-model"); assert.equal(second.messages[1].content, "Dream"); assert.equal(calls[1].signal, signal);
});
test("Groq accepts JSON wrapped in a Markdown code fence", async () => {
  const client = loadTypeScript({}, { fetch: async () => response('```json\n{"question":"What happened next?"}\n```') })("lib/groq.ts");
  assert.equal((await client.groqJSON("System", "Dream")).question, "What happened next?");
});
test("provider errors, empty output and invalid JSON are visible failures", async () => {
  for (const makeResponse of [() => new Response("Unavailable", { status: 503 }), () => response(""), () => response("Not JSON")]) {
    const client = loadTypeScript({}, { fetch: async () => makeResponse() })("lib/groq.ts");
    await assert.rejects(client.groqJSON("System", "Dream"));
  }
});
test("a missing API key fails before any request is sent", async () => {
  let calls = 0;
  const client = loadTypeScript({}, { process: { env: {} }, fetch: async () => { calls++; return response("{}"); } })("lib/groq.ts");
  await assert.rejects(client.groqJSON("System", "Dream"), /GROQ_API_KEY/); assert.equal(calls, 0);
});
test("LLM 1 keeps two fixed questions and validates its third question", async () => {
  for (const ai of [{ question: "What did the house remind you of?" }, { question: 42 }, { question: "?" }]) {
    const load = loadTypeScript({ "@/lib/groq": { groqJSON: async () => ai } });
    const result = await load("lib/journalQuestions.ts").generateJournalQuestions("I dreamed about a flooded house.");
    assert.equal(result.questions.length, 3);
    assert.equal(result.questions[0], "How did you feel during the dream?");
    assert.equal(result.questions[1], "How intense did it feel, from 1 to 10?");
    assert.equal(result.aiUsed, typeof ai.question === "string" && ai.question.length > 5);
  }
});
