// POST /api/journal/:id/build -> runs LLM 2a on the saved journal and upserts the full build_data row.
// Same extraction and checks as /api/extract (lib/buildData.ts).
import { ExtractError, extractSession } from "@/lib/buildData";
import { z } from "zod";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Invalid session ID" }, { status: 400 });
  try {
    const { build, warnings } = await extractSession(id);
    return Response.json({ ...build, warnings });
  } catch (err) {
    if (err instanceof ExtractError) return Response.json({ error: err.message, details: err.details }, { status: err.status });
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
