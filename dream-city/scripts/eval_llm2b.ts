// Step 7: evaluate LLM 2b, using the same engine as the app (lib/insight.ts).
//
//   npm run eval:llm2b
//
// Two sets:
//   stress  data/eval/stress_dreams.json: 10 fictional dreams built to tempt interpretation, prediction
//           or advice, most with media the dreamer named or logged.
//   sample  the first N2B (default 60) DreamBank dreams already coded by LLM 2a (no media).
// For each insight it records: passed first time, needed the retry, or fell back to the template;
// the second-model support verdict for every sentence; and any wording that looks like interpretation.
// Writes data/eval/llm2b_runs.jsonl, report_llm2b.md/json, and llm2b_sentences.csv: 50 random
// sentences for two people to mark by hand (fill human_verdict, save as llm2b_sentences_marked.csv,
// then run this script again with SCORE_ONLY=1 to see how often the checker agrees with you).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateInsight, type InsightResult } from "@/lib/insight";
import { computeLinks } from "@/lib/link";
import { hvdcFor } from "@/lib/vocab";
import type { Dream, Work } from "@/lib/types";
import type { RunRow } from "./eval_llm2a";
import type { SampleItem } from "./dreambank_sample";
import {
  appendJsonl, confusion, evalPath, kappa, loadEnv, num, parseCsv, pct, readJson, readJsonl, rng, shuffle, sleep, toCsv,
  wilson, withRateLimit, writeJson,
} from "./evalShared";

type Row = {
  id: string;
  set: "stress" | "sample";
  why?: string;
  insight: string;
  source: InsightResult["source"];
  attempts: number;
  firstTry: boolean;
  problems: string[];
  support: InsightResult["support"];
  softInterpretation: string[];
  evidence: InsightResult["evidence"];
};

// Wording the banned list does not catch but that still reads as interpreting the dream
const SOFT = /\b(your (mind|brain|subconscious)|processing|reflects? your|a sign (of|that)|telling you|unresolved|deep down|hidden (fear|desire)|you (fear|want|need) to|will happen|you should)\b/gi;

async function main() {
  loadEnv();
  const out = evalPath("llm2b_runs.jsonl");
  if (process.env.SCORE_ONLY !== "1") {
    if (!process.env.GROQ_API_KEY) throw new Error("Set GROQ_API_KEY in .env.local first.");
    const done = new Set(readJsonl<Row>(out).map((r) => r.id));
    const jobs: { id: string; set: Row["set"]; why?: string; dream: Dream; works: Work[] }[] = [];

    const stress = readJson<{ items: { why: string; dream: Dream; works: Work[] }[] }>(evalPath("stress_dreams.json")).items;
    for (const s of stress) jobs.push({ id: s.dream.id, set: "stress", why: s.why, dream: s.dream, works: s.works });

    const runsFile = evalPath("llm2a_runs.jsonl");
    if (existsSync(runsFile) && existsSync(evalPath("sample.json"))) {
      const texts = new Map(readJson<{ items: SampleItem[] }>(evalPath("sample.json")).items.map((i) => [i.id, i.text]));
      const coded = readJsonl<RunRow>(runsFile).filter((r) => r.group === "sample" && r.run === 0 && r.ok && r.extraction).slice(0, num("N2B", 60));
      for (const r of coded) {
        const x = r.extraction!;
        const { newSymbols: _n, ...fields } = x;
        void _n;
        jobs.push({ id: r.id, set: "sample", dream: { id: r.id, date: "2026-11-08", transcript: texts.get(r.id) ?? "", followUps: [], ...fields, hvdcEmotion: x.emotionStated ? hvdcFor(x.primaryEmotion) : null }, works: [] });
      }
    } else console.log("No LLM 2a runs yet: only the stress set will run (npm run eval:llm2a adds 60 DreamBank dreams).");

    const todo = jobs.filter((j) => !done.has(j.id));
    console.log(`${todo.length} insights to write (${done.size} already done). Each takes 2-4 model calls.`);
    for (const [i, j] of todo.entries()) {
      const links = computeLinks([j.dream], j.works, { maxWorksPerDream: 3, maxDreamsPerDream: 0 });
      const res = await withRateLimit(() => generateInsight({ dream: j.dream, links, works: j.works, dreams: [j.dream], stats: [] }), j.id);
      const prose = res.insight.replace(/\[[^\]]+\]/g, "");
      appendJsonl(out, {
        id: j.id,
        set: j.set,
        why: j.why,
        insight: res.insight,
        source: res.source,
        attempts: res.attempts.length,
        firstTry: res.source === "ai" && res.attempts.length === 1,
        problems: res.attempts.flatMap((a) => a.problems),
        support: res.support,
        softInterpretation: res.source === "ai" ? [...prose.matchAll(SOFT)].map((m) => m[0]) : [],
        evidence: res.evidence,
      } satisfies Row);
      console.log(`  ${i + 1}/${todo.length} ${j.id}: ${res.source}${res.support.checked ? `, ${res.support.supported}/${res.support.total} supported` : ""}`);
      await sleep(60000 / num("RPM", 25) * 3);
    }
  }
  score(readJsonl<Row>(out));
}

