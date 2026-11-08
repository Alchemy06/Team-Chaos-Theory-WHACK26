// ── (ADDED) Shared follow-up generation for journal sessions ──
import { groqJSON } from "@/lib/groq";
import { FALLBACK_FOLLOW_UP, FOLLOW_UP_SYSTEM } from "@/lib/prompts";
import { FIXED_QUESTIONS } from "@/lib/vocab";

export async function generateJournalQuestions(transcript: string) {
  let third = FALLBACK_FOLLOW_UP;
  let aiUsed = false;
  try {
    const out = (await groqJSON(FOLLOW_UP_SYSTEM, transcript, { temperature: 0.5, maxTokens: 300 })) as { question?: unknown };
    if (typeof out.question === "string" && out.question.trim().length > 5) {
      third = out.question.trim();
      aiUsed = true;
    }
  } catch (err) {
    console.error("followup:", err); // fall back to the generic question so recording never blocks
  }
  return { questions: [...FIXED_QUESTIONS, third], aiUsed };
}
