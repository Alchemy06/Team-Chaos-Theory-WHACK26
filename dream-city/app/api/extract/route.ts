// LLM 2a: reads the .md dream entry and returns the fields the city needs.
// POST { markdown: string } -> { entry, extraction, warnings } or { error, details }

import { fromMarkdown } from "@/lib/entry";
import { checkExtraction } from "@/lib/extraction";
import { groqJSON } from "@/lib/groq";
import { EXTRACTION_SYSTEM } from "@/lib/prompts";
import { getMessages, getSession, upsertBuildData } from "@/lib/db";
import { journalDocument } from "@/lib/journalMarkdown";
import { z } from "zod";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { markdown?: string; sessionId?: string };
  let markdown = body.markdown;
  let savedEntry;
  // (added) LLM 2 reads the final Markdown from journal_sessions, not from the browser.
  if (body.sessionId !== undefined) {
    if (!z.uuid().safeParse(body.sessionId).success) return Response.json({ error: "Invalid session ID" }, { status: 400 });
    try {
      const session = await getSession(body.sessionId);
      if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
      if (!session.conversation_md) return Response.json({ error: "Save the final journal first." }, { status: 409 });
      markdown = session.conversation_md;
      savedEntry = journalDocument(session.created_at, await getMessages(session.id)).entry;
    } catch (error) {
      console.error("journal read:", error);
      return Response.json({ error: "Could not read the saved journal." }, { status: 500 });
    }
  }
  if (!markdown?.trim()) return Response.json({ error: "markdown is required" }, { status: 400 });
  const entry = savedEntry ?? fromMarkdown(markdown);
  if (!entry.transcript) return Response.json({ error: "The entry has no dream text." }, { status: 400 });

  let user = markdown;
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await groqJSON(EXTRACTION_SYSTEM, user, { temperature: 0.1 });
      const result = checkExtraction(raw, entry);
      if (result.ok) {
        // ── (ADDED) A building is displayed only after its data is saved ──
        if (body.sessionId) await upsertBuildData({ journalID: body.sessionId,
          mainEmotion: result.value.primaryEmotion, secondaryEmotion: result.value.primaryEmotion,
          buildHeight: result.value.intensity, hoverDesc: result.value.summary, themes: result.value.themes });
        return Response.json({ entry, extraction: result.value, warnings: result.warnings });
      }
      lastErrors = result.errors;
      // Retry once, telling the model exactly what was wrong
      user = `${markdown}\n\n---\nYour previous answer was rejected:\n- ${result.errors.join("\n- ")}\nReturn corrected JSON only.`;
    } catch (err) {
      lastErrors = [err instanceof Error ? err.message : String(err)];
      break;
    }
  }
  return Response.json({ error: "Could not extract this dream.", details: lastErrors }, { status: 502 });
}
