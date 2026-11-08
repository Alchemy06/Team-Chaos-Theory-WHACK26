import { completeSession, getMessages, getSession } from "@/lib/db";
import { journalDocument } from "@/lib/journalMarkdown";
import { z } from "zod";

// (added) Save the final Markdown in journal_sessions.conversation_md before extraction.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Invalid session ID" }, { status: 400 });
  try {
    const session = await getSession(id);
    if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
    if (session.status === "completed" && session.conversation_md) return Response.json({ saved: true });
    const { markdown } = journalDocument(session.created_at, await getMessages(id));
    await completeSession(id, markdown);
    return Response.json({ saved: true });
  } catch (error) {
    console.error("journal complete:", error);
    return Response.json({ error: "Could not save the final journal." }, { status: 500 });
  }
}
