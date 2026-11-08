import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const ts = require("typescript");
const enabled = process.env.RUN_LIVE_LLM_TESTS === "1";

// ── (ADDED) Real LLM2 calls; fictional journals and fake database only ──
// Uses Groq credits. Run explicitly with npm run test:llm2:live.
function routeFor(feeling) {
  const id = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
  const dream = "I was standing on a bridge above a river, looking towards a house.";
  const messages = [
    { id: "m0", sequence: 0, role: "user", content: dream, reply_to_id: null },
    { id: "m1", sequence: 1, role: "assistant", content: "How did you feel during the dream?", reply_to_id: "m0" },
    { id: "m2", sequence: 2, role: "user", content: feeling, reply_to_id: "m1" },
    { id: "m3", sequence: 3, role: "assistant", content: "How intense did it feel, from 1 to 10?", reply_to_id: "m2" },
    { id: "m4", sequence: 4, role: "user", content: "8", reply_to_id: "m3" },
  ];
  const md = `# Dream Journal\n\n## User\n${dream}\n\n## Assistant\nHow did you feel during the dream?\n\n## User\n${feeling}\n\n## Assistant\nHow intense did it feel, from 1 to 10?\n\n## User\n8\n`;
  const writes = [];
  const sent = [];
  const cache = new Map();
  const fakeDb = {
    getSession: async () => ({ id, status: "completed", created_at: "2026-11-08T08:00:00Z", conversation_md: md }),
    getMessages: async () => messages,
    upsertBuildData: async (data) => writes.push(data),
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/db") return fakeDb;
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return require(specifier);
      const base = specifier.startsWith("@/") ? path.join(process.cwd(), specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      if (base.endsWith(".json")) return JSON.parse(readFileSync(base, "utf8"));
      return load(existsSync(base) ? base : base + ".ts");
    }
    const run = vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
      Request, Response, URL, console, Date, process,
      fetch: async (url, options) => {
        assert.equal(String(url), "https://api.groq.com/openai/v1/chat/completions", "Only the real LLM provider may be contacted");
        sent.push(JSON.parse(options.body));
        return fetch(url, { ...options, signal: AbortSignal.timeout(25000) });
      },
    }, { filename });
    run(localRequire, module, module.exports);
    return module.exports;
  }
  return { POST: load(path.resolve("app/api/extract/route.ts")).POST, id, md, writes, sent };
}

test("live LLM2 classifies the feelings in saved Markdown, not just the setting", {
  skip: enabled ? false : "Opt in with npm run test:llm2:live; this makes real Groq requests.",
  timeout: 120000,
}, async (t) => {
  assert.ok(process.env.GROQ_API_KEY, "Set GROQ_API_KEY in .env.local before running the live test.");
  for (const example of [
    { emotion: "happiness", feeling: "I felt happy, joyful and completely safe. It was a wonderful, peaceful moment; there was no fear." },
    { emotion: "apprehension", feeling: "I felt terrified and anxious that I would fall. I was afraid the bridge would collapse; there was no happiness." },
  ]) {
    await t.test(`classifies ${example.emotion} from the same bridge-and-river setting`, async () => {
      const h = routeFor(example.feeling);
      const response = await h.POST(new Request("http://localhost/api/extract", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: h.id }),
      }));
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      assert.ok(h.sent.length >= 1);
      assert.equal(h.sent[0].messages.find(m => m.role === "user").content, h.md, "Real LLM must receive the exact saved Markdown");
      assert.equal(result.extraction.primaryEmotion, example.emotion);
      assert.equal(result.extraction.emotionStated, true);
      assert.equal(result.extraction.intensity, 8);
      assert.equal(result.extraction.intensitySource, "self");
      assert.ok(result.extraction.symbols.includes("water"));
      assert.ok(result.extraction.summary.length > 0);
      assert.equal(h.writes.length, 1);
      assert.equal(h.writes[0].mainEmotion, example.emotion);
      t.diagnostic(`Expected ${example.emotion}; received ${result.extraction.primaryEmotion}; rating ${result.extraction.intensity}/10.`);
    });
  }
});
