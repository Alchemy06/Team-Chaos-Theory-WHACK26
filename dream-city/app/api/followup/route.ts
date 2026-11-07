// LLM 1: returns the three follow-up questions for a freshly recorded dream.
// Q1 and Q2 are fixed (feeling, intensity); Q3 is written by the AI.
// POST { transcript: string } -> { questions: string[], aiUsed: boolean }

import { groqJSON } from "@/lib/groq";
import { FALLBACK_FOLLOW_UP, FOLLOW_UP_SYSTEM } from "@/lib/prompts";
import { FIXED_QUESTIONS } from "@/lib/vocab";

export async function POST(request: Request) {
  const { transcript } = (await request.json().catch(() => ({}))) as { transcript?: string };
  if (!transcript?.trim()) return Response.json({ error: "transcript is required" }, { status: 400 });

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
  return Response.json({ questions: [...FIXED_QUESTIONS, third], aiUsed });
}
