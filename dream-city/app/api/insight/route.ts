// LLM 2b: writes the insight for one dream, using only the evidence pack built in code.
// Every insight is checked; one that fails is regenerated once, then replaced with a template.
// POST { dream, links, works, dreams, stats } -> { insight, cited, source: "ai" | "fallback", problems }

import baseRatesJson from "@/data/baseRates.json";
import cardsJson from "@/data/researchCards.json";
import { checkInsight, fallbackInsight } from "@/lib/checkInsight";
import { buildEvidencePack, renderPack } from "@/lib/evidence";
import { groqJSON } from "@/lib/groq";
import { INSIGHT_SYSTEM } from "@/lib/prompts";
import type { Dream, Link, ResearchCard, SymbolStat, Work } from "@/lib/types";

const cards = new Map((cardsJson as ResearchCard[]).map((c) => [c.id, c]));
const baseRates = baseRatesJson as { placeholder: boolean; n: number; rates: Record<string, number> };

type Body = { dream: Dream; links: Link[]; works: Work[]; dreams: Dream[]; stats: SymbolStat[] };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.dream) return Response.json({ error: "dream is required" }, { status: 400 });

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
  let user = `Evidence:\n${evidence}`;
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = (await groqJSON(INSIGHT_SYSTEM, user, { temperature: 0.4, maxTokens: 800 })) as { insight?: unknown };
      const text = typeof out.insight === "string" ? out.insight.trim() : "";
      const check = checkInsight(text, pack);
      if (check.ok) return Response.json({ insight: text, cited: check.cited, source: "ai", problems: [], evidence: pack.items });
      problems = check.problems;
      user = `Evidence:\n${evidence}\n\n---\nYour previous insight was rejected:\n- ${problems.join("\n- ")}\nWrite a corrected insight. Return JSON only.`;
    } catch (err) {
      problems = [err instanceof Error ? err.message : String(err)];
      break;
    }
  }

  const insight = fallbackInsight(body.dream, pack, works);
  return Response.json({ insight, cited: checkInsight(insight, pack).cited, source: "fallback", problems, evidence: pack.items });
}
