// Reads one session's conversation_md and asks the model for its building data. Server-only.
import { z } from "zod";
import type { BuildData } from "./db";
import { groqJSON } from "./groq";
import { EMOTION_LIST, THEMES } from "./vocab";

const Schema = z.object({
  mainEmotion: z.enum(EMOTION_LIST as [string, ...string[]]),
  secondaryEmotion: z.enum(EMOTION_LIST as [string, ...string[]]),
  buildHeight: z.number().int().min(1).max(10),
  hoverDesc: z.string().min(1).max(120),
  themes: z.array(z.enum(THEMES as [string, ...string[]])).max(5),
});

const SYSTEM = `You label dream journal entries for a city visualisation. Read the markdown entry and return ONLY a JSON object:
{"mainEmotion": one of ${JSON.stringify(EMOTION_LIST)},
 "secondaryEmotion": one of the same list (may equal mainEmotion),
 "buildHeight": integer 1-10, how intense the dream felt to the dreamer (use their own rating if they gave one),
 "hoverDesc": one short neutral line (max 100 characters) saying what happened in the dream,
 "themes": up to 5 from ${JSON.stringify(THEMES)}, most prominent first}
Base everything on what the entry says. Do not interpret what symbols mean, do not diagnose, keep wording gentle.`;

export async function extractBuildData(journalID: string, md: string): Promise<BuildData> {
  let user = md;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = Schema.safeParse(await groqJSON(SYSTEM, user, { temperature: 0.1, maxTokens: 400 }));
    if (parsed.success) return { journalID, ...(parsed.data as Omit<BuildData, "journalID">) };
    lastError = parsed.error.message;
    user = `${md}\n\n---\nYour previous answer was rejected:\n${lastError.slice(0, 800)}\nReturn corrected JSON only.`;
  }
  throw new Error(`Extraction failed after retry: ${lastError}`);
}
