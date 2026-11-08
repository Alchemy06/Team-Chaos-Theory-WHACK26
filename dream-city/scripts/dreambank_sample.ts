// Step 1 of the evaluation: download DreamBank (DReAMy's English copy, about 22,400 reports) once and
// draw a fixed, fair sample from it.
//
//   npm run eval:sample
//
// Writes data/eval/sample.json with two groups:
//   sample  SAMPLE reports (default 300) of 50-300 words, at most 50 per series so a few prolific
//           dreamers do not set the baseline. Used for agreement, base rates and stability.
//   norms   every report in the Hall and Van de Castle norm series (500 men's + 491 women's dreams),
//           whose expert-coded totals are published. Used for the norms check.
// DreamBank is CC BY-NC-SA 4.0 (dreambank.net): attribution, no commercial use.

import { existsSync } from "node:fs";
import { appendJsonl, evalPath, loadEnv, num, readJsonl, rng, shuffle, sleep, writeJson } from "./evalShared";

const DATASET = "DReAMy-lib/DreamBank-dreams-en";
const API = "https://datasets-server.huggingface.co";
const ALL = evalPath("dreambank_all.jsonl");

type Raw = Record<string, unknown> & { row_idx: number };
export type SampleItem = { id: string; series: string; group: "sample" | "norms"; words: number; text: string };

async function getJson(url: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    throw new Error(`${res.status} from ${url}: ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error(`Gave up on ${url}`);
}

async function download() {
  const { splits } = (await getJson(`${API}/splits?dataset=${encodeURIComponent(DATASET)}`)) as { splits: { config: string; split: string }[] };
  const { config, split } = splits.find((s) => s.split === "train") ?? splits[0];
  let offset = readJsonl<Raw>(ALL).length; // resume a partial download
  let total = Infinity;
  while (offset < total) {
    const page = (await getJson(
      `${API}/rows?dataset=${encodeURIComponent(DATASET)}&config=${config}&split=${split}&offset=${offset}&length=100`,
    )) as { rows: { row_idx: number; row: Record<string, unknown> }[]; num_rows_total: number };
    total = page.num_rows_total;
    for (const r of page.rows) appendJsonl(ALL, { row_idx: r.row_idx, ...r.row });
    offset += page.rows.length;
    if (!page.rows.length) break;
    if (offset % 2000 < 100) console.log(`  downloaded ${offset} / ${total}`);
    await sleep(150);
  }
}

const textOf = (r: Raw) => String(r.dreams ?? r.dream ?? r.text ?? r.report ?? r.content ?? "").trim();
const seriesOf = (r: Raw) => String(r.series ?? r.name ?? r.collection ?? r.description ?? "unknown").trim();

async function main() {
  loadEnv();
  if (!existsSync(ALL) || process.env.REDOWNLOAD) {
    console.log(`Downloading ${DATASET} from Hugging Face (one time)...`);
    await download();
  }
  const rows = readJsonl<Raw>(ALL);
  if (!rows.length) throw new Error("No DreamBank rows downloaded.");
  console.log(`DreamBank rows: ${rows.length}. Columns: ${Object.keys(rows[0]).join(", ")}`);

  const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
  const items = rows
    .map((r) => ({ id: `db-${r.row_idx}`, series: seriesOf(r), text: textOf(r) }))
    .filter((r) => r.text)
    .map((r) => ({ ...r, words: words(r.text) }));

  // Series names, so you can check which ones are the Hall and Van de Castle norms
  const counts = new Map<string, number>();
  for (const r of items) counts.set(r.series, (counts.get(r.series) ?? 0) + 1);
  const normPattern = new RegExp(process.env.NORM_SERIES ?? "norm", "i");
  const normSeries = [...counts.keys()].filter((s) => normPattern.test(s));
  console.log(`${counts.size} series. Norm series matched by /${normPattern.source}/i: ${normSeries.join(", ") || "none"}`);
  if (!normSeries.length) console.log("  No norm series found: set NORM_SERIES to a regex matching their names (see the list in dreambank_series.json).");
  writeJson(evalPath("dreambank_series.json"), Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1])));

  const rand = rng(num("SEED", 42));
  const isNorm = (s: string) => normSeries.includes(s);
  const pool = shuffle(items.filter((r) => !isNorm(r.series) && r.words >= 50 && r.words <= 300), rand);
  const perSeries = new Map<string, number>();
  const capped = pool.filter((r) => {
    const n = perSeries.get(r.series) ?? 0;
    if (n >= 50) return false;
    perSeries.set(r.series, n + 1);
    return true;
  });
  const sample: SampleItem[] = capped.slice(0, num("SAMPLE", 300)).map((r) => ({ ...r, group: "sample" }));
  const norms: SampleItem[] = items.filter((r) => isNorm(r.series)).map((r) => ({ ...r, group: "norms" }));

  writeJson(evalPath("sample.json"), {
    created: new Date().toISOString(),
    source: `${DATASET} (DreamBank, dreambank.net, CC BY-NC-SA 4.0)`,
    rule: "sample: 50-300 words, at most 50 per series, seeded shuffle; norms: every report in the norm series",
    counts: { sample: sample.length, norms: norms.length, series: new Set(sample.map((s) => s.series)).size },
    items: [...sample, ...norms],
  });
  console.log(`Wrote data/eval/sample.json: ${sample.length} sample reports from ${new Set(sample.map((s) => s.series)).size} series, ${norms.length} norm reports.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
