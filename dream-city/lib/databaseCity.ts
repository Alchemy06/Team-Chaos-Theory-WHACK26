// ── (ADDED) Adapt saved building records to the existing city renderer ──
import type { BuildData, JournalSession, JournalMessage } from "./db";
import type { Dream } from "./types";
import { journalDocument } from "./journalMarkdown";
import { fromMarkdown } from "./entry";
import { offlineExtract } from "@/services/offline";
import { STREETS } from "./vocab";

export function databaseDream(build: BuildData, session: JournalSession, messages: JournalMessage[]): Dream {
  const entry = messages.some((m) => m.role === "user" && !m.reply_to_id)
    ? journalDocument(session.created_at, messages).entry
    : { ...fromMarkdown(session.conversation_md ?? ""), date: session.created_at.slice(0, 10) };
  const { newSymbols: _unused, ...derived } = offlineExtract(entry);
  void _unused;
  return { ...derived, id: session.id, date: entry.date, transcript: entry.transcript,
    followUps: entry.followUps, summary: build.hoverDesc, primaryEmotion: build.mainEmotion,
    microEmotion: STREETS[build.mainEmotion].includes(derived.microEmotion) ? derived.microEmotion : STREETS[build.mainEmotion][0],
    intensity: build.buildHeight, themes: build.themes };
}
