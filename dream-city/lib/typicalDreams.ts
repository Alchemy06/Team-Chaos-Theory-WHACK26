// Typed access to data/typicalDreams.json: the 55 Typical Dreams Questionnaire themes
// (Nielsen et al. 2003, research card tdq-2003). LLM 2a may only return these ids.

import tdqJson from "@/data/typicalDreams.json";
import type { TypicalDream } from "./types";

type TdqFile = {
  source: { cardId: string; citation: string; sampleSize: number; measure: string };
  items: TypicalDream[];
};

const TDQ = tdqJson as unknown as TdqFile;

export const TDQ_SOURCE = TDQ.source;
export const TYPICAL_DREAMS: TypicalDream[] = TDQ.items;
export const TYPICAL_BY_ID = new Map(TYPICAL_DREAMS.map((t) => [t.id, t]));
export const isTypicalDream = (id: unknown): id is string => typeof id === "string" && TYPICAL_BY_ID.has(id);

// Accepts "tdq-01", "tdq-1", "TDQ 1", "1" or 1, and returns "tdq-01" (or null if it is not one of the 55).
export function normaliseTypicalId(x: unknown): string | null {
  const m = typeof x === "number" ? [String(x), String(x)] : typeof x === "string" ? x.trim().match(/^(?:tdq[\s_-]*)?(\d{1,2})$/i) : null;
  if (!m) return null;
  const id = `tdq-${String(parseInt(m[1], 10)).padStart(2, "0")}`;
  return TYPICAL_BY_ID.has(id) ? id : null;
}

// Most common first (by lifetime prevalence), for display.
export const byPrevalence = (ids: string[]): TypicalDream[] =>
  ids.map((id) => TYPICAL_BY_ID.get(id)).filter((t): t is TypicalDream => !!t).sort((a, b) => a.rank - b.rank);
