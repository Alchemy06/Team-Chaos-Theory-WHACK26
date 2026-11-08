// Groq labels a piece of media with main_emotion + themes from the fixed lists. Server-only.
import { z } from "zod";
import { addMedia, type Media, type NewMedia } from "./db";
import { groqJSON } from "./groq";
import { getGame, searchGames } from "./rawg";
import { getFilm, searchFilms } from "./tmdb";
import { EMOTION_LIST, THEMES } from "./vocab";
import type { Emotion } from "./types";

const Schema = z.object({
  mainEmotion: z.enum(EMOTION_LIST as [string, ...string[]]),
  themes: z.array(z.enum(THEMES as [string, ...string[]])).max(5),
});

const SYSTEM = `You label books, films, songs and games for a dream journal app. Return ONLY a JSON object:
{"mainEmotion": one of ${JSON.stringify(EMOTION_LIST)}, the dominant feeling of the work (weigh the user's note most if given),
 "themes": up to 5 from ${JSON.stringify(THEMES)}, most prominent first}
Use only labels from these lists. If you do not know the work, rely on the title, description and note.`;

export async function tagMedia(m: {
  kind: string;
  title: string;
  creator?: string | null;
  description?: string | null;
  userNote?: string | null;
}): Promise<{ mainEmotion: Emotion; themes: string[] }> {
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
    if (parsed.success) return { mainEmotion: parsed.data.mainEmotion as Emotion, themes: parsed.data.themes };
    lastError = parsed.error.message;
    user = `${base}\n\n---\nYour previous answer was rejected:\n${lastError.slice(0, 600)}\nReturn corrected JSON only.`;
  }
  throw new Error(`Media tagging failed after retry: ${lastError}`);
}

// Insert media with Groq-made main_emotion + themes. Films (TMDB) and games (RAWG) get a
// description so Groq has more to go on: the exact item when one was picked from the dropdown
// ("tmdb:<id>" / "rawg:<id>"), otherwise the top search hit for the typed title, whose id is
// then saved as external_id. A missing key or an outage never blocks saving.
async function describe(kind: string, title: string, externalId: string | null): Promise<{ description: string | null; externalId: string | null }> {
  const [source, raw] = externalId?.split(":") ?? [];
  const id = Number(raw);
  if (kind === "film") {
    const film =
      source === "tmdb" && id ? await getFilm(id).catch(() => null) : ((await searchFilms(title, 1).catch(() => []))[0] ?? null);
    if (film) return { description: film.overview || null, externalId: externalId ?? `tmdb:${film.id}` };
  }
  if (kind === "game") {
    const pickedId = source === "rawg" && id ? id : (await searchGames(title, 1).catch(() => []))[0]?.id;
    const game = pickedId ? await getGame(pickedId).catch(() => null) : null;
    if (game) {
      const genres = game.genres.length ? `Genres: ${game.genres.join(", ")}. ` : "";
      return { description: `${genres}${game.description}`.trim() || null, externalId: externalId ?? `rawg:${game.id}` };
    }
  }
  return { description: null, externalId };
}

export async function addMediaTagged(m: Omit<NewMedia, "main_emotion" | "themes">): Promise<Media> {
  const { description, externalId } = await describe(m.kind, m.title, m.external_id ?? null);
  const tags = await tagMedia({ ...m, description, userNote: m.user_note });
  return addMedia({ ...m, external_id: externalId, main_emotion: tags.mainEmotion, themes: tags.themes });
}
