// Offline fallback for when /api/extract is unavailable (no GROQ_API_KEY, no
// network). Keyword matching against the same controlled vocab the backend
// uses, so the result fits the city. Clearly marked as an estimate in the UI.

import { selfRatedIntensity, type Entry } from "@/lib/entry";
import type { Emotion, Extraction } from "@/lib/types";
import { EMOTION_LIST, STREETS, THEMES, VOCAB, hvdcFor } from "@/lib/vocab";
import { TYPICAL_DREAMS } from "@/lib/typicalDreams";

const EMOTION_WORDS: Record<Emotion, string[]> = {
  anger: ["angry", "furious", "annoyed", "irritated", "rage", "shout", "unfair", "frustrat"],
  apprehension: ["scared", "afraid", "anxious", "nervous", "panic", "fear", "dread", "tense", "worried", "late", "guilt", "embarrass"],
  sadness: ["sad", "cry", "lonely", "alone", "grief", "miss", "homesick", "longing", "empty"],
  confusion: ["confused", "lost", "weird", "strange", "didn't make sense", "unsure", "bewilder"],
  happiness: ["happy", "laugh", "joy", "fun", "warm", "relief", "safe", "content", "glad"],
  wonder: ["amazing", "awe", "beautiful", "wonder", "curious", "glowing", "vast", "magic", "nostalg"],
};

const count = (text: string, words: string[]) => words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasPhrase = (text: string, phrase: string) => new RegExp(`\\b${escape(phrase.toLowerCase())}\\b`).test(text);

export function offlineExtract(entry: Entry): Extraction {
  const feeling = entry.followUps.find((f) => /feel/i.test(f.q))?.a ?? "";
  const text = `${entry.transcript} ${entry.followUps.map((f) => f.a).join(" ")}`.toLowerCase();
  const words = new Set(text.match(/[a-z']+/g) ?? []);

  const symbols = Object.entries(VOCAB.symbols)
    .filter(([, kws]) => kws.some((k) => words.has(k.toLowerCase())))
    .map(([s]) => s)
    .slice(0, 6);

  let primaryEmotion: Emotion = "wonder";
  let best = 0;
  for (const e of EMOTION_LIST) {
    const score = count(feeling.toLowerCase(), EMOTION_WORDS[e]) * 2 + count(text, EMOTION_WORDS[e]);
    if (score > best) {
      best = score;
      primaryEmotion = e;
    }
  }
  const microEmotion = STREETS[primaryEmotion].find((m) => text.includes(m)) ?? STREETS[primaryEmotion][0];
  const self = selfRatedIntensity(entry);
  const emotionStated = feeling.trim().length > 0;
  const first = entry.transcript.split(/(?<=[.!?])\s/)[0].trim();

  const summary = first.length > 90 ? first.slice(0, 87) + "…" : first;
  // Typical dreams by keyword phrase: a rough estimate; the AI reads the full questionnaire wording
  const typicalDreams = TYPICAL_DREAMS.filter((t) => t.keywords.some((k) => hasPhrase(text, k)))
    .map((t) => t.id)
    .slice(0, 4);

  return {
    summary,
    description: summary,
    primaryEmotion,
    secondaryEmotion: null,
    hvdcEmotion: emotionStated ? hvdcFor(primaryEmotion) : null,
    emotionStated,
    microEmotion,
    intensity: self ?? Math.max(2, Math.min(9, 4 + best)),
    intensitySource: self ? "self" : "ai",
    symbols,
    newSymbols: [],
    places: [],
    themes: THEMES.filter((t) => text.includes(t)).slice(0, 3),
    mentionedWorks: [],
    typicalDreams,
  };
}
