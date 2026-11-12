import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");

function harness({ done = false, busy = false, fail = "" } = {}) {
  const calls = [];
  const insight = { insight:"A grounded reflection.", source:"ai", cited:["dream"], problems:[], support:{checked:false}, attempts:[], evidence:[], writerModel:"test" };
  const mocks = {
    "@/lib/db": { db:() => ({rpc:async(name,args) => {
      calls.push({name,args});
      if(name==="claim_exploration_refresh") return {data:done?{done:true}:{token:"lease"},error:busy?{code:"P0001"}:null};
      return {error:fail==="save"&&name==="finish_exploration_refresh"?{message:"save failed"}:null};
    }}),getSession:async()=>({id:"dream"}),toBuildRow:(build)=>({journal_id:build.journalID}) },
    "@/lib/buildData": {sessionEntry:async()=>({entry:{transcript:"Original dream"},markdown:"Saved full history"}),runExtraction:async(md,_entry,signal)=>{
      calls.push({name:"extract",md,signal});if(fail==="extract")throw new Error("AI unavailable");return {extraction:{summary:"Updated"}};
    },toBuildData:(id)=>({journalID:id})},
    "@/lib/reexploreContext": {reexploreContext:async(session,build)=>({dream:{id:session.id},build})},
    "@/lib/insight": {generateInsight:async(context,signal)=>{calls.push({name:"insight",context,signal});return insight;}},
    "@/lib/reexploreError": {ExplorationError:class extends Error {constructor(message,status){super(message);this.status=status;}}},
  };
  const module={exports:{}};
  const source=ts.transpileModule(readFileSync("lib/reexploreRefresh.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`,{AbortSignal,console:{error(){}}})((name)=>{assert.ok(mocks[name],name);return mocks[name];},module,module.exports);
  return {calls,run:()=>module.exports.refreshExploration("dream","round")};
}

test("refresh uses saved Markdown and commits building and cited insight in one leased operation",async()=>{
  const h=harness();assert.equal((await h.run()).updated,true);
  const extraction=h.calls.find(c=>c.name==="extract"), insight=h.calls.find(c=>c.name==="insight"), saved=h.calls.find(c=>c.name==="finish_exploration_refresh");
  assert.equal(extraction.md,"Saved full history");assert.equal(insight.signal,extraction.signal);
  assert.equal(saved.args.p_token,"lease");assert.equal(saved.args.p_insight.text,"A grounded reflection.");assert.equal(saved.args.p_build.journal_id,"dream");
  assert.equal(h.calls.at(-1).name,"release_exploration_refresh");
});
test("failed extraction leaves the saved answers retryable and releases its lease",async()=>{
  const h=harness({fail:"extract"});const result=await h.run();assert.equal(result.saved,true);assert.equal(result.updated,false);
  assert.ok(!h.calls.some(c=>c.name==="finish_exploration_refresh"));assert.equal(h.calls.at(-1).name,"release_exploration_refresh");
});
test("failed atomic persistence never reports a successful refresh",async()=>{assert.equal((await harness({fail:"save"}).run()).updated,false);});
test("completed refreshes do not call the AI again",async()=>{const h=harness({done:true});assert.equal((await h.run()).updated,true);assert.equal(h.calls.length,1);});
test("a busy refresh is rejected before any model calls",async()=>{const h=harness({busy:true});await assert.rejects(h.run(),e=>e.status===409);assert.equal(h.calls.length,1);});
