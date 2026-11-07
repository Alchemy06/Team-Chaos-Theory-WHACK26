"use client";

// Wires the data together: demo dreams and works -> roads -> honesty labels -> city layout.

import { useMemo, useState } from "react";
import demoJson from "@/data/demoCity.json";
import vocab from "@/data/vocab.json";
import baseRatesJson from "@/data/baseRates.json";
import cardsJson from "@/data/researchCards.json";
import { layoutCity } from "@/lib/layout";
import { computeLinks } from "@/lib/link";
import { symbolStats } from "@/lib/honesty";
import type { DemoCity, Emotion, ResearchCard, Selection } from "@/lib/types";
import CityView from "./CityView";
import Panel from "./Panel";

const demo = demoJson as unknown as DemoCity;
const microByEmotion = vocab.emotions as Record<Emotion, string[]>;
const baseRates = baseRatesJson as { placeholder: boolean; note: string; rates: Record<string, number> };
const cards = cardsJson as ResearchCard[];

export default function DreamCityApp() {
  const [selection, setSelection] = useState<Selection | null>(null);

  const model = useMemo(() => {
    const links = computeLinks(demo.dreams, demo.works);
    const stats = symbolStats(demo.dreams, baseRates.rates);
    const city = layoutCity(demo.dreams, demo.works, links, microByEmotion, {
      now: Date.parse(demo.now),
      symbolStats: stats,
      recommendations: demo.recommendations,
    });
    const titles: Record<string, string> = {};
    for (const d of demo.dreams) titles[d.id] = d.summary;
    for (const w of demo.works) titles[w.id] = `${w.title}${w.creator ? ` · ${w.creator}` : ""}`;
    for (const r of demo.recommendations) titles[r.id] = `Unexplored: ${r.title}`;
    return {
      links,
      city,
      titles,
      stats: new Map(stats.map((s) => [s.symbol, s])),
      dreams: new Map(demo.dreams.map((d) => [d.id, d])),
      works: new Map(demo.works.map((w) => [w.id, w])),
      recommendations: new Map(demo.recommendations.map((r) => [r.id, r])),
      cards: new Map(cards.map((c) => [c.id, c])),
    };
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#070b18] text-slate-100">
      <main className="relative flex-1">
        <header className="pointer-events-none absolute left-5 top-4 z-10">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Dream City</h1>
          <p className="text-sm text-slate-400">
            {demo.dreams.length} dreams · {demo.works.length} works · {model.links.length} roads
          </p>
        </header>
        <CityView
          city={model.city}
          titles={model.titles}
          centreLabel={demo.persona.name}
          selection={selection}
          onSelect={setSelection}
        />
      </main>
      <Panel
        selection={selection}
        onSelect={setSelection}
        persona={demo.persona}
        dreams={model.dreams}
        works={model.works}
        recommendations={model.recommendations}
        links={model.links}
        stats={model.stats}
        cards={model.cards}
        baselinePlaceholder={baseRates.placeholder}
        baselineNote={baseRates.note}
      />
    </div>
  );
}
