// LLM 2b: writes the insight for one dream, using only the evidence pack built in code (lib/insight.ts).
// Every insight is checked in code and by a second model; one that fails is regenerated once, then
// replaced with a template. Insights for saved journal sessions are stored with every attempt.
// POST { dream, links, works, dreams, stats }
//   -> { insight, cited, source: "ai" | "fallback", problems, evidence, support, attempts }

import { getSession, saveInsight } from "@/lib/db";
import { generateInsight, type InsightRequest } from "@/lib/insight";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as InsightRequest | null;
  if (!body?.dream) return Response.json({ error: "dream is required" }, { status: 400 });

  const result = await generateInsight(body);

  // Save it when the dream is a saved journal session (tests and demo dreams are not saved)
  let saved = false;
  if (UUID.test(body.dream.id)) {
    try {
      if (await getSession(body.dream.id)) {
        await saveInsight({
          journal_id: body.dream.id,
          text: result.insight,
          source: result.source,
          cited: result.cited,
          problems: result.problems,
          support: result.support,
          attempts: result.attempts,
          evidence: result.evidence,
          writer_model: result.writerModel,
        });
        saved = true;
      }
    } catch (err) {
      // Database not set up or migration 004 not run: still show the insight
      console.warn("insight not saved:", err instanceof Error ? err.message : err);
    }
  }

  return Response.json({
    insight: result.insight,
    cited: result.cited,
    source: result.source,
    problems: result.problems,
    evidence: result.evidence,
    support: result.support,
    attempts: result.attempts.length,
    saved,
  });
}
