// Checks and cleans what LLM 2a returns, so the city never receives a field it can't place.
// The research category and intensity source are decided here in code, not trusted from the AI.

import type { Emotion, Extraction } from "./types";
import { STREETS, hvdcFor, isEmotion, isStreet, isSymbol, isTheme } from "./vocab";
import { normaliseTypicalId } from "./typicalDreams";
import { selfRatedIntensity, type Entry } from "./entry";

export type CheckResult =
  | { ok: true; value: Extraction; warnings: string[] }
  | { ok: false; errors: string[] };

const rawStrings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean) : [];
const strings = (x: unknown): string[] => rawStrings(x).map((s) => s.toLowerCase());

// At most `sentences` sentences and maxChars characters.
function clip(text: string, sentences: number, maxChars: number): string {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  const out = parts.slice(0, sentences).map((p) => p.trim()).join(" ");
  return out.length > maxChars ? `${out.slice(0, maxChars - 3).trimEnd()}...` : out;
}

// Everything the dreamer wrote: the dream and every question and answer.
export const entryText = (entry: Entry) => [entry.transcript, ...entry.followUps.flatMap((f) => [f.q, f.a])].join("\n");

export function checkExtraction(raw: unknown, entry: Entry): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const r = (raw ?? {}) as Record<string, unknown>;

  // District: must be one of the six emotions
  const primary = typeof r.primaryEmotion === "string" ? r.primaryEmotion.trim().toLowerCase() : r.primaryEmotion;
  if (!isEmotion(primary)) errors.push(`primaryEmotion must be one of ${Object.keys(STREETS).join(", ")}; got ${JSON.stringify(r.primaryEmotion)}`);

  // Summary: one short line (title and hover label)
  const summary = typeof r.summary === "string" ? clip(r.summary, 1, 100) : "";
  if (!summary) errors.push("summary is missing");

  if (errors.length) return { ok: false, errors };
  const emotion = primary as Emotion;

  // Street: must belong to that district
  const micro = typeof r.microEmotion === "string" ? r.microEmotion.trim().toLowerCase() : "";
  if (!isStreet(emotion, micro)) {
    return { ok: false, errors: [`microEmotion must be one of ${STREETS[emotion].join(", ")} for ${emotion}; got ${JSON.stringify(r.microEmotion)}`] };
  }

  // Emotion stated? Hall and Van de Castle only codes emotions the dreamer states.
  const emotionStated = r.emotionStated === true;
  if (!emotionStated) warnings.push("The dreamer did not state an emotion, so the research category is left empty.");

  // Secondary emotion: one of the six and different from the main one, otherwise none
  const secondaryRaw = typeof r.secondaryEmotion === "string" ? r.secondaryEmotion.trim().toLowerCase() : null;
  const secondaryEmotion = isEmotion(secondaryRaw) && secondaryRaw !== emotion ? secondaryRaw : null;

  // Intensity: the dreamer's own rating wins over the AI's estimate
  const self = selfRatedIntensity(entry);
  let intensity = self ?? Math.round(Number(r.intensity));
  const intensitySource: Extraction["intensitySource"] = self !== null ? "self" : "ai";
  if (!Number.isFinite(intensity)) {
    intensity = 5;
    warnings.push("No intensity given; defaulted to 5.");
  }
  intensity = Math.min(10, Math.max(1, intensity));

  // Symbols and themes: only from the fixed lists; anything else is kept aside for review
  const symbolsIn = strings(r.symbols);
  const symbols = [...new Set(symbolsIn.filter(isSymbol))];
  const newSymbols = [...new Set([...strings(r.newSymbols), ...symbolsIn.filter((s) => !isSymbol(s))])].filter((s) => !isSymbol(s));
  if (symbols.length === 0) warnings.push("No symbols from the list were found, so this dream will have no roads.");
  const themesIn = strings(r.themes);
  const themes = [...new Set(themesIn.filter(isTheme))];
  const dropped = themesIn.filter((t) => !isTheme(t));
  if (dropped.length) warnings.push(`Dropped themes not in the list: ${dropped.join(", ")}`);

  // Description: up to two sentences; falls back to the summary
  const description = typeof r.description === "string" && r.description.trim() ? clip(r.description, 2, 320) : summary;

  // Mentioned works: only titles the dreamer actually wrote, so the AI can't invent a link
  const text = entryText(entry).toLowerCase();
  const mentionedIn = rawStrings(r.mentionedWorks);
  const mentionedWorks = [...new Set(mentionedIn.filter((t) => text.includes(t.toLowerCase())))];
  const invented = mentionedIn.filter((t) => !mentionedWorks.includes(t));
  if (invented.length) warnings.push(`Dropped works the dreamer did not name: ${invented.join(", ")}`);

  // Typical dreams: only the 55 Typical Dreams Questionnaire ids
  const typicalIn: unknown[] = Array.isArray(r.typicalDreams) ? r.typicalDreams : [];
  const typicalDreams = [...new Set(typicalIn.map(normaliseTypicalId).filter((id): id is string => id !== null))].sort();
  const badTypical = typicalIn.filter((x) => normaliseTypicalId(x) === null);
  if (badTypical.length) warnings.push(`Dropped typical-dream ids not in the questionnaire: ${badTypical.map((x) => JSON.stringify(x)).join(", ")}`);

  return {
    ok: true,
    warnings,
    value: {
      summary,
      description,
      primaryEmotion: emotion,
      secondaryEmotion,
      hvdcEmotion: emotionStated ? hvdcFor(emotion) : null,
      emotionStated,
      microEmotion: micro,
      intensity,
      intensitySource,
      symbols,
      newSymbols,
      places: strings(r.places).slice(0, 5),
      themes: themes.slice(0, 4),
      mentionedWorks,
      typicalDreams: typicalDreams.slice(0, 8),
    },
  };
}
