// ── (ADDED) Reuse the same questions without creating a session ──
import { generateJournalQuestions } from "@/lib/journalQuestions";
import { z } from "zod";

export async function POST(request: Request) {
  const parsed = z.object({ transcript: z.string().trim().min(1).max(20000) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "A valid transcript is required" }, { status: 400 });
  return Response.json(await generateJournalQuestions(parsed.data.transcript));
}
