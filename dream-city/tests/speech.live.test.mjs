import assert from "node:assert/strict";
import { test } from "node:test";
const enabled = process.env.RUN_LIVE_LLM_TESTS === "1";
const base = process.env.TEST_APP_URL ?? "http://localhost:3000";

test("assistant voice endpoint returns playable audio for a fictional question", { skip: !enabled, timeout: 45000 }, async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  const response = await fetch(`${base}/api/speech`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "What detail do you remember most clearly?" }), signal: AbortSignal.timeout(40000) });
  assert.equal(response.status, 200, response.ok ? "" : await response.text());
  assert.match(response.headers.get("content-type"), /^audio\//);
  assert.ok((await response.arrayBuffer()).byteLength > 1000);
});
