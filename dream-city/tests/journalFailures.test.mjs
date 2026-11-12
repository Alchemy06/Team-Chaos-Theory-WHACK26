import assert from "node:assert/strict";
import { test } from "node:test";
import { appHarness, request, context } from "./helpers/appHarness.mjs";

test("journal validation, fallback and database error recovery", async (t) => {
  const h = await appHarness(); t.after(h.close);
  const start = h.route("journal"), answers = h.route("journal/[id]/answers"), complete = h.route("journal/[id]/complete");
  const body = { transcript: "I was swimming beside a house beneath the ocean." };
  const count = async () => (await h.pg.query("select count(*)::int as n from journal_sessions")).rows[0].n;
  await t.test("invalid input is rejected before AI or database writes", async () => {
    for (const input of [{}, { transcript: "short" }, { transcript: "x".repeat(20001) }, { ...body, cityId: "bad-id" }]) assert.equal((await start.POST(request(input))).status, 400);
    assert.equal(h.state.calls.length, 0); assert.equal(await count(), 0);
  });
  let first;
  await t.test("LLM 1 outage still provides and saves all three fallback questions", async () => {
    h.state.failModel = "followup";
    const response = await start.POST(request(body)); assert.equal(response.status, 201);
    first = await response.json(); assert.equal(first.aiUsed, false); assert.equal(first.questions.length, 3);
    h.state.failModel = "";
  });
  await t.test("partial session creation is rolled back by the route on message save failure", async () => {
    const before = await count(); h.state.failWrite = "journal_messages";
    assert.equal((await start.POST(request(body))).status, 500);
    h.state.failWrite = ""; assert.equal(await count(), before);
  });
  await t.test("session creation failure leaves no extra sessions", async () => {
    const before = await count(); h.state.failWrite = "journal_sessions";
    assert.equal((await start.POST(request(body))).status, 500);
    h.state.failWrite = ""; assert.equal(await count(), before);
  });
  await t.test("a question from another session cannot receive an answer", async () => {
    const second = await (await start.POST(request(body))).json();
    assert.equal((await answers.POST(request({ questionId: first.questions[0].id, answer: "Anxious" }), context(second.sessionId))).status, 400);
  });
  await t.test("blank answers and malformed IDs are rejected", async () => {
    assert.equal((await answers.POST(request({ questionId: first.questions[0].id, answer: " " }), context(first.sessionId))).status, 400);
    assert.equal((await complete.POST(null, context("bad-id"))).status, 400);
  });
  await t.test("completion retries retain the original finished Markdown", async () => {
    assert.equal((await complete.POST(null, context(first.sessionId))).status, 200);
    const before = (await h.pg.query("select conversation_md from journal_sessions where id=$1", [first.sessionId])).rows[0].conversation_md;
    assert.equal((await complete.POST(null, context(first.sessionId))).status, 200);
    assert.equal((await h.pg.query("select conversation_md from journal_sessions where id=$1", [first.sessionId])).rows[0].conversation_md, before);
    assert.equal((await answers.POST(request({ questionId: first.questions[0].id, answer: "Late answer" }), context(first.sessionId))).status, 409);
  });
});
