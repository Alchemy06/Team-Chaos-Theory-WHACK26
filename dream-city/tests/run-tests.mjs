import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// (added) One command for all offline tests; paid/live calls and the built-server smoke check stay explicit.
const files = readdirSync("tests").filter((file) => file.endsWith(".test.mjs") && !file.endsWith(".live.test.mjs") && file !== "smoke.test.mjs").sort().map((file) => `tests/${file}`);
const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", "--test-concurrency=1", ...files], {
  stdio: "inherit", env: { ...process.env, RUN_LIVE_LLM_TESTS: "0" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
