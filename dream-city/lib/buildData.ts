// LLM 2a for saved journal sessions. Server-only.
// Takes LLM 1's output (the dream and its Q&A, saved in journal_messages and journal_sessions.conversation_md),
// runs the shared extraction prompt and checks (lib/prompts.ts, lib/extraction.ts) and saves every field
// in build_data. /api/extract and /api/journal/:id/build both use this, so they always store the same thing.
import { getMessages, getSession, upsertBuildData, type BuildData } from "./db";
import { fromMarkdown, toMarkdown, type Entry } from "./entry";
import { checkExtraction } from "./extraction";
import { groqJSON } from "./groq";
import { journalDocument } from "./journalMarkdown";
import { EXTRACTION_SYSTEM } from "./prompts";
import type { Extraction } from "./types";

export class ExtractError extends Error {
  constructor(message: string, public status: number, public details: string[] = []) {
    super(message);
  }
}

export type ExtractResult = { entry: Entry; extraction: Extraction; warnings: string[] };

// Asks the model, checks the answer in code, and retries once with the exact problems.
export async function runExtraction(markdown: string, entry: Entry): Promise<ExtractResult> {
  if (!entry.transcript.trim()) throw new ExtractError("The entry has no dream text.", 400);
  let user = markdown;
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: unknown;
    try {
      raw = await groqJSON(EXTRACTION_SYSTEM, user, { temperature: 0.1, maxTokens: 3000 });
    } catch (err) {
      throw new ExtractError("Could not extract this dream.", 502, [err instanceof Error ? err.message : String(err)]);
    }
    const result = checkExtraction(raw, entry);
    if (result.ok) return { entry, extraction: result.value, warnings: result.warnings };
    lastErrors = result.errors;
    user = `${markdown}\n\n---\nYour previous answer was rejected:\n- ${result.errors.join("\n- ")}\nReturn corrected JSON only.`;
  }
  throw new ExtractError("Could not extract this dream.", 502, lastErrors);
}

export function toBuildData(journalID: string, x: Extraction): BuildData {
  return {
    journalID,
    mainEmotion: x.primaryEmotion,
    secondaryEmotion: x.secondaryEmotion,
    buildHeight: x.intensity,
    hoverDesc: x.summary,
    themes: x.themes,
    description: x.description,
    microEmotion: x.microEmotion,
    symbols: x.symbols,
    newSymbols: x.newSymbols,
    places: x.places,
    emotionStated: x.emotionStated,
    hvdcEmotion: x.hvdcEmotion,
    intensitySource: x.intensitySource,
    mentionedWorks: x.mentionedWorks,
    typicalDreams: x.typicalDreams,
  };
}

// The saved entry for a session: built from its messages (keeps each answer with its question),
// or parsed from conversation_md for older sessions without messages.
export async function sessionEntry(id: string): Promise<{ entry: Entry; markdown: string }> {
  const session = await getSession(id);
  if (!session) throw new ExtractError("Session not found", 404);
  if (!session.conversation_md) throw new ExtractError("Save the final journal first.", 409);
  const messages = await getMessages(id);
  const entry = messages.some((m) => m.role === "user" && !m.reply_to_id)
    ? journalDocument(session.created_at, messages).entry
    : { ...fromMarkdown(session.conversation_md), date: session.created_at.slice(0, 10) };
  return { entry, markdown: session.conversation_md };
}

/** Runs LLM 2a on one saved session and stores the full result in build_data. */
export async function extractSession(id: string): Promise<ExtractResult & { build: BuildData; markdown: string }> {
  const { entry, markdown } = await sessionEntry(id);
  const result = await runExtraction(markdown || toMarkdown(entry), entry);
  const build = toBuildData(id, result.extraction);
  try {
    await upsertBuildData(build);
  } catch (err) {
    throw new ExtractError("Could not save the building data.", 500, [err instanceof Error ? err.message : String(err)]);
  }
  return { ...result, build, markdown };
}

/** Kept for older callers: extraction from markdown alone, without saving. */
export async function extractBuildData(journalID: string, md: string): Promise<BuildData> {
  const { extraction } = await runExtraction(md, fromMarkdown(md));
  return toBuildData(journalID, extraction);
}
