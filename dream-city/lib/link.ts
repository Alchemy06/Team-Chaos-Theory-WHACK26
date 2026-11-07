// Roads: score how strongly each dream connects to each work (and to other dreams).
// Plain code, no LLM, so every road can show exactly why it exists.

import type { Dream, Link, Work } from "./types";

const DAY = 24 * 60 * 60 * 1000;

// Heuristic weights: tune them on the demo persona, and say they are heuristics if asked.
const W_SYMBOLS = 0.5;
const W_THEMES = 0.2;
const W_RECENCY = 0.2;
const W_INVOLVEMENT = 0.1;
export const MIN_STRENGTH = 0.35; // below this, no road is drawn
export const STRONG_STRENGTH = 0.6; // at or above this, a bright road

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x));
const ratio = (shared: number, a: string[], b: string[]) =>
  shared === 0 ? 0 : shared / Math.max(1, Math.min(a.length, b.length));

// Research-based recency. Dreams draw most on the previous day (day-residue) and again on
// events 5-7 days earlier (dream-lag): a U-shape over a week [dream-lag-2011].
// The exact weights are our heuristic, not values from the paper.
const DAY_RESIDUE = (d: number) => d <= 1;
const DREAM_LAG = (d: number) => d >= 5 && d <= 7;

function recency(daysBefore: number | null) {
  if (daysBefore === null) return 0.3; // unknown date: small, neutral weight
  if (DAY_RESIDUE(daysBefore)) return 1;
  if (DREAM_LAG(daysBefore)) return 0.85;
  if (daysBefore < 5) return 0.6; // days 2-4: the dip in the U
  if (daysBefore >= 30) return 0;
  return 0.6 * (1 - (daysBefore - 7) / 23);
}

const VERB: Record<Work["kind"], string> = {
  book: "finished",
  film: "watched",
  song: "listened to",
  game: "played",
};

export function computeLinks(
  dreams: Dream[],
  works: Work[],
  opts: { maxWorksPerDream?: number; maxDreamsPerDream?: number } = {}
): Link[] {
  const maxWorks = opts.maxWorksPerDream ?? 3;
  const maxDreams = opts.maxDreamsPerDream ?? 1;
  const links: Link[] = [];

  for (const dream of dreams) {
    const dreamTime = Date.parse(dream.date);

    // Dream -> work roads
    const candidates: Link[] = [];
    for (const work of works) {
      const shared = overlap(dream.symbols, work.symbols);
      if (shared.length === 0) continue;
      const daysBefore = work.consumedOn ? Math.round((dreamTime - Date.parse(work.consumedOn)) / DAY) : null;
      if (daysBefore !== null && daysBefore < 0) continue; // finished after the dream: can't have fed it
      const sharedThemes = overlap(dream.themes, work.themes);
      const involvement = work.rating ? (work.rating - 1) / 4 : 0.5;
      const strength =
        W_SYMBOLS * ratio(shared.length, dream.symbols, work.symbols) +
        W_THEMES * ratio(sharedThemes.length, dream.themes, work.themes) +
        W_RECENCY * recency(daysBefore) +
        W_INVOLVEMENT * involvement;
      if (strength < MIN_STRENGTH) continue;
      const when =
        daysBefore === null
          ? ""
          : daysBefore === 0
            ? `, ${VERB[work.kind]} the same day`
            : `, ${VERB[work.kind]} ${daysBefore} day${daysBefore === 1 ? "" : "s"} before`;
      candidates.push({
        from: dream.id,
        to: work.id,
        toType: "work",
        shared,
        sharedThemes,
        daysBefore,
        strength: Math.round(strength * 100) / 100,
        explanation: `Shares ${shared.join(", ")} with ${work.title}${when}.`,
        researchCardIds:
          daysBefore !== null && (DAY_RESIDUE(daysBefore) || DREAM_LAG(daysBefore))
            ? ["media-2018", "dream-lag-2011"]
            : ["media-2018", "continuity-schredl"],
      });
    }
    candidates.sort((a, b) => b.strength - a.strength);
    links.push(...candidates.slice(0, maxWorks));

    // Dream -> earlier dream roads (recurring patterns), at least two shared symbols
    const earlier = dreams
      .filter((d) => Date.parse(d.date) < dreamTime)
      .map((d) => ({ d, shared: overlap(dream.symbols, d.symbols) }))
      .filter((x) => x.shared.length >= 2)
      .sort((a, b) => b.shared.length - a.shared.length || b.d.date.localeCompare(a.d.date))
      .slice(0, maxDreams);
    for (const { d, shared } of earlier) {
      links.push({
        from: dream.id,
        to: d.id,
        toType: "dream",
        shared,
        sharedThemes: overlap(dream.themes, d.themes),
        daysBefore: Math.round((dreamTime - Date.parse(d.date)) / DAY),
        strength: Math.round(Math.min(1, 0.25 + 0.15 * shared.length) * 100) / 100,
        explanation: `Recurring: shares ${shared.join(", ")} with your dream on ${d.date}.`,
        researchCardIds: [],
      });
    }
  }
  return links;
}
