// Turns a saved build_data row (what LLM 2a stored) plus its journal into the Dream the city renders.
// Rows saved before migration 003 have no description or symbols; for those, the missing fields
// are estimated with the offline keyword matcher so older buildings still show up.
import type { BuildData, JournalSession, JournalMessage } from "./db";
import type { Dream } from "./types";
import { journalDocument } from "./journalMarkdown";
import { fromMarkdown } from "./entry";
import { offlineExtract } from "@/services/offline";
import { STREETS, hvdcFor } from "./vocab";

export function databaseDream(build: BuildData, session: JournalSession, messages: JournalMessage[]): Dream {
  const entry = messages.some((m) => m.role === "user" && !m.reply_to_id)
    ? journalDocument(session.created_at, messages).entry
    : { ...fromMarkdown(session.conversation_md ?? ""), date: session.created_at.slice(0, 10) };
  const main = build.mainEmotion;
  const fromLLM = build.description !== null; // saved by the full LLM 2a (migration 003 onwards)
  const guess = fromLLM ? null : offlineExtract(entry);
  const streets = STREETS[main];
  const micro = [build.microEmotion, guess?.microEmotion].find((m): m is string => !!m && streets.includes(m)) ?? streets[0];
  const emotionStated = build.emotionStated ?? guess?.emotionStated ?? false;

  return {
    id: session.id,
    date: entry.date,
    transcript: entry.transcript,
    followUps: entry.followUps,
    summary: build.hoverDesc,
    description: build.description ?? undefined,
    primaryEmotion: main,
    secondaryEmotion: build.secondaryEmotion,
    hvdcEmotion: emotionStated ? (build.hvdcEmotion ?? hvdcFor(main)) : null,
    emotionStated,
    microEmotion: micro,
    intensity: build.buildHeight,
    intensitySource: build.intensitySource ?? guess?.intensitySource ?? "ai",
    symbols: fromLLM ? build.symbols : (guess?.symbols ?? []),
    places: fromLLM ? build.places : (guess?.places ?? []),
    themes: build.themes,
    mentionedWorks: build.mentionedWorks,
    typicalDreams: fromLLM ? build.typicalDreams : (guess?.typicalDreams ?? []),
    journalMarkdown: session.conversation_md ?? undefined,
  };
}
