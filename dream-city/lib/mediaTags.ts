// Groq labels a piece of media with main_emotion, themes and symbols from the fixed lists. Server-only.
// Symbols use the same list as LLM 2a, so a dream and a work can link on shared symbols (lib/link.ts).
import { z } from "zod";
import { addMedia, type Media, type NewMedia } from "./db";
import { groqJSON } from "./groq";
import { searchFilms } from "./tmdb";
import { steamDescription } from "./steam";
import { EMOTION_LIST, SYMBOLS, THEMES, isSymbol } from "./vocab";
import type { Emotion } from "./types";

const Schema = z.object({
  mainEmotion: z.enum(EMOTION_LIST as [string, ...string[]]),
  themes: z.array(z.enum(THEMES as [string, ...string[]])).max(5),
  symbols: z.array(z.string()).max(12).optional(), // checked against the vocab below, not rejected
});

const SYSTEM = `You label books, films, songs and games for a dream journal app. Return ONLY a JSON object:
{"mainEmotion": one of ${JSON.stringify(EMOTION_LIST)}, the dominant feeling of the work (weigh the user's note most if given),
 "themes": up to 5 from ${JSON.stringify(THEMES)}, most prominent first,
 "symbols": up to 6 from ${JSON.stringify(SYMBOLS)} that clearly appear in the work's story, setting or imagery (e.g. a film set at sea: "ocean"; a book about a school: "school"). Use [] if unsure.}
Use only labels from these lists. If you do not know the work, rely on the title, description and note.`;

export async function tagMedia(m: {
  kind: string;
  title: string;
  creator?: string | null;
  description?: string | null;
  userNote?: string | null;
}): Promise<{ mainEmotion: Emotion; themes: string[]; symbols: string[] }> {
  const base = [
    `Kind: ${m.kind}`,
    `Title: ${m.title}`,
    m.creator && `Creator: ${m.creator}`,
    m.description && `Description: ${m.description}`,
    m.userNote && `User's note: ${m.userNote}`,
  ].filter(Boolean).join("\n");
  let user = base;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = Schema.safeParse(await groqJSON(SYSTEM, user, { temperature: 0.1, maxTokens: 1500 } /* reasoning model: thinking counts toward this limit */));
    if (parsed.success) {
      const symbols = [...new Set((parsed.data.symbols ?? []).map((x) => x.trim().toLowerCase()).filter(isSymbol))].slice(0, 6);
      return { mainEmotion: parsed.data.mainEmotion as Emotion, themes: parsed.data.themes, symbols };
    }
    lastError = parsed.error.message;
    user = `${base}\n\n---\nYour previous answer was rejected:\n${lastError.slice(0, 600)}\nReturn corrected JSON only.`;
  }
  throw new Error(`Media tagging failed after retry: ${lastError}`);
}

// Insert media with Groq-made main_emotion + themes. For films, a TMDB overview is fetched
// (when TMDB_TOKEN is set) to give Groq more to go on, and external_id is set to "tmdb:<id>".
export async function addMediaTagged(m: Omit<NewMedia, "main_emotion" | "themes">): Promise<Media> {
  let description: string | null = null;
  let externalId = m.external_id ?? null;
  // Games picked from the Steam search: fetch Steam's short description so the tagger can pick symbols
  if (m.kind === "game" && externalId?.startsWith("steam:")) description = await steamDescription(externalId.slice("steam:".length));
  if (m.kind === "film" && process.env.TMDB_TOKEN) {
    const hit = (await searchFilms(m.title, 1).catch(() => []))[0];
    if (hit) {
      description = hit.overview;
      externalId ??= `tmdb:${hit.id}`;
    }
  }
  const tags = await tagMedia({ ...m, description, userNote: m.user_note });
  return addMedia({ ...m, external_id: externalId, main_emotion: tags.mainEmotion, themes: tags.themes, symbols: tags.symbols });
}
