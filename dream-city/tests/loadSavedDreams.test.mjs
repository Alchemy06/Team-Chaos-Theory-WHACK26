import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSavedDreams } from "../services/loadSavedDreams.ts";

test("loads saved dreams and an empty city", async () => {
  for (const dreams of [[], [{ id: "saved" }]]) {
    assert.deepEqual(await loadSavedDreams(async () => Response.json({ dreams })), dreams);
  }
});

test("a stalled request times out, aborts, and allows a later retry", async () => {
  let signal;
  await assert.rejects(loadSavedDreams(async (_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  }, 10), /timed out/);
  assert.ok(signal.aborted);
  assert.deepEqual(await loadSavedDreams(async () => Response.json({ dreams: [] })), []);
});

test("reading a stalled response body is also bounded", async () => {
  await assert.rejects(loadSavedDreams(async () => ({ ok: true, json: () => new Promise(() => {}) }), 10), /timed out/);
});

test("database errors and malformed responses reject instead of looking like an empty city", async () => {
  await assert.rejects(loadSavedDreams(async () => Response.json({}, { status: 500 })), /Could not load/);
  await assert.rejects(loadSavedDreams(async () => Response.json({})), /Invalid saved/);
});
