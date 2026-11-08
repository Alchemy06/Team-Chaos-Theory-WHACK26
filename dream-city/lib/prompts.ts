// Prompts for the three AI steps. Each returns JSON only.

import { VOCAB, EMOTION_LIST, SYMBOLS, THEMES } from "./vocab";
import { TYPICAL_DREAMS } from "./typicalDreams";

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

// The 55 Typical Dreams Questionnaire items (Nielsen et al. 2003), one per line, for rule 12.
const typicalLines = TYPICAL_DREAMS.map((t) => `- ${t.id}: ${t.text}`).join("\n");

// LLM 2a reads only the entry (the dream and its Q&A from LLM 1) and these lists.
// It never sees the user's media or research papers, so the roads stay independent evidence.
export const EXTRACTION_SYSTEM = `You code dream reports for a dream journal, following the Hall and Van de Castle approach to dream content analysis.
You describe what is in the dream. You never interpret what it means.

The input is a Markdown entry: the dream, then follow-up questions with the dreamer's answers.

Rules:
1. primaryEmotion: the dream's main emotion, one of the six below. Use the emotion the dreamer STATES (especially in the answer to "How did you feel during the dream?") or a clearly described physical reaction such as crying. Do not infer emotion from the setting or events.
2. secondaryEmotion: a second, different emotion the dreamer also stated, from the same six. Use null if there is none. Never repeat primaryEmotion.
3. emotionStated: true if the dreamer stated an emotion or showed a clear physical reaction; false if you had to guess.
4. microEmotion: exactly one street from the list for the chosen primaryEmotion.
${emotionLines}
5. intensity: 1-10. Use the dreamer's own rating if they gave one.
6. symbols: what appears in the dream, ONLY from this list: ${SYMBOLS.join(", ")}.
   Put anything notable that is not in the list in newSymbols instead.
7. themes: 1-4 descriptions of what happens, ONLY from this list: ${THEMES.join(", ")}.
8. places: up to 3 short place descriptions from the dream.
9. summary: one short line, under 15 words, describing what happened. It is the building's title.
10. description: one or two plain sentences describing what happened in the dream, in the third person ("The dreamer..."). Describe events only; no interpretation.
11. mentionedWorks: titles of books, films, songs, games or shows that the dreamer NAMED in the entry, copied exactly as written. Use [] if none. Never add a title the dreamer did not write.
12. typicalDreams: the ids of the Typical Dreams Questionnaire themes below that clearly happen in this dream. Tag only what is described, not what is implied. Most dreams match 0-3. Tag every item in the same neutral way, including sensitive ones. Use [] if none.
${typicalLines}

Return JSON only, with exactly these keys:
{"summary": "", "description": "", "primaryEmotion": "", "secondaryEmotion": null, "emotionStated": true, "microEmotion": "", "intensity": 5, "symbols": [], "newSymbols": [], "places": [], "themes": [], "mentionedWorks": [], "typicalDreams": []}`;

// ---------- LLM 2b: insight ----------
export const INSIGHT_SYSTEM = `You write a short reflection on one dream for the person who had it.
You may ONLY use the evidence provided. Every evidence item has an id in square brackets, such as [road:w01], [label:water], [db:water], [typical:tdq-01] or [card:media-2018].

Rules:
- Every sentence that makes a claim must cite at least one evidence id, copied exactly, in square brackets.
- If no evidence supports a claim, do not make it.
- Only use numbers that appear in the evidence.
- Never say a symbol or dream means, symbolises, represents or indicates anything.
- [typical:...] items give how many people have EVER had that kind of dream (lifetime prevalence). Never present it as how often it happens per night.
- Describe shared symbols and timing. Point out what in the dream did NOT come from the linked work, if anything.
- No diagnosis, no mental health advice, no predictions.
- Maximum 80 words. End with one gentle question to the dreamer.

Return JSON only: {"insight": "..."}`;
