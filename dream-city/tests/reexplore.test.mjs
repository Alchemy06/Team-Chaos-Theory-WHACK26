import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
const sessionId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const roundId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const markdown = "# Dream Journal\n\n## User\n\nI flew above a city.\n\n## Assistant\n\nHow did you feel?\n\n## User\n\nHappy.";
const questions = ["What detail do you remember most clearly?", "What did the city remind you of?", "What was happening just before you flew?"];

// (added) Exercise the real routes and generation logic without network or live data.
function harness({ rounds = [], ai = { questions }, missing = false, extractionFails = false, dbCode, rpcCode, aiFails = false } = {}) {
  const state = { rounds: [...rounds], aiCalls: [], rpcCalls: [], extractionCalls: 0 };
  const client = {
    from() {
      let mode = "read", payload;
      const query = {
        select() { return query; }, eq() { return query; }, order() { return query; },
        insert(value) { mode = "insert"; payload = value; return query; },
        update(value) { mode = "update"; payload = value; return query; },
        single() { return Promise.resolve(result()); },
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
      };
      function result() {
        if (dbCode) return { data: null, error: { code: dbCode, message: "database unavailable" } };
        if (mode === "insert") {
          const round = { id: roundId, ...payload, status: "draft", answers: null, build_updated: false, created_at: "2026-11-08T12:00:00Z" };
          state.rounds.push(round);
          return { data: round, error: null };
        }
        if (mode === "update") state.rounds = state.rounds.map((round) => ({ ...round, ...payload }));
        return { data: state.rounds, error: null };
      }
      return query;
    },
    async rpc(name, args) {
      state.rpcCalls.push({ name, args });
      return { error: rpcCode ? { code: rpcCode, message: "conflict" } : null };
    },
  };
  const mocks = {
    "@/lib/db": { db: () => client, getSession: async () => missing ? null : ({ id: sessionId, status: "completed", conversation_md: markdown }) },
    "@/lib/groq": { groqJSON: async (_system, user) => {
      state.aiCalls.push(user);
      if (aiFails) throw new Error("AI unavailable");
      return ai;
    } },
    "@/lib/buildData": { extractSession: async () => {
      state.extractionCalls++;
      if (extractionFails) throw new Error("AI unavailable");
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
      const mock = mocks["@/" + path.relative(root, base).split(path.sep).join("/")];
      if (mock) return mock;
      return load(existsSync(base) ? base : base + ".ts");
    }
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
      Request, Response, URL, console, Date, AbortSignal, setTimeout, clearTimeout,
      fetch: () => { throw new Error("Network forbidden"); },
    }, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return { state, route: load(path.join(root, "app/api/journal/[id]/reexplore/route.ts")) };
}

const context = (id = sessionId) => ({ params: Promise.resolve({ id }) });
const request = (body) => new Request("http://localhost/reexplore", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const answers = ["A yellow roof.", "My old neighbourhood.", "I was standing on a balcony."];

test("generates three questions from the entire saved history and saves a draft", async () => {
  const h = harness();
  const response = await h.route.POST(null, context());
  assert.equal(response.status, 200);
  const { round } = await response.json();
  assert.deepEqual(round.questions, questions);
  assert.equal(h.state.aiCalls[0], markdown);
  assert.equal(h.state.rounds[0].base_markdown, markdown);
  assert.equal(h.state.rpcCalls.length, 0);
});

test("resumes a persisted draft without another AI request", async () => {
  const draft = { id: roundId, status: "draft", questions };
  const h = harness({ rounds: [draft] });
  assert.equal((await (await h.route.POST(null, context())).json()).round.id, roundId);
  assert.equal(h.state.aiCalls.length, 0);
});

test("rejects incomplete, duplicate, and previously asked question sets without saving", async () => {
  for (const qs of [[questions[0]], [questions[0], questions[0], questions[2]], ["How did you feel?", questions[1], questions[2]]]) {
    const h = harness({ ai: { questions: qs } });
    assert.equal((await h.route.POST(null, context())).status, 502);
    assert.equal(h.state.rounds.length, 0);
  }
});

test("AI failure leaves the saved dream and history untouched", async () => {
  const h = harness({ aiFails: true });
  assert.equal((await h.route.POST(null, context())).status, 502);
  assert.equal(h.state.rounds.length, 0);
  assert.equal(h.state.rpcCalls.length, 0);
});

test("missing dreams and database migrations produce actionable errors", async () => {
  assert.equal((await harness({ missing: true }).route.POST(null, context())).status, 404);
  const response = await harness({ dbCode: "42P01" }).route.POST(null, context());
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /004_reexplore.sql/);
});

test("all three answers are required before any persistence or extraction", async () => {
  for (const values of [[], ["one", "two"], ["one", " ", "three"]]) {
    const h = harness();
    assert.equal((await h.route.PUT(request({ roundId, answers: values }), context())).status, 400);
    assert.equal(h.state.rpcCalls.length, 0);
    assert.equal(h.state.extractionCalls, 0);
  }
});

test("saves using the transactional RPC before refreshing the same dream", async () => {
  const h = harness();
  const response = await h.route.PUT(request({ roundId, answers }), context());
  assert.deepEqual(await response.json(), { saved: true, updated: true });
  assert.equal(h.state.rpcCalls[0].name, "complete_journal_exploration");
  assert.equal(h.state.rpcCalls[0].args.p_session_id, sessionId);
  assert.equal(h.state.extractionCalls, 1);
});

test("extraction failure reports saved answers and allows an update retry", async () => {
  const h = harness({ extractionFails: true });
  const response = await h.route.PUT(request({ roundId, answers }), context());
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.saved, true);
  assert.equal(result.updated, false);
});

test("stale rounds cannot trigger extraction", async () => {
  const h = harness({ rpcCode: "P0001" });
  assert.equal((await h.route.PUT(request({ roundId, answers }), context())).status, 409);
  assert.equal(h.state.extractionCalls, 0);
});

test("invalid session IDs are rejected before database or model access", async () => {
  const h = harness();
  assert.equal((await h.route.POST(null, context("bad"))).status, 400);
  assert.equal(h.state.aiCalls.length, 0);
});
