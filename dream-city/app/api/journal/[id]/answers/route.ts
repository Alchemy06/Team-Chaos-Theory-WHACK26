// ── (ADDED) Validate and save one answer in the no-login demo ──
import { addMessage, getMessages, getSession } from "@/lib/db";
import { answerSequence } from "@/lib/journalSequence";
import { z } from "zod";

const answerSchema = z.object({
  questionId: z.uuid(),
  answer: z.string().trim().min(1).max(10000),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = answerSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return Response.json({ error: "A valid session ID, question ID and answer are required" }, { status: 400 });
  }
  try {
    const session = await getSession(id);
    if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
    const messages = await getMessages(id);
    const question = messages.find((m) => m.id === parsed.data.questionId && m.role === "assistant");
    if (!question) return Response.json({ error: "Question does not belong to this session" }, { status: 400 });

    // ── (ADDED) Repeated requests reuse the answer instead of inserting twice ──
    const existing = messages.find((m) => m.reply_to_id === question.id && m.role === "user");
    if (existing) {
      if (existing.content !== parsed.data.answer) return Response.json({ error: "Question already answered with different text" }, { status: 409 });
      return Response.json({ message: existing });
    }
    if (session.status !== "questioning") return Response.json({ error: "Session is not accepting answers" }, { status: 409 });
    if (messages.filter((m) => m.role === "user" && m.reply_to_id).length >= 3) {
      return Response.json({ error: "Three-answer limit reached" }, { status: 409 });
    }
    const message = await addMessage(id, "user", parsed.data.answer, question.id, answerSequence(question.sequence));
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    console.error("journal answer:", error);
    return Response.json({ error: "Could not save the answer" }, { status: 500 });
  }
}
