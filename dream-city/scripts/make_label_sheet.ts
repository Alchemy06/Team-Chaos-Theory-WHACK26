// Step 5: make the hand-labelling sheet for typical dreams and symbols (no expert codes exist for these).
//
//   npm run eval:labels
//
// Writes data/eval/labels_template.csv (100 sample reports) and data/eval/label_guide.md (the allowed
// symbols and the 55 typical dreams). Then:
//   1. Two people each copy the template to labels_a.csv and labels_b.csv and fill it in alone,
//      without looking at the AI's answers. typical_ids: e.g. "tdq-01; tdq-12". symbols: e.g. "water; house".
//   2. Together, settle the disagreements in labels_final.csv.
//   3. npm run eval:score reports how well you two agree, and how well the AI matches labels_final.csv.

import { writeFileSync } from "node:fs";
import { SYMBOLS, VOCAB } from "@/lib/vocab";
import { TYPICAL_DREAMS } from "@/lib/typicalDreams";
import type { SampleItem } from "./dreambank_sample";
import { evalPath, loadEnv, num, readJson, toCsv } from "./evalShared";

function main() {
  loadEnv();
  const { items } = readJson<{ items: SampleItem[] }>(evalPath("sample.json"));
  const picked = items.filter((i) => i.group === "sample").slice(0, num("LABELS", 100));
  writeFileSync(
    evalPath("labels_template.csv"),
    toCsv(["id", "text", "typical_ids", "symbols"], picked.map((p) => ({ id: p.id, text: p.text, typical_ids: "", symbols: "" }))),
  );
  const guide = [
    "# Labelling guide",
    "",
    "Label only what the dream report says happens, not what it might mean. Leave a cell empty if nothing applies.",
    "Separate several labels with semicolons.",
    "",
    "## typical_ids: the 55 Typical Dreams Questionnaire themes (Nielsen et al., 2003)",
    "",
    ...TYPICAL_DREAMS.map((t) => `- ${t.id}: ${t.text}`),
    "",
    "## symbols: only these words",
    "",
    ...Object.entries(VOCAB.symbolCategories).map(([cat, list]) => `- ${cat}: ${list.join(", ")}`),
    "",
    `(${SYMBOLS.length} symbols in all.)`,
    "",
  ].join("\n");
  writeFileSync(evalPath("label_guide.md"), guide);
  console.log(`Wrote data/eval/labels_template.csv (${picked.length} reports) and data/eval/label_guide.md.`);
}

main();
