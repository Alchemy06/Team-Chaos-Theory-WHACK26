// Typed access to data/vocab.json: the controlled lists every AI step must use.

import vocabJson from "@/data/vocab.json";
import type { Emotion, HvdcEmotion } from "./types";

type Vocab = {
  emotions: Record<Emotion, string[]>;
  hvdc: Record<Emotion, HvdcEmotion>;
  emotionDefinitions: Record<Emotion, string>;
  streetSource: Record<string, "hvdc" | "ours">;
  symbols: Record<string, string[]>;
  symbolCategories: Record<string, string[]>;
  themes: string[];
  fixedQuestions: string[];
};

export const VOCAB = vocabJson as unknown as Vocab;

export const EMOTION_LIST = Object.keys(VOCAB.emotions) as Emotion[];
export const STREETS = VOCAB.emotions;
export const SYMBOLS = Object.keys(VOCAB.symbols);
export const THEMES = VOCAB.themes;
export const FIXED_QUESTIONS = VOCAB.fixedQuestions;

export const SYMBOL_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(VOCAB.symbolCategories).flatMap(([cat, list]) => list.map((s) => [s, cat]))
);

export const hvdcFor = (e: Emotion): HvdcEmotion => VOCAB.hvdc[e];
export const isEmotion = (x: unknown): x is Emotion => typeof x === "string" && x in VOCAB.emotions;
export const isStreet = (e: Emotion, s: unknown) => typeof s === "string" && STREETS[e].includes(s);
export const isSymbol = (s: unknown) => typeof s === "string" && s in VOCAB.symbols;
export const isTheme = (t: unknown) => typeof t === "string" && THEMES.includes(t);
