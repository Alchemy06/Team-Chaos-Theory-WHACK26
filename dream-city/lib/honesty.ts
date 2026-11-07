// Honesty layer: is a recurring symbol really yours, or just common to most dreamers?
// Compares the user's rate with a DreamBank base rate. A heuristic, not a statistical test.

import type { Dream, HonestyLabel, SymbolStat } from "./types";

export const MIN_COUNT = 3; // fewer appearances than this: too early to say
export const YOURS_MULTIPLIER = 2; // at least twice the base rate counts as "yours"

export function symbolStats(dreams: Dream[], baseRates: Record<string, number>): SymbolStat[] {
  const n = Math.max(1, dreams.length);
  const counts = new Map<string, number>();
  for (const d of dreams) for (const s of new Set(d.symbols)) counts.set(s, (counts.get(s) ?? 0) + 1);

  return [...counts.entries()]
    .map(([symbol, count]) => {
      const userRate = count / n;
      const baseRate = symbol in baseRates ? baseRates[symbol] : null;
      let label: HonestyLabel;
      if (count < MIN_COUNT) label = "too_early";
      else if (baseRate === null) label = "no_baseline";
      else if (userRate >= YOURS_MULTIPLIER * baseRate) label = "yours";
      else label = "common";
      return { symbol, count, userRate, baseRate, label };
    })
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol));
}

export const LABEL_TEXT: Record<HonestyLabel, string> = {
  yours: "Yours",
  common: "Common",
  too_early: "Too early",
  no_baseline: "No baseline",
};

export function explainStat(s: SymbolStat): string {
  const you = `${s.count} of your dreams (${Math.round(s.userRate * 100)}%)`;
  if (s.label === "too_early") return `Appears in ${you}. Not enough dreams yet to tell if it is a pattern.`;
  if (s.baseRate === null) return `Appears in ${you}. No DreamBank baseline for this symbol yet.`;
  const base = `${Math.round(s.baseRate * 100)}% of DreamBank reports`;
  return s.label === "yours"
    ? `Appears in ${you}, versus ${base}. Noticeably more often for you.`
    : `Appears in ${you}, versus ${base}. Common for most dreamers.`;
}
