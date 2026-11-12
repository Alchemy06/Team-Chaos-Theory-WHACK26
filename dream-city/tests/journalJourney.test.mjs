import assert from "node:assert/strict";
import { test } from "node:test";
import { appHarness, request, context } from "./helpers/appHarness.mjs";

test("complete journal → LLMs → insight → two saved Re-explore journeys", { timeout: 90000 }, async (t) => {
  const h = await appHarness(); t.after(h.close);
  const start = h.route("journal"), answer = h.route("journal/[id]/answers"), complete = h.route("journal/[id]/complete");
  const extract = h.route("extract"), insight = h.route("insight"), explore = h.route("journal/[id]/reexplore"), city = h.route("city");
  const transcript = "I was exploring a flooded house beneath the ocean. I felt anxious about the water.";
  let journal, round, firstSnapshot;

  await t.test("initial dream creates a session and three saved questions", async () => {
    const response = await start.POST(request({ transcript })); assert.equal(response.status, 201);
    journal = await response.json(); assert.equal(journal.questions.length, 3);
    const rows = (await h.pg.query("select sequence,role from journal_messages order by sequence")).rows;
    assert.deepEqual(rows.map((row) => row.sequence), [0, 1, 3, 5]);
    assert.equal(h.state.calls[0].kind, "followup");
  });
  await t.test("answers save against their questions; retries do not duplicate them", async () => {
    for (const [i, text] of ["I felt anxious.", "8", "Our childhood home."].entries()) {
      const body = { questionId: journal.questions[i].id, answer: text };
      assert.equal((await answer.POST(request(body), context(journal.sessionId))).status, 201);
      assert.equal((await answer.POST(request(body), context(journal.sessionId))).status, 200);
    }
    assert.equal((await h.pg.query("select count(*)::int as n from journal_messages")).rows[0].n, 7);
    assert.equal((await answer.POST(request({ questionId: journal.questions[0].id, answer: "Changed text" }), context(journal.sessionId))).status, 409);
  });
  await t.test("final Markdown is persisted before extraction", async () => {
    assert.equal((await complete.POST(null, context(journal.sessionId))).status, 200);
    const session = (await h.pg.query("select * from journal_sessions where id=$1", [journal.sessionId])).rows[0];
    assert.equal(session.status, "completed"); assert.ok(session.conversation_md.includes(transcript));
    assert.equal(session.conversation_md.match(/## User/g).length, 4);
    assert.equal(session.conversation_md.match(/## Assistant/g).length, 3);
  });
  await t.test("LLM 2 reads database Markdown and stores the full building", async () => {
    const response = await extract.POST(request({ sessionId: journal.sessionId, markdown: "WRONG BROWSER CONTENT" }));
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    const result = await response.json(); assert.equal(result.extraction.intensity, 8);
    assert.ok(!h.state.calls.find((call) => call.kind === "extract").user.includes("WRONG BROWSER CONTENT"));
    assert.equal((await h.pg.query("select build_height from build_data")).rows[0].build_height, 8);
  });
  await t.test("initial insight is evidence-checked and saved in the database", async () => {
    const dreams = (await (await city.GET(new Request("http://localhost/api/city"))).json()).dreams;
    const response = await insight.POST(request({ dream: dreams[0], dreams, links: [], works: [], stats: [] }));
    const result = await response.json(); assert.equal(result.saved, true); assert.equal(result.source, "ai");
    assert.equal((await h.pg.query("select count(*)::int as n from insights")).rows[0].n, 1);
  });
  await t.test("Re-explore uses saved chat and previous insight, and resumes the draft", async () => {
    const response = await explore.POST(null, context(journal.sessionId));
    assert.equal(response.status, 200); round = (await response.json()).round;
    const prompt = JSON.parse(h.state.calls.find((call) => call.kind === "reexplore").user);
    assert.ok(prompt.journal.includes(transcript)); assert.ok(prompt.previousReflections.length > 0);
    assert.equal((await (await explore.POST(null, context(journal.sessionId))).json()).round.id, round.id);
  });
  await t.test("new answers persist before AI refresh and survive an extraction outage", async () => {
    const values = ["Yellow roof", "My sister", "A clear sky"];
    assert.equal((await explore.PUT(request({ roundId: round.id, answers: values }), context(journal.sessionId))).status, 200);
    h.state.failModel = "extract";
    const result = await (await explore.PATCH(request({ roundId: round.id }), context(journal.sessionId))).json();
    assert.equal(result.saved, true); assert.equal(result.updated, false);
    assert.equal((await h.pg.query("select count(*)::int as n from journal_messages")).rows[0].n, 13);
    h.state.failModel = "";
  });
  await t.test("retry refresh saves building, insight and immutable snapshot together", async () => {
    const response = await explore.PATCH(request({ roundId: round.id }), context(journal.sessionId));
    assert.equal(response.status, 200); assert.equal((await response.json()).updated, true);
    firstSnapshot = (await h.pg.query("select insight_snapshot,completed_markdown from journal_explorations where id=$1", [round.id])).rows[0];
    assert.ok(firstSnapshot.insight_snapshot.text); assert.equal((await h.pg.query("select count(*)::int as n from build_data")).rows[0].n, 1);
    assert.equal((await h.pg.query("select count(*)::int as n from insights")).rows[0].n, 2);
    const calls = h.state.calls.length;
    await explore.PATCH(request({ roundId: round.id }), context(journal.sessionId));
    assert.equal(h.state.calls.length, calls);
  });
  await t.test("a second round appends history without replacing the first round", async () => {
    const next = (await (await explore.POST(null, context(journal.sessionId))).json()).round;
    assert.notEqual(next.id, round.id);
    assert.equal((await explore.PUT(request({ roundId: next.id, answers: ["We opened a door.", "A soft breeze.", "The old garden."] }), context(journal.sessionId))).status, 200);
    const result = await (await explore.PATCH(request({ roundId: next.id }), context(journal.sessionId))).json();
    assert.equal(result.updated, true);
    const old = (await h.pg.query("select insight_snapshot,completed_markdown from journal_explorations where id=$1", [round.id])).rows[0];
    assert.deepEqual(old, firstSnapshot);
    assert.equal((await h.pg.query("select conversation_md from journal_sessions where id=$1", [journal.sessionId])).rows[0].conversation_md.match(/## Re-exploration/g).length, 2);
    const cityResponse = await city.GET(new Request("http://localhost/api/city"));
    const current = (await cityResponse.json()).dreams[0];
    assert.equal(current.id, journal.sessionId); assert.equal(current.followUps.length, 9); assert.ok(current.insight);
  });
});
