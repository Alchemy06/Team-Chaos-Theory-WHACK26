import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";

const require = createRequire(import.meta.url);
const ts = require("typescript");

// (added) Real application modules and real Postgres SQL; only external clients are replaced.
export function loadTypeScript(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(name) {
    const filename = path.resolve(name);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} }; cache.set(filename, loadedModule);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const localRequire = (specifier) => {
      if (mocks[specifier]) return mocks[specifier];
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return require(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      const alias = "@/" + path.relative(process.cwd(), base).split(path.sep).join("/");
      if (mocks[alias]) return mocks[alias];
      if (base.endsWith(".json")) return JSON.parse(readFileSync(base, "utf8"));
      return load(existsSync(base) ? base : base + ".ts");
    };
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
      Request, Response, URL, AbortSignal, AbortController, Date, setTimeout, clearTimeout,
      console: { error() {}, warn() {} },
      process: { env: { SUPABASE_URL: "http://test.invalid", SUPABASE_SERVICE_ROLE_KEY: "fake-test-key", GROQ_API_KEY: "fake-test-key" } },
      fetch: () => { throw new Error("Unexpected network access in offline tests"); }, ...globals,
    }, { filename })(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

const jsonColumns = new Set(["support", "attempts", "evidence", "previous_insight", "previous_building", "insight_snapshot", "building_snapshot"]);
const identifier = (value) => { assert.match(value, /^[a-z_]+$/); return `"${value}"`; };
const serialise = (value, column) => value !== null && jsonColumns.has(column) ? JSON.stringify(value) : value;

function supabaseAdapter(pg, state) {
  return {
    from(table) {
      identifier(table);
      let mode = "read", payload, columns = "*", one = false, maybe = false, limit, promise;
      const filters = [], orders = [];
      const builder = {
        select(value = "*") { columns = value; return builder; },
        insert(value) { mode = "insert"; payload = value; return builder; },
        upsert(value) { mode = "upsert"; payload = value; return builder; },
        update(value) { mode = "update"; payload = value; return builder; },
        delete() { mode = "delete"; return builder; },
        eq(column, value) { filters.push([column, "=", value]); return builder; },
        is(column, value) { assert.equal(value, null); filters.push([column, "is", null]); return builder; },
        in(column, values) { filters.push([column, "in", values]); return builder; },
        order(column, options = {}) { orders.push(`${identifier(column)} ${options.ascending === false ? "desc" : "asc"}`); return builder; },
        limit(value) { limit = Number(value); return builder; },
        single() { one = true; return builder; },
        maybeSingle() { one = true; maybe = true; return builder; },
        then(resolve, reject) { return (promise ??= execute()).then(resolve, reject); },
      };
      async function execute() {
        try {
          if (state.failWrite === table && mode !== "read") throw Object.assign(new Error("Injected persistence failure"), { code: "TEST" });
          const params = [];
          const bind = (value) => { params.push(value); return `$${params.length}`; };
          const where = filters.length ? " where " + filters.map(([column, op, value]) => `t.${identifier(column)} ${op === "is" ? "is null" : op === "in" ? `= any(${bind(value)})` : `= ${bind(value)}`}`).join(" and ") : "";
          let sql;
          if (mode === "read") {
            sql = `select t.*${columns.includes("journal_sessions(") ? ",to_jsonb(s) as journal_sessions" : ""} from public.${identifier(table)} t`;
            if (columns.includes("journal_sessions(")) sql += " left join public.journal_sessions s on s.id=t.journal_id";
            sql += where;
            if (orders.length) sql += " order by " + orders.join(",");
            if (limit !== undefined) { assert.ok(Number.isInteger(limit)); sql += ` limit ${limit}`; }
          } else if (mode === "insert" || mode === "upsert") {
            assert.ok(!Array.isArray(payload));
            const keys = Object.keys(payload);
            sql = `insert into public.${identifier(table)}${keys.length ? `(${keys.map(identifier).join(",")}) values(${keys.map((key) => bind(serialise(payload[key], key))).join(",")})` : " default values"}`;
            if (mode === "upsert") {
              const primary = table === "build_data" ? "journal_id" : "id";
              sql += ` on conflict(${identifier(primary)}) do update set ` + keys.filter((key) => key !== primary).map((key) => `${identifier(key)}=excluded.${identifier(key)}`).join(",");
            }
            sql += " returning *";
          } else if (mode === "delete") {
            sql = `delete from public.${identifier(table)} t${where} returning *`;
          } else {
            // Filter parameters come first; PostgreSQL accepts them in any placeholder order.
            sql = `update public.${identifier(table)} t set ` + Object.keys(payload).map((key) => `${identifier(key)}=${bind(serialise(payload[key], key))}`).join(",") + where + " returning *";
          }
          const result = await pg.query(sql, params);
          const rows = JSON.parse(JSON.stringify(result.rows));
          if (one && !rows.length && !maybe) return { data: null, error: { code: "PGRST116", message: "No row" } };
          return { data: one ? rows[0] ?? null : rows, error: null };
        } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
      }
      return builder;
    },
    async rpc(name, args) {
      assert.ok(["complete_journal_exploration", "claim_exploration_refresh", "finish_exploration_refresh", "release_exploration_refresh"].includes(name));
      const keys = Object.keys(args);
      try {
        const result = await pg.query(`select public.${identifier(name)}(${keys.map((key, i) => `${identifier(key)} => $${i + 1}`).join(",")}) as result`, keys.map((key) => ["p_build", "p_insight"].includes(key) ? JSON.stringify(args[key]) : args[key]));
        return { data: JSON.parse(JSON.stringify(result.rows[0]?.result ?? null)), error: null };
      } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
    },
  };
}

export async function appHarness() {
  const pg = await PGlite.create();
  await pg.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';");
  await pg.exec(readFileSync("supabase/schema.sql", "utf8"));
  await pg.exec(readFileSync("supabase/migrations/004_reexplore.sql", "utf8"));
  await pg.exec(readFileSync("supabase/migrations/20261108105134_reexplore_insights.sql", "utf8"));
  const state = { calls: [], failWrite: "", failModel: "", round: 0 };
  const client = supabaseAdapter(pg, state);
  const load = loadTypeScript({ "@supabase/supabase-js": { createClient: () => client } }, {
    fetch: async (url, options) => {
      assert.equal(String(url), "https://api.groq.com/openai/v1/chat/completions");
      const body = JSON.parse(options.body);
      const system = body.messages[0].content;
      const user = body.messages[1].content;
      const kind = system.includes("exactly THREE") ? "reexplore" : system.includes("Write ONE short") ? "followup" : system.includes("primaryEmotion") ? "extract" : system.includes('"results"') ? "support" : "insight";
      state.calls.push({ kind, system, user });
      if (state.failModel === kind) return new Response("Injected model outage", { status: 503 });
      let answer;
      if (kind === "followup") answer = { question: "Does the house remind you of a place you know?" };
      else if (kind === "reexplore") {
        state.round++;
        answer = { questions: state.round === 1 ? ["What colour was the roof?", "Who else was in the house?", "What did you notice outside?"] : ["What happened after you looked outside?", "What did you hear in the house?", "What familiar detail stayed with you?"] };
      } else if (kind === "extract") answer = {
        summary: user.includes("Yellow roof") ? "An ocean house with a yellow roof." : "An anxious visit to a house beneath the ocean.",
        description: "I explored a flooded house beneath the ocean.", primaryEmotion: "apprehension", secondaryEmotion: null,
        emotionStated: true, microEmotion: "anxiety", intensity: 2, symbols: ["water", "ocean", "house"], newSymbols: [], places: ["ocean"], themes: ["home", "threat"], typicalDreams: [], mentionedWorks: [],
      };
      else if (kind === "support") answer = { results: [{ n: 1, verdict: "supported", reason: "The dream explicitly describes water." }] };
      else answer = { insight: "Water appears in this dream [dream]. What detail stays with you?" };
      return Response.json({ choices: [{ message: { content: JSON.stringify(answer) } }] });
    },
  });
  return { pg, state, load, route: (file) => load(`app/api/${file}/route.ts`), close: () => pg.close() };
}

export const request = (body, method = "POST") => new Request("http://localhost/test", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const context = (id) => ({ params: Promise.resolve({ id }) });
