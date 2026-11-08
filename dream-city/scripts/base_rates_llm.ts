// Step 4: replace the placeholder DreamBank base rates with rates measured by LLM 2a itself.
//
//   npm run eval:base-rates
//
// Reads the first run of every "sample" report in data/eval/llm2a_runs.jsonl and writes
// data/baseRates.json. Because the user's symbols also come from LLM 2a, "yours" vs "common" then
// compares like with like (the old keyword script measured something different).

import { SYMBOLS } from "@/lib/vocab";
import { TYPICAL_DREAMS } from "@/lib/typicalDreams";
import type { RunRow } from "./eval_llm2a";
import { evalPath, loadEnv, readJsonl, writeJson, ROOT } from "./evalShared";
import path from "node:path";

function main() {
  loadEnv();
  const rows = readJsonl<RunRow>(evalPath("llm2a_runs.jsonl")).filter((r) => r.group === "sample" && r.run === 0 && r.ok && r.extraction);
  if (rows.length < 50) throw new Error(`Only ${rows.length} coded sample reports; run npm run eval:llm2a first (need at least 50).`);
  const n = rows.length;
  const share = (has: (r: RunRow) => boolean) => Math.round((rows.filter(has).length / n) * 10000) / 10000;

  const rates = Object.fromEntries(SYMBOLS.map((s) => [s, share((r) => r.extraction!.symbols.includes(s))]));
  const typicalRates = Object.fromEntries(TYPICAL_DREAMS.map((t) => [t.id, share((r) => (r.extraction!.typicalDreams ?? []).includes(t.id))]));
  const series = new Set(rows.map((r) => r.series)).size;

  writeJson(path.join(ROOT, "data", "baseRates.json"), {
    placeholder: false,
    method: "llm2a",
    note: `Measured by running LLM 2a on ${n} DreamBank reports (${series} series, at most 50 each, 50-300 words). Same method as your own dreams, so the comparison is like for like. DreamBank: dreambank.net, CC BY-NC-SA 4.0.`,
    n,
    series,
    rates,
    typicalRates,
  });
  const top = Object.entries(rates).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`Wrote data/baseRates.json from ${n} reports in ${series} series. Most common symbols:`);
  for (const [s, r] of top) console.log(`  ${s.padEnd(12)} ${(r * 100).toFixed(1)}%`);
}

main();
