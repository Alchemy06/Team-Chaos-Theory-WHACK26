// Honesty layer: is a recurring symbol really yours, or just common to most dreamers?
// Compares the user's rate with a DreamBank base rate using an exact one-sided binomial test:
// "Yours" only when a count this high would happen by chance less than 5% of the time.

import type { Dream, HonestyLabel, SymbolStat } from "./types";

export const MIN_COUNT = 3; // fewer appearances than this: too early to say
export const ALPHA = 0.05; // significance level for "yours"

// P(X >= k) for X ~ Binomial(n, p): the chance of seeing k or more by luck at the DreamBank rate.
export function binomialTail(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let term = Math.pow(1 - p, n); // P(X = 0)
  let below = 0;
  for (let i = 0; i < k; i++) {
    below += term;
    term = (term * (n - i) * p) / ((i + 1) * (1 - p));
  }
  return Math.max(0, Math.min(1, 1 - below));
}

export function symbolStats(dreams: Dream[], baseRates: Record<string, number>): SymbolStat[] {
  const n = Math.max(1, dreams.length);
  const counts = new Map<string, number>();
  for (const d of dreams) for (const s of new Set(d.symbols)) counts.set(s, (counts.get(s) ?? 0) + 1);

  return [...counts.entries()]
    .map(([symbol, count]) => {
      const userRate = count / n;
      const baseRate = symbol in baseRates ? baseRates[symbol] : null;
      const pValue = baseRate === null ? null : binomialTail(count, n, baseRate);
      let label: HonestyLabel;
      if (count < MIN_COUNT) label = "too_early";
      else if (baseRate === null) label = "no_baseline";
      else if (pValue !== null && pValue < ALPHA && userRate > baseRate) label = "yours";
      else label = "common";
      return { symbol, count, userRate, baseRate, label, pValue };
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
  const chance = s.pValue === undefined || s.pValue === null ? "" : ` Chance of this by luck: ${s.pValue < 0.001 ? "under 0.1%" : `${Math.round(s.pValue * 1000) / 10}%`}.`;
  return s.label === "yours"
    ? `Appears in ${you}, versus ${base}. More often for you than chance would explain.${chance}`
    : `Appears in ${you}, versus ${base}. Not clearly more than most dreamers yet.${chance}`;
}
