// Shared data shapes. Everyone codes against these.

export type Emotion = "anger" | "apprehension" | "sadness" | "confusion" | "happiness" | "wonder";
// The five Hall and Van de Castle emotion classes. Wonder (ours) counts as happiness.
export type HvdcEmotion = "anger" | "apprehension" | "sadness" | "confusion" | "happiness";
export type WorkKind = "book" | "film" | "song" | "game";

export type Dream = {
  id: string;
  date: string; // ISO date, e.g. "2026-10-22"
  transcript: string;
  followUps: { q: string; a: string }[];
  summary: string;
  primaryEmotion: Emotion; // district
  hvdcEmotion: HvdcEmotion | null; // research category; null if no emotion was stated
  emotionStated: boolean; // true if the dreamer named the feeling (Hall and Van de Castle rule)
  microEmotion: string; // street, from vocab.json
  intensity: number; // 1-10, building height
  intensitySource: "self" | "ai"; // self-rated via the fixed question, or estimated by the AI
  symbols: string[]; // from the vocab.json symbol list where possible
  places: string[];
  themes: string[]; // from the fixed theme list in vocab.json
  insight?: string; // short reflection; cites evidence ids like [card:media-2018]
};

export type Work = {
  id: string;
  title: string;
  creator?: string;
  kind: WorkKind;
  consumedOn?: string; // ISO date the user finished it
  userNote?: string;
  rating?: number; // 1-5
  primaryEmotion: Emotion;
  symbols: string[];
  themes: string[];
};

export type Recommendation = Work & {
  viaSymbols: string[]; // which of the user's symbols led here
  reason: string;
};

export type Link = {
  from: string; // dream id
  to: string; // work id or dream id
  toType: "work" | "dream";
  shared: string[]; // shared symbols, the evidence
  sharedThemes: string[];
  daysBefore: number | null; // how long before the dream the work was finished
  strength: number; // 0-1
  explanation: string;
  researchCardIds: string[];
};

export type HonestyLabel = "yours" | "common" | "too_early" | "no_baseline";

export type SymbolStat = {
  symbol: string;
  count: number;
  userRate: number; // share of the user's dreams containing it
  baseRate: number | null; // share of DreamBank reports containing it
  label: HonestyLabel;
};

export type ResearchCard = {
  id: string;
  claim: string;
  citation: string;
  url: string;
  confidence: string;
  tags: string[];
};

export type DemoCity = {
  persona: { name: string; blurb: string };
  now: string;
  dreams: Dream[];
  works: Work[];
  recommendations: Recommendation[];
};

export type Selection =
  | { kind: "dream"; id: string }
  | { kind: "work"; id: string }
  | { kind: "construction"; id: string }
  | { kind: "landmark"; id: string };

// What LLM 2a returns after reading a .md dream entry.
export type Extraction = {
  summary: string;
  primaryEmotion: Emotion;
  hvdcEmotion: HvdcEmotion | null;
  emotionStated: boolean;
  microEmotion: string;
  intensity: number;
  intensitySource: "self" | "ai";
  symbols: string[]; // only from vocab.json
  newSymbols: string[]; // anything notable that is not in the list, kept for review, not used in the city
  places: string[];
  themes: string[]; // only from vocab.json
};
