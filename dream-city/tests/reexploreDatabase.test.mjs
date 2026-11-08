import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const id = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const original = "# Dream Journal — 8 November 2026\n\n## User\n\nI flew above my old home.\n";
const qs = ["What colour was the roof?", "Who else was there?", "What did the home remind you of?"];
const answers = ["Yellow.", "My sister.", "Our childhood garden."];

// (added) Execute the actual migration and save function in disposable Postgres, never Supabase.
test("transactional re-exploration preserves history and rejects unsafe writes", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table journal_sessions(id uuid primary key, status text, conversation_md text, completed_at timestamptz);
    create table journal_messages(
      id uuid primary key default gen_random_uuid(), session_id uuid references journal_sessions(id),
      sequence integer not null, role text, content text, reply_to_id uuid references journal_messages(id),
      unique(session_id,sequence)
    );
  `);
  await db.exec(await readFile("supabase/migrations/004_reexplore.sql", "utf8"));
  await db.query("insert into journal_sessions values ($1,'completed',$2,'2026-11-08T12:00:00Z')", [id, original]);
  await db.query("insert into journal_messages(session_id,sequence,role,content) values ($1,0,'user','I flew above my old home.')", [id]);
  const newRound = async (base = original) => (await db.query(
    "insert into journal_explorations(session_id,questions,base_markdown) values ($1,$2,$3) returning id", [id, qs, base],
  )).rows[0].id;
  const save = (round, values = answers, session = id) => db.query("select complete_journal_exploration($1,$2,$3)", [session, round, values]);
  const round = await newRound();

  await t.test("only one draft is allowed per dream", async () => {
    await assert.rejects(newRound(), /unique/);
  });
  await t.test("invalid answers leave messages and Markdown unchanged", async () => {
    await assert.rejects(save(round, ["one", "", "three"]), /Three non-empty/);
    assert.equal((await db.query("select count(*)::int as count from journal_messages")).rows[0].count, 1);
  });
  await t.test("save appends six linked messages and dated Markdown without changing the original", async () => {
    await save(round);
    const journal = (await db.query("select * from journal_sessions where id=$1", [id])).rows[0];
    assert.ok(journal.conversation_md.startsWith(original));
    assert.match(journal.conversation_md, /## Re-exploration — /);
    for (const content of [...qs, ...answers]) assert.ok(journal.conversation_md.includes(content));
    assert.equal(new Date(journal.completed_at).toISOString(), "2026-11-08T12:00:00.000Z");
    const rows = (await db.query("select * from journal_messages order by sequence")).rows;
    assert.deepEqual(rows.map((m) => m.role), ["user", "assistant", "user", "assistant", "user", "assistant", "user"]);
    assert.equal(rows[2].reply_to_id, rows[1].id);
    assert.equal((await db.query("select completed_markdown from journal_explorations where id=$1", [round])).rows[0].completed_markdown, journal.conversation_md);
  });
  await t.test("retrying the same save creates no duplicates", async () => {
    await Promise.all([save(round), save(round)]);
    assert.equal((await db.query("select count(*)::int as count from journal_messages")).rows[0].count, 7);
    await assert.rejects(save(round, ["Different", "answers", "here"]), /already answered/);
  });
  await t.test("a round cannot be applied to another dream", async () => {
    await assert.rejects(save(round, answers, "cccccccc-cccc-4ccc-cccc-cccccccccccc"), /Dream not found/);
  });
  const expanded = (await db.query("select conversation_md from journal_sessions where id=$1", [id])).rows[0].conversation_md;
  await t.test("stale round snapshots cannot overwrite newer journal history", async () => {
    const stale = await newRound(original);
    await assert.rejects(save(stale), /Journal changed/);
    assert.equal((await db.query("select conversation_md from journal_sessions where id=$1", [id])).rows[0].conversation_md, expanded);
    await db.query("delete from journal_explorations where id=$1", [stale]);
  });
  await t.test("a second round retains the first round and its original snapshot", async () => {
    const second = await newRound(expanded);
    await save(second);
    assert.equal((await db.query("select count(*)::int as count from journal_messages")).rows[0].count, 13);
    assert.equal((await db.query("select conversation_md from journal_sessions where id=$1", [id])).rows[0].conversation_md.match(/## Re-exploration/g).length, 2);
    assert.equal((await db.query("select completed_markdown from journal_explorations where id=$1", [round])).rows[0].completed_markdown, expanded);
  });
  await t.test("browser roles cannot call the save function or read round snapshots", async () => {
    const result = (await db.query("select has_function_privilege('anon','complete_journal_exploration(uuid,uuid,text[])','execute') as allowed")).rows[0];
    assert.equal(result.allowed, false);
    assert.equal((await db.query("select has_table_privilege('authenticated','journal_explorations','select') as allowed")).rows[0].allowed, false);
  });
});
