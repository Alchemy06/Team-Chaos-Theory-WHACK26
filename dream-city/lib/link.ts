// Roads: score how strongly each dream connects to each work (and to other dreams).
// Plain code, no LLM, so every road can show exactly why it exists.

import type { Dream, Link, Work } from "./types";

const DAY = 24 * 60 * 60 * 1000;

// Heuristic weights: tune them on the demo persona, and say they are heuristics if asked.
const W_SYMBOLS = 0.5;
const W_THEMES = 0.3;
const W_EMOTION = 0.15; // the work's main feeling matches the dream's district
const W_RECENCY = 0.2;
const W_INVOLVEMENT = 0.1;
export const MIN_STRENGTH = 0.35; // below this, no road is drawn
export const STRONG_STRENGTH = 0.6; // at or above this, a bright road
export const WEAK_STRENGTH = 0.45; // below this, the link is drawn dashed ("weaker link" in the key)

const MENTION_BOOST = 0.25; // the dreamer named this work while recording the dream (LLM 2a mentionedWorks)

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

// Did the dreamer name this work? Loose title match: case, punctuation and a leading "The" are ignored.
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/^\s*the\s+/, "").replace(/\s+/g, " ").trim();
export function mentions(dream: Dream, work: Work): boolean {
  const title = norm(work.title);
  return (dream.mentionedWorks ?? []).some((m) => {
    const n = norm(m);
    return n === title || (n.length >= 4 && title.length >= 4 && (n.includes(title) || title.includes(n)));
  });
}
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
      const sharedThemes = overlap(dream.themes, work.themes);
      const sameEmotion = dream.primaryEmotion === work.primaryEmotion;
      const named = mentions(dream, work);
      // A road needs real evidence: a shared symbol, a shared theme (media from the form has themes, no symbols),
      // or the dreamer naming the work themselves.
      if (shared.length === 0 && sharedThemes.length === 0 && !named) continue;
      const daysBefore = work.consumedOn ? Math.round((dreamTime - Date.parse(work.consumedOn)) / DAY) : null;
      if (daysBefore !== null && daysBefore < 0) continue; // finished after the dream: can't have fed it
      const involvement = work.rating ? (work.rating - 1) / 4 : 0.5;
      const scored =
        W_SYMBOLS * ratio(shared.length, dream.symbols, work.symbols) +
        W_THEMES * ratio(sharedThemes.length, dream.themes, work.themes) +
        W_EMOTION * (sameEmotion ? 1 : 0) +
        W_RECENCY * recency(daysBefore) +
        W_INVOLVEMENT * involvement +
        (named ? MENTION_BOOST : 0);
      // A work the dreamer named is always at least a bright road
      const strength = Math.min(1, named ? Math.max(scored, STRONG_STRENGTH) : scored);
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
        explanation: [
          named ? `You named ${work.title} while recording this dream${when}.` : "",
          shared.length || sharedThemes.length
            ? `Shares ${[...shared, ...sharedThemes.map((t) => `the theme ${t}`)].join(", ")}${sameEmotion ? ` and the feeling ${work.primaryEmotion}` : ""} with ${work.title}${named ? "" : when}.`
            : "",
        ].filter(Boolean).join(" "),
        researchCardIds:
          daysBefore !== null && (DAY_RESIDUE(daysBefore) || DREAM_LAG(daysBefore))
            ? ["media-2018", "dream-lag-2011"]
            : ["media-2018", "continuity-schredl"],
        ...(named ? { dreamerMentioned: true } : {}),
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
