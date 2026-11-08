// Step 6: score LLM 2a. Writes data/eval/report_llm2a.md (readable) and report_llm2a.json.
//
//   npm run eval:score
//
// 1. Emotions against DReAMy's expert-trained model (per dream): F1, Cohen's kappa, with a bootstrap
//    95% interval on macro F1. This is agreement with a published research model, not with the experts.
// 2. Emotions against the experts' published Hall and Van de Castle norms (across the 991 norm dreams):
//    80% of coded emotions are negative, for men and women alike.
// 3. Stability: do repeated runs on the same dream give the same answer?
// 4. Typical dreams per dream, set beside published diary rates.
// 5. Hand labels (if labels_final.csv exists): typical dreams and symbols, plus how well the two
//    human labellers agreed with each other.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { hvdcFor, SYMBOLS } from "@/lib/vocab";
import { TYPICAL_DREAMS } from "@/lib/typicalDreams";
import type { Extraction, HvdcEmotion } from "@/lib/types";
import type { RunRow } from "./eval_llm2a";
import {
  bootstrap, confusion, evalPath, f1, fix, jaccard, kappa, loadEnv, meanFinite, num, parseCsv, pct, precision, readJsonl,
  recall, splitList, wilson, writeJson, type Confusion,
} from "./evalShared";

const CODES: Record<string, HvdcEmotion> = { AN: "anger", AP: "apprehension", SD: "sadness", CO: "confusion", HA: "happiness" };
const CLASSES: HvdcEmotion[] = ["anger", "apprehension", "sadness", "confusion", "happiness"];

// Our emotions for one dream, in Hall and Van de Castle terms (wonder counts as happiness).
function ours(x: Extraction): Set<HvdcEmotion> {
  if (!x.emotionStated) return new Set();
  const s = new Set<HvdcEmotion>([hvdcFor(x.primaryEmotion)]);
  if (x.secondaryEmotion) s.add(hvdcFor(x.secondaryEmotion));
  return s;
}

type Pair = { id: string; ours: Set<HvdcEmotion>; ref: Set<HvdcEmotion>; main: HvdcEmotion | null };

function emotionAgreement(pairs: Pair[]) {
  const perClass = (ps: Pair[]) =>
    Object.fromEntries(CLASSES.map((c) => [c, confusion(ps.map((p) => [p.ours.has(c), p.ref.has(c)]))])) as Record<HvdcEmotion, Confusion>;
  const macroF1 = (ps: Pair[]) => {
    const pc = perClass(ps);
    return meanFinite(CLASSES.map((c) => f1(pc[c])));
  };
  const pc = perClass(pairs);
  const both = pairs.filter((p) => p.ours.size && p.ref.size);
  const noneConf = confusion(pairs.map((p) => [p.ours.size === 0, p.ref.size === 0]));
  return {
    n: pairs.length,
    perClass: Object.fromEntries(
      CLASSES.map((c) => [c, { f1: f1(pc[c]), precision: precision(pc[c]), recall: recall(pc[c]), kappa: kappa(pc[c]), refCount: pc[c].tp + pc[c].fn }]),
    ),
    macroF1: macroF1(pairs),
    macroF1CI: bootstrap(pairs, macroF1),
    meanKappa: meanFinite(CLASSES.map((c) => kappa(pc[c]))),
    mainHit: both.length ? both.filter((p) => p.main && p.ref.has(p.main)).length / both.length : NaN,
    mainHitN: both.length,
    notStated: { precision: precision(noneConf), recall: recall(noneConf), refCount: noneConf.tp + noneConf.fn },
  };
}

function handLabels(first: Map<string, Extraction>) {
  const read = (f: string) => (existsSync(evalPath(f)) ? parseCsv(readFileSync(evalPath(f), "utf8")) : null);
  const final = read("labels_final.csv");
  const a = read("labels_a.csv");
  const b = read("labels_b.csv");
  const out: Record<string, unknown> = {};
  const ids = TYPICAL_DREAMS.map((t) => t.id);
  const pairsOver = (rows: { id: string; x: string[]; y: string[] }[], universe: string[]) =>
    confusion(rows.flatMap((r) => universe.map((u) => [r.x.includes(u), r.y.includes(u)] as [boolean, boolean])));

  if (a && b) {
    const byId = new Map(b.map((r) => [r.id, r]));
    const both = a.filter((r) => byId.has(r.id));
    const t = pairsOver(both.map((r) => ({ id: r.id, x: splitList(r.typical_ids), y: splitList(byId.get(r.id)!.typical_ids) })), ids);
    const s = pairsOver(both.map((r) => ({ id: r.id, x: splitList(r.symbols), y: splitList(byId.get(r.id)!.symbols) })), SYMBOLS);
    out.humans = { n: both.length, typicalKappa: kappa(t), symbolKappa: kappa(s) };
  }
  if (final) {
    const rows = final.filter((r) => first.has(r.id));
    const t = pairsOver(rows.map((r) => ({ id: r.id, x: first.get(r.id)!.typicalDreams ?? [], y: splitList(r.typical_ids) })), ids);
    const s = pairsOver(rows.map((r) => ({ id: r.id, x: first.get(r.id)!.symbols, y: splitList(r.symbols) })), SYMBOLS);
    out.model = {
      n: rows.length,
      typical: { kappa: kappa(t), precision: precision(t), recall: recall(t) },
      symbols: { kappa: kappa(s), precision: precision(s), recall: recall(s) },
    };
  }
  return out;
}

