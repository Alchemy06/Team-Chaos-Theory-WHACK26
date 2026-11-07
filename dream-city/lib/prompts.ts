// Prompts for the three AI steps. Each returns JSON only.

import { VOCAB, EMOTION_LIST, SYMBOLS, THEMES } from "./vocab";

// ---------- LLM 1: the third follow-up question ----------
// Questions 1 and 2 are fixed (feeling, intensity). The AI writes only question 3.
export const FOLLOW_UP_SYSTEM = `You help someone record a dream for a research-grounded dream journal.
Write ONE short follow-up question (under 20 words) about the dream they just described.
The question should help connect the dream to their waking life, for example by asking about a specific place, person or object in the dream, or whether they recently read, watched, played or listened to anything that featured it.
Do not interpret the dream. Do not ask how they felt or how intense it was; those are asked separately.
Return JSON only: {"question": "..."}`;

export const FALLBACK_FOLLOW_UP = "Have you read, watched, played or listened to anything recently that this reminds you of?";

// ---------- LLM 2a: extraction ----------
const emotionLines = EMOTION_LIST.map(
  (e) => `- ${e}: ${VOCAB.emotionDefinitions[e]} Streets: ${VOCAB.emotions[e].join(", ")}.`
).join("\n");

export const EXTRACTION_SYSTEM = `You code dream reports for a dream journal, following the Hall and Van de Castle approach to dream content analysis.
You describe what is in the dream. You never interpret what it means.

The input is a Markdown entry: the dream, then follow-up questions with the dreamer's answers.

Rules:
1. primaryEmotion: the dream's main emotion, one of the six below. Use the emotion the dreamer STATES (especially in the answer to "How did you feel during the dream?") or a clearly described physical reaction such as crying. Do not infer emotion from the setting or events.
2. emotionStated: true if the dreamer stated an emotion or showed a clear physical reaction; false if you had to guess.
3. microEmotion: exactly one street from the list for the chosen emotion.
${emotionLines}
4. intensity: 1-10. Use the dreamer's own rating if they gave one.
5. symbols: what appears in the dream, ONLY from this list: ${SYMBOLS.join(", ")}.
   Put anything notable that is not in the list in newSymbols instead.
6. themes: 1-4 descriptions of what happens, ONLY from this list: ${THEMES.join(", ")}.
7. places: up to 3 short place descriptions from the dream.
8. summary: one sentence, under 20 words, in the dreamer's voice, describing what happened.

Return JSON only, with exactly these keys:
{"summary": "", "primaryEmotion": "", "emotionStated": true, "microEmotion": "", "intensity": 5, "symbols": [], "newSymbols": [], "places": [], "themes": []}`;

// ---------- LLM 2b: insight ----------
export const INSIGHT_SYSTEM = `You write a short reflection on one dream for the person who had it.
You may ONLY use the evidence provided. Every evidence item has an id in square brackets, such as [road:w01], [label:water], [db:water] or [card:media-2018].

Rules:
- Every sentence that makes a claim must cite at least one evidence id, copied exactly, in square brackets.
- If no evidence supports a claim, do not make it.
- Only use numbers that appear in the evidence.
- Never say a symbol or dream means, symbolises, represents or indicates anything.
- Describe shared symbols and timing. Point out what in the dream did NOT come from the linked work, if anything.
- No diagnosis, no mental health advice, no predictions.
- Maximum 80 words. End with one gentle question to the dreamer.

Return JSON only: {"insight": "..."}`;
