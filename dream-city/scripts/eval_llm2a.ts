// Step 2: run the real LLM 2a (same prompt, same code checks as the app) on the DreamBank sample.
//
//   npm run eval:llm2a
//
// The first STABILITY sample reports (default 100) are run RUNS times (default 3) to measure how stable
// the answers are; everything else runs once. Results are appended to data/eval/llm2a_runs.jsonl, so an
// interrupted run picks up where it stopped. RPM sets the pace (default 25 calls a minute).

import { ExtractError, runExtraction } from "@/lib/buildData";
import { toMarkdown, type Entry } from "@/lib/entry";
import type { Extraction } from "@/lib/types";
import type { SampleItem } from "./dreambank_sample";
import { appendJsonl, evalPath, loadEnv, num, readJson, readJsonl, sleep, withRateLimit } from "./evalShared";

export type RunRow = {
  id: string;
  group: "sample" | "norms";
  series: string;
  run: number;
  ok: boolean;
  extraction?: Extraction;
  warnings?: string[];
  errors?: string[];
  ms: number;
};

async function main() {
  loadEnv();
  if (!process.env.GROQ_API_KEY) throw new Error("Set GROQ_API_KEY in .env.local first.");
  const { items } = readJson<{ items: SampleItem[] }>(evalPath("sample.json"));
  const out = evalPath("llm2a_runs.jsonl");
  const done = new Set(readJsonl<RunRow>(out).map((r) => `${r.id}#${r.run}`));
  const RUNS = num("RUNS", 3);
  const STABILITY = num("STABILITY", 100);
  const gap = 60000 / num("RPM", 25);
  const skipNorms = process.env.SKIP_NORMS === "1";

  const jobs: { item: SampleItem; run: number }[] = [];
  let sampleIndex = 0;
  for (const item of items) {
    if (item.group === "norms" && skipNorms) continue;
    const runs = item.group === "sample" && sampleIndex++ < STABILITY ? RUNS : 1;
    for (let run = 0; run < runs; run++) if (!done.has(`${item.id}#${run}`)) jobs.push({ item, run });
  }
  console.log(`${jobs.length} LLM 2a calls to make (${done.size} already done). About ${Math.ceil((jobs.length * gap) / 60000)} minutes at this pace.`);

  let ok = 0;
  for (const [i, { item, run }] of jobs.entries()) {
    // DreamBank reports are written dreams with no follow-up questions, so emotions must come from the text
    const entry: Entry = { date: "2000-01-01", transcript: item.text, followUps: [] };
    const started = Date.now();
    let row: RunRow;
    try {
      const res = await withRateLimit(() => runExtraction(toMarkdown(entry), entry), item.id);
      row = { id: item.id, group: item.group, series: item.series, run, ok: true, extraction: res.extraction, warnings: res.warnings, ms: Date.now() - started };
      ok++;
    } catch (err) {
      const errors = err instanceof ExtractError ? [err.message, ...err.details] : [err instanceof Error ? err.message : String(err)];
      row = { id: item.id, group: item.group, series: item.series, run, ok: false, errors, ms: Date.now() - started };
    }
    appendJsonl(out, row);
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1} / ${jobs.length} (${ok} ok)`);
    await sleep(Math.max(0, gap - (Date.now() - started)));
  }
  console.log(`Done: ${ok} of ${jobs.length} new calls succeeded. Results in data/eval/llm2a_runs.jsonl`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