function main() {
  loadEnv();
  const runs = readJsonl<RunRow>(evalPath("llm2a_runs.jsonl"));
  if (!runs.length) throw new Error("No runs yet: npm run eval:llm2a");
  const first = new Map(runs.filter((r) => r.run === 0 && r.ok && r.extraction).map((r) => [r.id, r.extraction!]));
  const groupOf = new Map(runs.map((r) => [r.id, r.group]));
  const report: Record<string, unknown> = {
    calls: { total: runs.length, ok: runs.filter((r) => r.ok).length, failed: runs.filter((r) => !r.ok).length },
  };

  // 1. DReAMy reference coder
  const thresh = num("DREAMY_THRESHOLD", 0.5);
  const ref = new Map(
    readJsonl<{ id: string; scores: Record<string, number> }>(evalPath("dreamy_emotions.jsonl")).map((r) => [
      r.id,
      new Set(Object.entries(r.scores).filter(([k, v]) => CODES[k] && v >= thresh).map(([k]) => CODES[k])),
    ]),
  );
  if (ref.size) {
    const pairs: Pair[] = [...first.entries()]
      .filter(([id]) => ref.has(id))
      .map(([id, x]) => ({ id, ours: ours(x), ref: ref.get(id)!, main: x.emotionStated ? hvdcFor(x.primaryEmotion) : null }));
    report.vsDreamy = {
      all: emotionAgreement(pairs),
      sample: emotionAgreement(pairs.filter((p) => groupOf.get(p.id) === "sample")),
      norms: emotionAgreement(pairs.filter((p) => groupOf.get(p.id) === "norms")),
      threshold: thresh,
    };
  }

  // 2. Hall and Van de Castle norms: 80% of coded emotions negative
  const normRows = [...first.entries()].filter(([id]) => groupOf.get(id) === "norms").map(([, x]) => x);
  if (normRows.length) {
    const labels = normRows.flatMap((x) => [...ours(x)]);
    const neg = labels.filter((l) => l !== "happiness").length;
    report.norms = {
      dreams: normRows.length,
      dreamsWithStatedEmotion: normRows.filter((x) => x.emotionStated).length,
      emotionLabels: labels.length,
      negativeShare: labels.length ? neg / labels.length : NaN,
      negativeCI: wilson(neg, labels.length),
      published: 0.8,
      byClass: Object.fromEntries(CLASSES.map((c) => [c, labels.filter((l) => l === c).length])),
    };
  }

  // 3. Stability across repeated runs
  const byId = new Map<string, Extraction[]>();
  for (const r of runs) if (r.ok && r.extraction) byId.set(r.id, [...(byId.get(r.id) ?? []), r.extraction]);
  const repeated = [...byId.values()].filter((xs) => xs.length >= 2);
  if (repeated.length) {
    const same = (f: (x: Extraction) => unknown) => repeated.filter((xs) => xs.every((x) => JSON.stringify(f(x)) === JSON.stringify(f(xs[0])))).length / repeated.length;
    const meanPairwise = (f: (x: Extraction) => string[]) =>
      repeated.reduce((s, xs) => s + jaccard(f(xs[0]), f(xs[1])), 0) / repeated.length;
    report.stability = {
      dreams: repeated.length,
      sameDistrict: same((x) => x.primaryEmotion),
      sameStreet: same((x) => x.microEmotion),
      sameStated: same((x) => x.emotionStated),
      symbolOverlap: meanPairwise((x) => x.symbols),
      typicalOverlap: meanPairwise((x) => x.typicalDreams ?? []),
    };
  }

  // 4. Typical dreams per dream in the general sample
  const sampleRows = [...first.entries()].filter(([id]) => groupOf.get(id) === "sample").map(([, x]) => x);
  if (sampleRows.length) {
    const rate = (id: string) => sampleRows.filter((x) => (x.typicalDreams ?? []).includes(id)).length;
    report.typical = {
      dreams: sampleRows.length,
      withAny: sampleRows.filter((x) => (x.typicalDreams ?? []).length).length / sampleRows.length,
      top: TYPICAL_DREAMS.map((t) => ({ id: t.id, label: t.label, count: rate(t.id), rate: rate(t.id) / sampleRows.length, ci: wilson(rate(t.id), sampleRows.length) }))
        .filter((t) => t.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      chasedLiterature: "About 11-12% of single dreams in diary studies (Wang and Feng, 2024; Mathes et al., 2014)",
    };
  }

  // 5. Hand labels
  report.handLabels = handLabels(first);

  writeJson(evalPath("report_llm2a.json"), report);
  writeFileSync(evalPath("report_llm2a.md"), markdown(report));
  console.log(markdown(report));
}

function markdown(r: Record<string, any>): string {
  const L: string[] = ["# LLM 2a evaluation", "", `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")}. Calls: ${r.calls.ok} ok, ${r.calls.failed} failed.`, ""];
  if (r.vsDreamy) {
    const a = r.vsDreamy.all;
    L.push(
      "## Emotions vs DReAMy's expert-trained model",
      "",
      `${a.n} dreams. Macro F1 over the emotions that occur **${fix(a.macroF1)}** (95% CI ${fix(a.macroF1CI[0])}-${fix(a.macroF1CI[1])}), mean kappa ${fix(a.meanKappa)}. Main emotion in their set: ${pct(a.mainHit)} of ${a.mainHitN}.`,
      `"No emotion stated": precision ${pct(a.notStated.precision)}, recall ${pct(a.notStated.recall)}.`,
      "Benchmarks: fine-tuned BERT 0.85 against the experts themselves; generic sentiment model 0.70 on a simpler task (Bertolini et al., 2024). DReAMy's model is itself about 0.86 against the experts.",
      "",
      "| Emotion | F1 | Precision | Recall | Kappa | Dreams with it (reference) |",
      "| --- | --- | --- | --- | --- | --- |",
      ...CLASSES.map((c) => {
        const x = a.perClass[c];
        return `| ${c} | ${fix(x.f1)} | ${pct(x.precision)} | ${pct(x.recall)} | ${fix(x.kappa)} | ${x.refCount} |`;
      }),
      "",
      `Sample only: macro F1 ${fix(r.vsDreamy.sample.macroF1)} (${r.vsDreamy.sample.n} dreams). Norm dreams only: ${fix(r.vsDreamy.norms.macroF1)} (${r.vsDreamy.norms.n}).`,
      "",
    );
  }
  if (r.norms) {
    const n = r.norms;
    L.push(
      "## Against the published Hall and Van de Castle norms",
      "",
      `${n.dreams} norm dreams, ${n.dreamsWithStatedEmotion} with a stated emotion. Negative share of our emotion labels: **${pct(n.negativeShare)}** (95% CI ${pct(n.negativeCI[0])}-${pct(n.negativeCI[1])}); experts: 80%.`,
      `Caveat: the experts count every emotion in a dream; we give at most two per dream.`,
      "",
    );
  }
  if (r.stability) {
    const s = r.stability;
    L.push(
      "## Stability across repeated runs",
      "",
      `${s.dreams} dreams run more than once. Same district ${pct(s.sameDistrict)}, same street ${pct(s.sameStreet)}, same stated/not stated ${pct(s.sameStated)}. Symbol overlap ${pct(s.symbolOverlap)}, typical-dream overlap ${pct(s.typicalOverlap)}.`,
      "",
    );
  }
  if (r.typical) {
    L.push(
      "## Typical dreams per dream (general sample)",
      "",
      `${r.typical.dreams} dreams; ${pct(r.typical.withAny)} have at least one. Being chased in published diary studies: ${r.typical.chasedLiterature}.`,
      "",
      "| Theme | Dreams | Rate (95% CI) |",
      "| --- | --- | --- |",
      ...r.typical.top.map((t: any) => `| ${t.label} (${t.id}) | ${t.count} | ${pct(t.rate)} (${pct(t.ci[0])}-${pct(t.ci[1])}) |`),
      "",
    );
  }
  const h = r.handLabels ?? {};
  if (h.humans || h.model) {
    L.push("## Hand labels", "");
    if (h.humans) L.push(`Two labellers on ${h.humans.n} dreams: typical-dream kappa ${fix(h.humans.typicalKappa)}, symbol kappa ${fix(h.humans.symbolKappa)}.`);
    if (h.model)
      L.push(
        `AI vs agreed labels on ${h.model.n} dreams: typical dreams kappa ${fix(h.model.typical.kappa)} (precision ${pct(h.model.typical.precision)}, recall ${pct(h.model.typical.recall)}); symbols precision ${pct(h.model.symbols.precision)}, recall ${pct(h.model.symbols.recall)}.`,
      );
    L.push("");
  } else L.push("## Hand labels", "", "Not done yet: npm run eval:labels, then fill labels_a.csv, labels_b.csv and labels_final.csv.", "");
  return L.join("\n");
}

main();
