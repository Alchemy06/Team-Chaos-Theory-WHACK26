// ── (ADDED) Create a session and save its dream and questions ──
import { addMessage, createSession, db, setSessionStatus } from "@/lib/db";
import { generateJournalQuestions } from "@/lib/journalQuestions";
import { z } from "zod";

export async function POST(request: Request) {
  // ── (ADDED) Validate before calling AI or Supabase ──
  const parsed = z.object({ transcript: z.string().trim().min(12).max(20000) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dream must contain 12–20,000 characters" }, { status: 400 });

  let sessionId: string | null = null;
  try {
    const generated = await generateJournalQuestions(parsed.data.transcript);
    const session = await createSession();
    sessionId = session.id;
    await addMessage(session.id, "user", parsed.data.transcript);

    // ── (ADDED) Save sequentially so message order stays consistent ──
    const questions: { id: string; text: string }[] = [];
    for (const text of generated.questions.slice(0, 3)) {
      const message = await addMessage(session.id, "assistant", text);
      questions.push({ id: message.id, text: message.content });
    }
    await setSessionStatus(session.id, "questioning");
    return Response.json({ sessionId: session.id, questions, aiUsed: generated.aiUsed }, { status: 201 });
  } catch (error) {
    // ── (ADDED) Remove incomplete starts so retries do not leave partial sessions ──
    if (sessionId) await db().from("journal_sessions").delete().eq("id", sessionId);
    console.error("journal start:", error);
    return Response.json({ error: "Could not save the journal. Check the server database configuration." }, { status: 500 });
  }
}
