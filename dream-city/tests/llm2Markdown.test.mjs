import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
const id = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const md = `# Saved Dream Journal

## User
I was swimming through an ocean beside a flooded house.

## Assistant
How did you feel during the dream?

## User
I felt anxious about the rising water.

## Assistant
How intense did it feel, from 1 to 10?

## User
8
`;
const messages = [
  { id: "m0", sequence: 0, role: "user", content: "I was swimming through an ocean beside a flooded house.", reply_to_id: null },
  { id: "m1", sequence: 1, role: "assistant", content: "How did you feel during the dream?", reply_to_id: "m0" },
  { id: "m2", sequence: 2, role: "user", content: "I felt anxious about the rising water.", reply_to_id: "m1" },
  { id: "m3", sequence: 3, role: "assistant", content: "How intense did it feel, from 1 to 10?", reply_to_id: "m2" },
  { id: "m4", sequence: 4, role: "user", content: "8", reply_to_id: "m3" },
];
const valid = {
  summary: "Swimming beside a flooded house in an ocean.", primaryEmotion: "apprehension",
  microEmotion: "anxiety", emotionStated: true, intensity: 2,
  symbols: ["water", "flood", "ocean", "house"], newSymbols: [], places: ["ocean"], themes: ["home", "threat"],
};

// ── (ADDED) Run real route/validation code with fake external services ──
// No environment secrets, live AI calls, network access, or database writes.
function harness({ session = { id, created_at: "2026-11-08T08:00:00Z", status: "completed", conversation_md: md }, replies = [valid] } = {}) {
  const calls = [];
  const writes = [];
  const mocks = {
    "@/lib/db": {
      getSession: async (requestedId) => { assert.equal(requestedId, id); return session; },
      getMessages: async () => messages,
      upsertBuildData: async (data) => writes.push(data),
    },
    "@/lib/groq": { groqJSON: async (system, user) => {
      calls.push({ system, user });
      return replies[Math.min(calls.length - 1, replies.length - 1)];
    } },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (mocks[specifier]) return mocks[specifier];
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return require(specifier);
      const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      if (base.endsWith(".json")) return JSON.parse(readFileSync(base, "utf8"));
      const target = existsSync(base) ? base : base + ".ts";
      return load(target);
    }
    const run = vm.runInNewContext(`(function(require, module, exports) {${source}\n})`, {
      Request, Response, URL, console, Date, setTimeout, clearTimeout,
      fetch: () => { throw new Error("Network calls are forbidden in this test"); },
    }, { filename });
    run(localRequire, module, module.exports);
    return module.exports;
  }
  return { route: load(path.join(root, "app/api/extract/route.ts")), calls, writes };
}
function request(body) {
  return new Request("http://localhost/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("LLM2 receives database Markdown, ignoring conflicting browser Markdown", async () => {
  const h = harness();
  const response = await h.route.POST(request({ sessionId: id, markdown: "WRONG BROWSER DREAM" }));
  assert.equal(response.status, 200);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].user, md);
  assert.ok(!h.calls[0].user.includes("WRONG BROWSER DREAM"));
  const result = await response.json();
  assert.equal(result.entry.transcript, messages[0].content);
  assert.equal(result.extraction.intensity, 8, "Saved user rating overrides the model's estimate of 2");
  assert.equal(result.extraction.intensitySource, "self");
  assert.equal(result.extraction.primaryEmotion, "apprehension");
  assert.ok(result.extraction.symbols.includes("ocean"));
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].journalID, id);
  assert.equal(h.writes[0].buildHeight, 8);
});

test("missing saved Markdown stops before LLM2 or building persistence", async () => {
  const h = harness({ session: { id, conversation_md: null } });
  const response = await h.route.POST(request({ sessionId: id, markdown: md }));
  assert.equal(response.status, 409);
  assert.equal(h.calls.length, 0);
  assert.equal(h.writes.length, 0);
});

test("missing session is rejected before LLM2", async () => {
  const h = harness({ session: null });
  assert.equal((await h.route.POST(request({ sessionId: id }))).status, 404);
  assert.equal(h.calls.length, 0);
  assert.equal(h.writes.length, 0);
});

test("LLM2 retry retains the saved Markdown and produces valid building data", async () => {
  const h = harness({ replies: [{ ...valid, microEmotion: "invalid-street" }, valid] });
  assert.equal((await h.route.POST(request({ sessionId: id }))).status, 200);
  assert.equal(h.calls.length, 2);
  assert.ok(h.calls[1].user.startsWith(md));
  assert.ok(h.calls[1].user.includes("previous answer was rejected"));
  assert.equal(h.writes.length, 1);
});

test("invalid LLM2 output never saves a building", async () => {
  const h = harness({ replies: [{ summary: "", primaryEmotion: "invalid" }] });
  assert.equal((await h.route.POST(request({ sessionId: id }))).status, 502);
  assert.equal(h.calls.length, 2);
  assert.equal(h.writes.length, 0);
});
