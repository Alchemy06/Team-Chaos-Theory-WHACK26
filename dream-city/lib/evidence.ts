// The evidence pack: everything LLM 2b is allowed to say, each item with an id it must cite.
// Built in code from roads, labels, DreamBank and research cards. No AI involved.

import type { Dream, Link, ResearchCard, SymbolStat, Work } from "./types";
import { explainStat } from "./honesty";
import { TDQ_SOURCE, byPrevalence } from "./typicalDreams";

export type EvidenceItem = { id: string; text: string };
export type EvidencePack = {
  items: EvidenceItem[];
  ids: Set<string>;
  numbers: Set<string>; // every number the insight is allowed to use
  roads: Link[];
};

const VERB: Record<Work["kind"], string> = { book: "finished", film: "watched", song: "listened to", game: "played" };

// Numbers as they might appear in text: "29%", "29", "3"
function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d+(?:\.\d+)?%?/g)].flatMap((m) => [m[0], m[0].replace("%", "")]);
}

export function buildEvidencePack(args: {
  dream: Dream;
  links: Link[];
  works: Map<string, Work>;
  dreams: Map<string, Dream>;
  stats: Map<string, SymbolStat>;
  cards: Map<string, ResearchCard>;
  baseRates: { placeholder: boolean; n: number; rates: Record<string, number> };
  maxRoads?: number;
}): EvidencePack {
  const { dream, works, dreams, stats, cards, baseRates } = args;
  const items: EvidenceItem[] = [];

  items.push({
    id: "dream",
    text: `The dream (${dream.date}): ${dream.description || dream.summary} Main emotion: ${dream.primaryEmotion}${dream.emotionStated ? " (stated by the dreamer)" : " (not stated)"}, intensity ${dream.intensity}/10${dream.intensitySource === "self" ? " (self-rated)" : ""}. Symbols: ${dream.symbols.join(", ") || "none"}.${dream.secondaryEmotion ? ` Second emotion: ${dream.secondaryEmotion}.` : ""}`,
  });

  // Roads: the strongest few from this dream
  const roads = args.links
    .filter((l) => l.from === dream.id)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, args.maxRoads ?? 3);
  for (const r of roads) {
    if (r.toType === "work") {
      const w = works.get(r.to);
      if (!w) continue;
      const when =
        r.daysBefore === null
          ? ""
          : r.daysBefore === 0
            ? ` The dreamer ${VERB[w.kind]} it the same day as the dream.`
            : ` The dreamer ${VERB[w.kind]} it ${r.daysBefore} day${r.daysBefore === 1 ? "" : "s"} before the dream.`;
      const rating = w.rating ? ` They rated it ${w.rating} out of 5.` : "";
      const notIn = dream.symbols.filter((s) => !w.symbols.includes(s));
      items.push({
        id: `road:${r.to}`,
        text: `Road to ${w.title} (${w.kind}${w.creator ? ` by ${w.creator}` : ""}), strength ${r.strength}. Shared symbols (${r.shared.length}): ${r.shared.join(", ")}.${r.sharedThemes.length ? ` Shared themes: ${r.sharedThemes.join(", ")}.` : ""}${when}${rating} Dream symbols not in this work: ${notIn.join(", ") || "none"}.${r.dreamerMentioned ? " The dreamer named this work themselves while recording the dream." : ""}`,
      });
    } else {
      const d = dreams.get(r.to);
      items.push({
        id: `road:${r.to}`,
        text: `Recurring: this dream shares ${r.shared.join(", ")} with an earlier dream on ${d?.date ?? "an earlier date"} ("${d?.summary ?? ""}").`,
      });
    }
  }

  // Labels and DreamBank rates for this dream's symbols
  for (const s of dream.symbols) {
    const st = stats.get(s);
    if (st) items.push({ id: `label:${s}`, text: `${s} is labelled ${st.label.replace("_", " ")}. ${explainStat(st)}` });
    if (!baseRates.placeholder && s in baseRates.rates) {
      items.push({
        id: `db:${s}`,
        text: `In a sample of ${baseRates.n} DreamBank reports, ${Math.round(baseRates.rates[s] * 100)}% mention ${s} (approximate, keyword-based).`,
      });
    }
  }

  // Typical dreams: how many people have ever had this kind of dream (Typical Dreams Questionnaire).
  // Sensitive items stay tagged on the dream but are not handed to the insight writer.
  const typical = byPrevalence(dream.typicalDreams ?? []).filter((t) => !t.sensitive).slice(0, 3);
  for (const t of typical) {
    items.push({
      id: `typical:${t.id}`,
      text: `This dream includes a typical dream theme: "${t.text}". In the Typical Dreams Questionnaire, ${t.prevalence}% of ${TDQ_SOURCE.sampleSize} Canadian university students said they had ever had a dream like this (lifetime prevalence, not how often it happens per night).`,
    });
  }

  // Research cards: those the roads cite, plus a few chosen by the dream's content
  const cardIds = new Set(roads.flatMap((r) => r.researchCardIds));
  if (roads.some((r) => r.toType === "work")) cardIds.add("memory-sources-2014");
  if (roads.some((r) => works.get(r.to)?.kind === "game")) cardIds.add("gaming-2012");
  if (["anger", "apprehension", "sadness", "confusion"].includes(dream.primaryEmotion)) cardIds.add("hvdc-norms");
  if (roads.length === 0) cardIds.add("continuity-schredl");
  if (typical.length) cardIds.add(TDQ_SOURCE.cardId);
  for (const id of cardIds) {
    const c = cards.get(id);
    if (c && !c.tags.includes("method")) items.push({ id: `card:${c.id}`, text: `${c.claim} (${c.citation}; confidence: ${c.confidence})` });
  }

  const numbers = new Set(items.flatMap((i) => numbersIn(i.text)));
  return { items, ids: new Set(items.map((i) => i.id)), numbers, roads };
}

export function renderPack(pack: EvidencePack): string {
  return pack.items.map((i) => `[${i.id}] ${i.text}`).join("\n");
}
