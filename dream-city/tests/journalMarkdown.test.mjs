import assert from "node:assert/strict";
import { test } from "node:test";
import { journalDocument } from "../lib/journalMarkdown.ts";

const messages = [
  { id: "dream", sequence: 0, role: "user", content: "I was flying.\nAbove a city.", reply_to_id: null },
  { id: "q1", sequence: 1, role: "assistant", content: "How did you feel?", reply_to_id: null },
  { id: "q2", sequence: 3, role: "assistant", content: "How intense was it?", reply_to_id: null },
  { id: "a2", sequence: 4, role: "user", content: "7", reply_to_id: "q2" },
  { id: "a1", sequence: 2, role: "user", content: "Happy.", reply_to_id: "q1" },
];

test("final Markdown contains the dated conversation in question/answer order", () => {
  const result = journalDocument("2026-11-08T12:00:00Z", messages);
  assert.equal(result.markdown, "# Dream Journal — 8 November 2026\n\n## User\n\nI was flying.\nAbove a city.\n\n## Assistant\n\nHow did you feel?\n\n## User\n\nHappy.\n\n## Assistant\n\nHow intense was it?\n\n## User\n\n7\n");
  assert.deepEqual(result.entry.followUps, [{ q: "How did you feel?", a: "Happy." }, { q: "How intense was it?", a: "7" }]);
  assert.equal(result.entry.date, "2026-11-08");
});

test("date comes from the session and unanswered questions do not invent user text", () => {
  const result = journalDocument("2027-01-02T00:00:00Z", messages.slice(0, 3));
  assert.ok(result.markdown.startsWith("# Dream Journal — 2 January 2027\n"));
  assert.equal(result.markdown.match(/## User/g).length, 1);
  assert.equal(result.entry.followUps[0].a, "");
});

test("a missing saved dream is rejected", () => {
  assert.throws(() => journalDocument("2026-11-08", messages.slice(1)), /no saved dream/);
});
