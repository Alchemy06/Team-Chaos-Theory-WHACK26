// Checks and cleans what LLM 2a returns, so the city never receives a field it can't place.
// The research category and intensity source are decided here in code, not trusted from the AI.

import type { Emotion, Extraction } from "./types";
import { STREETS, hvdcFor, isEmotion, isStreet, isSymbol, isTheme } from "./vocab";
import { selfRatedIntensity, type Entry } from "./entry";

export type CheckResult =
  | { ok: true; value: Extraction; warnings: string[] }
  | { ok: false; errors: string[] };

const strings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === "string").map((s) => s.trim().toLowerCase()) : [];

export function checkExtraction(raw: unknown, entry: Entry): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const r = (raw ?? {}) as Record<string, unknown>;

  // District: must be one of the six emotions
  const primary = typeof r.primaryEmotion === "string" ? r.primaryEmotion.trim().toLowerCase() : r.primaryEmotion;
  if (!isEmotion(primary)) errors.push(`primaryEmotion must be one of ${Object.keys(STREETS).join(", ")}; got ${JSON.stringify(r.primaryEmotion)}`);

  const summary = typeof r.summary === "string" ? r.summary.trim() : "";
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
  const newSymbols = [...new Set([...strings(r.newSymbols), ...symbolsIn.filter((s) => !isSymbol(s))])];
  if (symbols.length === 0) warnings.push("No symbols from the list were found, so this dream will have no links.");
  const themesIn = strings(r.themes);
  const themes = [...new Set(themesIn.filter(isTheme))];
  const dropped = themesIn.filter((t) => !isTheme(t));
  if (dropped.length) warnings.push(`Dropped themes not in the list: ${dropped.join(", ")}`);

  return {
    ok: true,
    warnings,
    value: {
      summary: summary.length > 140 ? `${summary.slice(0, 137)}...` : summary,
      primaryEmotion: emotion,
      hvdcEmotion: emotionStated ? hvdcFor(emotion) : null,
      emotionStated,
      microEmotion: micro,
      intensity,
      intensitySource,
      symbols,
      newSymbols,
      places: strings(r.places).slice(0, 5),
      themes: themes.slice(0, 4),
    },
  };
}
