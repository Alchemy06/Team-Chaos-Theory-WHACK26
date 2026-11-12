import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("final round refresh is atomic, versioned and safe to retry", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table journal_sessions(id uuid primary key default gen_random_uuid(),status text,conversation_md text,completed_at timestamptz);
    create table journal_messages(id uuid primary key default gen_random_uuid(),session_id uuid references journal_sessions(id),sequence int,role text,content text,reply_to_id uuid references journal_messages(id),unique(session_id,sequence));
    create table build_data(journal_id uuid primary key references journal_sessions(id),main_emotion text,secondary_emotion text not null,build_height int,hover_desc text,themes text[]);`);
  await db.exec(await readFile("supabase/migrations/004_reexplore.sql", "utf8"));
  const id = (await db.query("insert into journal_sessions(status,conversation_md) values('completed','Original dream') returning id")).rows[0].id;
  await db.query("insert into build_data values($1,'happiness','happiness',5,'Original building','{}')", [id]);
  await db.exec(await readFile("supabase/migrations/20261108105134_reexplore_insights.sql", "utf8"));
  assert.equal((await db.query("select hover_desc from build_data")).rows[0].hover_desc, "Original building");
  const round = (await db.query("insert into journal_explorations(session_id,questions,base_markdown) values($1,$2,'Original dream') returning id", [id, ["First question?","Second question?","Third question?"]])).rows[0].id;
  await db.query("select complete_journal_exploration($1,$2,$3)", [id,round,["First answer","Second answer","Third answer"]]);
  const claim = async () => (await db.query("select claim_exploration_refresh($1,$2) as result", [id,round])).rows[0].result;
  const build = {main_emotion:"wonder",secondary_emotion:null,build_height:7,hover_desc:"Updated building",themes:["journey"],description:"More detail",micro_emotion:"awe",symbols:["sky"],new_symbols:[],places:[],emotion_stated:true,hvdc_emotion:"happiness",intensity_source:"self",mentioned_works:[],typical_dreams:[]};
  const insight = {text:"A saved reflection.",source:"ai",cited:["dream"],problems:[],support:{checked:false},attempts:[],evidence:[],writer_model:"test"};
  const finish = (token,reflection=insight) => db.query("select finish_exploration_refresh($1,$2,$3,$4,$5)",[id,round,token,build,reflection]);
  const release = (token) => db.query("select release_exploration_refresh($1,$2,$3)",[id,round,token]);
  const initial = await claim();
  await t.test("a second worker cannot refresh concurrently", async () => { await assert.rejects(claim(), /already running/); });
  await t.test("a failed reflection insert rolls back the building update", async () => {
    await assert.rejects(finish(initial.token,{...insight,source:"invalid"}), /check constraint/);
    assert.equal((await db.query("select hover_desc from build_data")).rows[0].hover_desc,"Original building");
    assert.equal((await db.query("select count(*)::int as n from insights")).rows[0].n,0);
  });
  await db.query("update journal_explorations set processing_until=now()-interval '1 second' where id=$1",[round]);
  const replacement = await claim();
  await t.test("an expired worker cannot overwrite or release its replacement", async () => {
    await assert.rejects(finish(initial.token),/stale/);
    await release(initial.token);
    assert.equal((await db.query("select processing_token from journal_explorations where id=$1",[round])).rows[0].processing_token,replacement.token);
  });
  await t.test("building, insight and permanent round snapshots are saved together", async () => {
    await finish(replacement.token);
    const result=(await db.query("select * from journal_explorations where id=$1",[round])).rows[0];
    assert.equal(result.build_updated,true);
    assert.equal(result.insight_snapshot.text,insight.text);
    assert.equal(result.building_snapshot.hover_desc,build.hover_desc);
    assert.equal((await db.query("select count(*)::int as n from build_data")).rows[0].n,1);
    assert.equal((await db.query("select exploration_id from insights")).rows[0].exploration_id,round);
  });
  await t.test("retrying a finished refresh does not create another insight", async () => {
    assert.equal((await claim()).done,true);
    assert.equal((await db.query("select count(*)::int as n from insights")).rows[0].n,1);
  });
  await t.test("browser roles cannot run the refresh functions", async () => {
    assert.equal((await db.query("select has_function_privilege('anon','finish_exploration_refresh(uuid,uuid,uuid,jsonb,jsonb)','execute') as allowed")).rows[0].allowed,false);
  });
});
