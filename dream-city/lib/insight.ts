// LLM 2b engine, shared by /api/insight and scripts/eval_llm2b.ts so the test measures the real thing.
//
// 1. Code builds the evidence pack (lib/evidence.ts): the dream, links to media and earlier dreams,
//    honesty labels, DreamBank rates, typical dreams and research cards. Nothing else reaches the model.
// 2. The writer drafts at most 80 words, citing an evidence id for every claim.
// 3. Code checks it (lib/checkInsight.ts): ids exist, numbers are in the evidence, no interpretation words,
//    length, closing question.
// 4. A second model checks every sentence is backed by the evidence it cites (lib/supportCheck.ts).
// 5. A failure goes back to the writer once with the exact problems; a second failure shows a template
//    built only from the evidence. Every attempt is returned so it can be saved and measured.

import baseRatesJson from "@/data/baseRates.json";
import cardsJson from "@/data/researchCards.json";
import { checkInsight, fallbackInsight } from "@/lib/checkInsight";
import { buildEvidencePack, renderPack, type BaseRates, type EvidenceItem } from "@/lib/evidence";
import { groqJSON } from "@/lib/groq";
import { INSIGHT_SYSTEM } from "@/lib/prompts";
import { checkSupport, supportProblems } from "@/lib/supportCheck";
import type { Dream, InsightSource, InsightSupport, Link, ResearchCard, SymbolStat, Work } from "@/lib/types";

const cards = new Map((cardsJson as ResearchCard[]).map((c) => [c.id, c]));
const baseRates = baseRatesJson as BaseRates;

export type InsightRequest = { dream: Dream; links: Link[]; works: Work[]; dreams: Dream[]; stats: SymbolStat[] };

export type InsightAttempt = { text: string; problems: string[]; support?: InsightSupport; error?: string };

export type InsightResult = {
  insight: string;
  cited: string[];
  source: InsightSource;
  problems: string[]; // why the AI drafts were rejected; empty when the AI's insight is shown
  evidence: EvidenceItem[];
  support: InsightSupport;
  attempts: InsightAttempt[];
  writerModel: string;
};

const writerModel = () => process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const supportOn = () => process.env.INSIGHT_SUPPORT_CHECK !== "off";

export async function generateInsight(body: InsightRequest, signal?: AbortSignal): Promise<InsightResult> {
  const works = new Map((body.works ?? []).map((w) => [w.id, w]));
  const pack = buildEvidencePack({
    dream: body.dream,
    links: body.links ?? [],
    works,
    dreams: new Map((body.dreams ?? []).map((d) => [d.id, d])),
    stats: new Map((body.stats ?? []).map((s) => [s.symbol, s])),
    cards,
    baseRates,
  });

  const evidence = renderPack(pack);
  const attempts: InsightAttempt[] = [];
  let user = `Evidence:\n${evidence}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    let text = "";
    try {
      const out = (await groqJSON(INSIGHT_SYSTEM, user, { temperature: 0.4, maxTokens: 1200, signal })) as { insight?: unknown };
      text = typeof out.insight === "string" ? out.insight.trim() : "";
    } catch (err) {
      attempts.push({ text: "", problems: [], error: err instanceof Error ? err.message : String(err) });
      break; // the model is unreachable: go straight to the template
    }

    const check = checkInsight(text, pack);
    let problems = check.problems;
    let support: InsightSupport | undefined;
    if (check.ok && supportOn()) {
      support = await checkSupport(text, pack, signal);
      problems = supportProblems(support);
    }
    attempts.push({ text, problems, support });
    if (problems.length === 0) {
      return {
        insight: text,
        cited: check.cited,
        source: "ai",
        problems: [],
        evidence: pack.items,
        support: support ?? { checked: false, reason: "Support check turned off." },
        attempts,
        writerModel: writerModel(),
      };
    }
    user = `Evidence:\n${evidence}\n\n---\nYour previous insight was rejected:\n- ${problems.join("\n- ")}\nWrite a corrected insight. Return JSON only.`;
  }

  const insight = fallbackInsight(body.dream, pack, works);
  return {
    insight,
    cited: checkInsight(insight, pack).cited,
    source: "fallback",
    problems: attempts.flatMap((a) => (a.error ? [a.error] : a.problems)),
    evidence: pack.items,
    support: { checked: false, reason: "Template: every sentence is filled in from the evidence by code." },
    attempts,
    writerModel: writerModel(),
  };
}
