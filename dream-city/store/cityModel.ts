// Derives everything the UI shows from the data, using the backend's own
// logic (computeLinks, symbolStats, layoutCity). Memoised at module level so
// the 3D world and the HUD share one computation.

import baseRatesJson from "@/data/baseRates.json";
import cardsJson from "@/data/researchCards.json";
import demoJson from "@/data/demoCity.json";
import { symbolStats } from "@/lib/honesty";
import { layoutCity } from "@/lib/layout";
import { computeLinks } from "@/lib/link";
import type { DemoCity, Dream, Link, Recommendation, ResearchCard, SymbolStat, Work } from "@/lib/types";
import { STREETS } from "@/lib/vocab";
import { toWorldCity, type WorldCity } from "@/components/world/cityGeometry";
import type { StoredInsight } from "./useCityStore";

export const demo = demoJson as unknown as DemoCity;
export const baseRates = baseRatesJson as { placeholder: boolean; note: string; n: number; rates: Record<string, number> };
export const cards = new Map((cardsJson as ResearchCard[]).map((c) => [c.id, c]));

const DAY = 86_400_000;
export const TIMELINE_START = [...demo.dreams].map((d) => d.date).sort()[0];
export const TIMELINE_DAYS = Math.round((Date.parse(demo.now) - Date.parse(TIMELINE_START)) / DAY);
export const dayToDate = (day: number) => new Date(Date.parse(TIMELINE_START) + day * DAY).toISOString().slice(0, 10);

export type CityModel = {
  world: WorldCity;
  dreams: Dream[]; // visible at the current timeline position
  works: Work[];
  allDreams: Dream[];
  allWorks: Work[];
  links: Link[];
  stats: Map<string, SymbolStat>;
  statsList: SymbolStat[];
  visible: Set<string>;
  dreamById: Map<string, Dream>;
  workById: Map<string, Work>;
  recById: Map<string, Recommendation>;
};

let cache: { userDreams: Dream[]; day: number | null; insights: Record<string, StoredInsight>; model: CityModel } | null = null;

export function computeModel(userDreams: Dream[], day: number | null, insights: Record<string, StoredInsight>): CityModel {
  if (cache && cache.userDreams === userDreams && cache.day === day && cache.insights === insights) return cache.model;

  const allDreams = [...demo.dreams, ...userDreams].map((d) => (insights[d.id] && !d.insight ? { ...d, insight: insights[d.id].text } : d));
  const allWorks = demo.works;
  const cutoff = day === null ? null : dayToDate(day);
  const dreams = cutoff ? allDreams.filter((d) => d.date <= cutoff) : allDreams;
  const works = cutoff ? allWorks.filter((w) => !w.consumedOn || w.consumedOn <= cutoff) : allWorks;

  const links = computeLinks(dreams, works);
  const statsList = symbolStats(dreams, baseRates.rates);
  const latest = allDreams.reduce((m, d) => (d.date > m ? d.date : m), demo.now);
  // Layout uses every dream and work so positions stay put while the timeline scrubs.
  const city = layoutCity(allDreams, allWorks, links, STREETS, {
    now: Date.parse(cutoff ?? latest),
    symbolStats: statsList,
    recommendations: demo.recommendations,
  });
  const dreamById = new Map(allDreams.map((d) => [d.id, d]));
  const workById = new Map(allWorks.map((w) => [w.id, w]));
  const recById = new Map(demo.recommendations.map((r) => [r.id, r]));
  const world = toWorldCity(city, { dreams: dreamById, works: workById, recommendations: recById, stats: statsList });
  const visible = new Set<string>([...dreams.map((d) => d.id), ...works.map((w) => w.id), ...demo.recommendations.map((r) => r.id)]);

  const model: CityModel = {
    world,
    dreams,
    works,
    allDreams,
    allWorks,
    links,
    stats: new Map(statsList.map((s) => [s.symbol, s])),
    statsList,
    visible,
    dreamById,
    workById,
    recById,
  };
  cache = { userDreams, day, insights, model };
  return model;
}
