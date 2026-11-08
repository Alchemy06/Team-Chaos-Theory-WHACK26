// LLM 2a: reads LLM 1's output (the dream and its Q&A) and returns the fields the city needs.
// POST { sessionId } -> reads the saved journal, extracts, saves everything in build_data.
// POST { markdown }  -> extracts only (nothing is saved).
// Returns { entry, extraction, warnings, markdown? } or { error, details }.

import { ExtractError, extractSession, runExtraction } from "@/lib/buildData";
import { fromMarkdown } from "@/lib/entry";
import { z } from "zod";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { markdown?: string; sessionId?: string };
  try {
    if (body.sessionId !== undefined) {
      if (!z.uuid().safeParse(body.sessionId).success) return Response.json({ error: "Invalid session ID" }, { status: 400 });
      // A building is displayed only after its data is saved
      const { entry, extraction, warnings, markdown } = await extractSession(body.sessionId);
      return Response.json({ entry, extraction, warnings, markdown });
    }
    if (!body.markdown?.trim()) return Response.json({ error: "markdown is required" }, { status: 400 });
    return Response.json(await runExtraction(body.markdown, fromMarkdown(body.markdown)));
  } catch (err) {
    if (err instanceof ExtractError) return Response.json({ error: err.message, details: err.details }, { status: err.status });
    console.error("extract:", err);
    return Response.json({ error: "Could not extract this dream.", details: [err instanceof Error ? err.message : String(err)] }, { status: 500 });
  }
}
