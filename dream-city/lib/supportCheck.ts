// LLM 2b support check: a second model reads each sentence of an insight next to the evidence it
// cites and says whether that evidence really backs it. The code checks (lib/checkInsight.ts) prove a
// citation exists; this proves it says what the sentence claims. Method after ALCE (Gao et al., 2023).

import type { EvidencePack } from "@/lib/evidence";
import { groqJSON } from "@/lib/groq";
import { SUPPORT_SYSTEM } from "@/lib/prompts";
import type { InsightSupport, SupportVerdict } from "@/lib/types";

const VERDICTS: SupportVerdict[] = ["supported", "partial", "unsupported"];

// The writer is openai/gpt-oss-120b; the judge should be a different model so it does not mark its own work.
export const JUDGE_MODELS = (process.env.GROQ_JUDGE_MODEL ?? "llama-3.3-70b-versatile,openai/gpt-oss-20b")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export type Claim = { text: string; cited: string[] };

// Sentences that make a claim, each with the ids it cites. The closing question is not a claim.
export function claimsOf(insight: string): Claim[] {
  // Keep decimals like 81.5% inside their sentence while splitting
  const DOT = "․";
  const safe = insight.replace(/\s+/g, " ").trim().replace(/(\d)\.(\d)/g, `$1${DOT}$2`);
  const parts = safe.match(/[^.!?]+[.!?]+(?:\s*\[[^\]]+\])*|[^.!?]+$/g) ?? [];
  return parts
    .map((p) => p.trim().replaceAll(DOT, "."))
    .filter((p) => p && !p.replace(/\[[^\]]+\]/g, "").trim().endsWith("?"))
    .map((p) => ({ text: p, cited: [...p.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()) }));
}

export async function checkSupport(insight: string, pack: EvidencePack): Promise<InsightSupport> {
  const claims = claimsOf(insight);
  if (claims.length === 0) return { checked: false, reason: "No claims to check." };
  const byId = new Map(pack.items.map((i) => [i.id, i.text]));
  const user = claims
    .map((c, i) => {
      const evidence = c.cited.length ? c.cited.map((id) => `[${id}] ${byId.get(id) ?? "(not in the evidence)"}`).join("\n") : "(cites nothing)";
      return `Sentence ${i + 1}: ${c.text.replace(/\s*\[[^\]]+\]/g, "")}\nCited evidence:\n${evidence}`;
    })
    .join("\n\n");

  let lastError = "";
  for (const model of JUDGE_MODELS) {
    try {
      const raw = (await groqJSON(SUPPORT_SYSTEM, user, { temperature: 0, maxTokens: 1500, model })) as { results?: unknown };
      const results = Array.isArray(raw.results) ? (raw.results as { n?: unknown; verdict?: unknown; reason?: unknown }[]) : [];
      const sentences = claims.map((c, i) => {
        const r = results.find((x) => Number(x.n) === i + 1);
        const verdict = VERDICTS.includes(r?.verdict as SupportVerdict) ? (r!.verdict as SupportVerdict) : null;
        // A sentence citing nothing is never supported; a missing verdict counts against the insight
        const final: SupportVerdict = c.cited.length === 0 ? "unsupported" : (verdict ?? "unsupported");
        const reason = c.cited.length === 0 ? "Cites no evidence." : typeof r?.reason === "string" ? r.reason.slice(0, 200) : "The checker gave no verdict.";
        return { text: c.text, cited: c.cited, verdict: final, reason };
      });
      const count = (v: SupportVerdict) => sentences.filter((s) => s.verdict === v).length;
      return {
        checked: true,
        judgeModel: model,
        total: sentences.length,
        supported: count("supported"),
        partial: count("partial"),
        unsupported: count("unsupported"),
        sentences,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { checked: false, reason: `Support check unavailable: ${lastError.slice(0, 200)}` };
}

// Problems to send back to the writer for its retry.
export function supportProblems(s: InsightSupport): string[] {
  if (!s.checked) return [];
  return s.sentences
    .filter((x) => x.verdict === "unsupported")
    .map((x) => `"${x.text.replace(/\s*\[[^\]]+\]/g, "").slice(0, 120)}" is not supported by ${x.cited.map((c) => `[${c}]`).join(" ") || "any evidence"}: ${x.reason}`);
}
