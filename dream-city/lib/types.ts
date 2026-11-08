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
  summary: string; // one short line: the building's title and hover label
  description?: string; // up to two sentences on what happened (LLM 2a)
  primaryEmotion: Emotion; // district
  secondaryEmotion?: Emotion | null; // a second feeling the dreamer stated, if any
  hvdcEmotion: HvdcEmotion | null; // research category; null if no emotion was stated
  emotionStated: boolean; // true if the dreamer named the feeling (Hall and Van de Castle rule)
  microEmotion: string; // street, from vocab.json
  intensity: number; // 1-10, building height
  intensitySource: "self" | "ai"; // self-rated via the fixed question, or estimated by the AI
  symbols: string[]; // from the vocab.json symbol list where possible
  places: string[];
  themes: string[]; // from the fixed theme list in vocab.json
  mentionedWorks?: string[]; // titles the dreamer named themselves (checked against the entry text)
  typicalDreams?: string[]; // Typical Dreams Questionnaire ids, e.g. "tdq-01" (data/typicalDreams.json)
  journalMarkdown?: string; // the saved journal_sessions.conversation_md, for the full-entry view
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
  dreamerMentioned?: boolean; // the dreamer named this work while recording the dream
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
  summary: string; // one short line
  description: string; // up to two sentences
  primaryEmotion: Emotion;
  secondaryEmotion: Emotion | null; // must differ from primaryEmotion
  hvdcEmotion: HvdcEmotion | null;
  emotionStated: boolean;
  microEmotion: string;
  intensity: number;
  intensitySource: "self" | "ai";
  symbols: string[]; // only from vocab.json
  newSymbols: string[]; // anything notable that is not in the list, kept for review, not used in the city
  places: string[];
  themes: string[]; // only from vocab.json
  mentionedWorks: string[]; // titles the dreamer named; dropped unless they appear in the entry text
  typicalDreams: string[]; // Typical Dreams Questionnaire ids, only from data/typicalDreams.json
};

// One of the 55 Typical Dreams Questionnaire themes (Nielsen et al. 2003).
export type TypicalDream = {
  id: string; // "tdq-01" ... "tdq-55"
  item: number; // item number in the questionnaire
  text: string; // item wording
  label: string; // short label for the UI
  prevalence: number; // % of 1,181 students who had EVER dreamed it (lifetime, not per dream)
  rank: number; // 1 = most common
  factor: string; // one of the paper's 16 factor groups
  sensitive: boolean; // tagged like any other, but not singled out in the UI or the insight
  keywords: string[]; // offline fallback only
};
