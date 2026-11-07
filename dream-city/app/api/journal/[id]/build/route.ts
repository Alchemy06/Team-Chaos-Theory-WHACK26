// POST /api/journal/:id/build -> reads journal_sessions.conversation_md, extracts, upserts build_data.
import { extractBuildData } from "@/lib/buildData";
import { getSession, upsertBuildData } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getSession(id);
    if (!session) return Response.json({ error: "session not found" }, { status: 404 });
    if (!session.conversation_md) return Response.json({ error: "session has no conversation_md yet" }, { status: 409 });
    const data = await extractBuildData(id, session.conversation_md);
    await upsertBuildData(data);
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
