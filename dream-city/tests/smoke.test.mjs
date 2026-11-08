import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { test } from "node:test";

// Run after npm run build. These checks never write to the team database.
test("production routes survive the main/journaling merge", { timeout: 45000 }, async (t) => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  let logs = "";
  server.stdout.on("data", (chunk) => { logs += chunk; });
  server.stderr.on("data", (chunk) => { logs += chunk; });
  t.after(async () => {
    if (server.exitCode === null) {
      const stopped = once(server, "exit");
      server.kill();
      await stopped;
    }
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).status === 200) {
        ready = true;
        break;
      }
    } catch { /* Wait for the production server to listen. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, `Server did not become ready: ${logs}`);
  await t.test("journal page redirects to the working city", async () => {
    const response = await fetch(`${base}/journal`, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location"), base).pathname, "/");
  });
  for (const path of ["/api/journal", "/api/journal/not-a-uuid/answers", "/api/media"]) {
    await t.test(`${path} rejects invalid input before database access`, async () => {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(response.status, 400);
      assert.ok((await response.json()).error);
    });
  }
});