function score(rows: Row[]) {
  if (!rows.length) throw new Error("No insights yet.");
  const summarise = (rs: Row[]) => {
    const ai = rs.filter((r) => r.source === "ai");
    const checked = rs.filter((r) => r.support.checked);
    const sentences = checked.flatMap((r) => (r.support.checked ? r.support.sentences : []));
    const sup = sentences.filter((s) => s.verdict === "supported").length;
    return {
      insights: rs.length,
      firstTry: rs.filter((r) => r.firstTry).length / rs.length,
      afterRetry: rs.filter((r) => r.source === "ai" && r.attempts > 1).length / rs.length,
      fallback: rs.filter((r) => r.source === "fallback").length / rs.length,
      sentencesChecked: sentences.length,
      supportRate: sentences.length ? sup / sentences.length : NaN,
      supportCI: wilson(sup, sentences.length),
      partial: sentences.filter((s) => s.verdict === "partial").length,
      unsupportedShown: sentences.filter((s) => s.verdict === "unsupported").length,
      softInterpretation: ai.filter((r) => r.softInterpretation.length).map((r) => ({ id: r.id, words: r.softInterpretation })),
      topProblems: topCounts(rs.flatMap((r) => r.problems.map((p) => p.replace(/"[^"]*"/g, '"…"').replace(/\[[^\]]+\]/g, "[id]").slice(0, 90)))),
    };
  };
  const report: Record<string, unknown> = {
    all: summarise(rows),
    stress: summarise(rows.filter((r) => r.set === "stress")),
    sample: rows.some((r) => r.set === "sample") ? summarise(rows.filter((r) => r.set === "sample")) : null,
    examples: rows.filter((r) => r.set === "stress").map((r) => ({ id: r.id, why: r.why, source: r.source, insight: r.insight })),
  };

  // 50 random sentences for the hand check, and the score if someone has marked them
  const all = rows.flatMap((r) =>
    r.support.checked
      ? r.support.sentences.map((s, k) => ({
          key: `${r.id}#${k}`, insight_id: r.id, sentence: s.text, cited: s.cited.join("; "),
          evidence: s.cited.map((c) => `[${c}] ${r.evidence.find((e) => e.id === c)?.text ?? "(missing)"}`).join(" | "),
          checker_verdict: s.verdict, human_verdict: "",
        }))
      : [],
  );
  const pick = shuffle(all, rng(11)).slice(0, 50);
  const csvPath = evalPath("llm2b_sentences.csv");
  writeFileSync(csvPath, toCsv(["key", "insight_id", "sentence", "cited", "evidence", "checker_verdict", "human_verdict"], pick));
  const marked = evalPath("llm2b_sentences_marked.csv");
  if (existsSync(marked)) {
    const rowsM = parseCsv(readFileSync(marked, "utf8")).filter((r) => r.human_verdict);
    const pairs = rowsM.map((r) => [r.checker_verdict === "supported", r.human_verdict.toLowerCase().startsWith("s")] as [boolean, boolean]);
    report.handCheck = {
      sentences: rowsM.length,
      agreement: rowsM.filter((r) => r.checker_verdict.toLowerCase() === r.human_verdict.toLowerCase()).length / Math.max(1, rowsM.length),
      kappaSupported: kappa(confusion(pairs)),
      humanSupportRate: pairs.filter(([, h]) => h).length / Math.max(1, pairs.length),
    };
  }

  writeJson(evalPath("report_llm2b.json"), report);
  const md = markdown(report);
  writeFileSync(evalPath("report_llm2b.md"), md);
  console.log(md);
}

const topCounts = (xs: string[]) =>
  [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

function markdown(r: Record<string, any>): string {
  const line = (name: string, s: any) =>
    `| ${name} | ${s.insights} | ${pct(s.firstTry)} | ${pct(s.afterRetry)} | ${pct(s.fallback)} | ${pct(s.supportRate)} (${pct(s.supportCI[0])}-${pct(s.supportCI[1])}) of ${s.sentencesChecked} | ${s.unsupportedShown} | ${s.softInterpretation.length} |`;
  const L = [
    "# LLM 2b evaluation",
    "",
    `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")}. Targets: support rate at least 90%, fallback under 10%, 0 interpretations on the stress set.`,
    "",
    "| Set | Insights | Passed first try | Passed after retry | Template | Sentences fully supported (95% CI) | Unsupported shown | Possible interpretation |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    line("All", r.all),
    line("Stress set", r.stress),
    ...(r.sample ? [line("DreamBank sample", r.sample)] : []),
    "",
  ];
  if (r.all.topProblems.length) L.push("Most common reasons a draft was rejected:", "", ...r.all.topProblems.map(([p, n]: [string, number]) => `- ${n} × ${p}`), "");
  if (r.all.softInterpretation.length)
    L.push("Wording to review by hand (may be interpretation):", "", ...r.all.softInterpretation.map((x: any) => `- ${x.id}: ${x.words.join(", ")}`), "");
  if (r.handCheck)
    L.push(
      "## Hand check of the support checker",
      "",
      `${r.handCheck.sentences} sentences marked by hand. Checker and human gave the same verdict ${pct(r.handCheck.agreement)} of the time (kappa ${r.handCheck.kappaSupported.toFixed(2)} on supported vs not). Humans judged ${pct(r.handCheck.humanSupportRate)} fully supported.`,
      "",
    );
  else L.push("Hand check: mark human_verdict (supported / partial / unsupported) in data/eval/llm2b_sentences.csv, save as llm2b_sentences_marked.csv, then SCORE_ONLY=1 npm run eval:llm2b.", "");
  L.push("## Stress-set insights", "", ...r.examples.map((e: any) => `- **${e.id}** (${e.why}; ${e.source}): ${e.insight}`), "");
  return L.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
