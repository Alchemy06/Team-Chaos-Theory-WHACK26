import assert from "node:assert/strict";
import { test } from "node:test";
import { questionSequence, answerSequence } from "../lib/journalSequence.ts";

test("questions and answers interleave after the original dream", () => {
  const rows = [{ role: "user", sequence: 0 }];
  for (const i of [0, 1, 2]) rows.push({ role: "assistant", sequence: questionSequence(i) });
  for (const i of [2, 0, 1]) rows.push({ role: "user", sequence: answerSequence(questionSequence(i)) });
  assert.deepEqual(rows.sort((a, b) => a.sequence - b.sequence).map((m) => m.role),
    ["user", "assistant", "user", "assistant", "user", "assistant", "user"]);
  assert.equal(new Set(rows.map((m) => m.sequence)).size, rows.length);
});

test("a skipped answer keeps its slot without changing later pairs", () => {
  assert.deepEqual([0, questionSequence(0), questionSequence(1), answerSequence(questionSequence(1)), questionSequence(2)], [0, 1, 3, 4, 5]);
});

test("invalid and legacy question positions are rejected", () => {
  for (const value of [-1, 0.5, NaN]) assert.throws(() => questionSequence(value));
  for (const value of [-1, 0, 2, 1.5, NaN]) assert.throws(() => answerSequence(value));
});
