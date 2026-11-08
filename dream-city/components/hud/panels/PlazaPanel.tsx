"use client";

import { EMOTION_LIST } from "@/lib/vocab";
import { EMOTION_COLORS, EMOTION_LABELS } from "@/lib/theme";
import { baseRates, cards, type CityModel } from "@/store/cityModel";
import { useCityStore } from "@/store/useCityStore";
import { HonestyBadge, SectionTitle } from "../ui/Pixel";
import { PanelFrame } from "./PanelFrame";

export function PlazaPanel({ model }: { model: CityModel }) {
  const select = useCityStore((s) => s.select);
  const openCitation = useCityStore((s) => s.openCitation);
  const counts = EMOTION_LIST.map((e) => ({ e, n: model.dreams.filter((d) => d.primaryEmotion === e).length })).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...counts.map((c) => c.n));
  const sorted = [...model.dreams].sort((a, b) => a.date.localeCompare(b.date));
  const half = Math.ceil(sorted.length / 2);
  const shift = EMOTION_LIST.map((e) => ({
    e,
    a: sorted.slice(0, half).filter((d) => d.primaryEmotion === e).length,
    b: sorted.slice(half).filter((d) => d.primaryEmotion === e).length,
  })).filter((x) => x.a + x.b > 0);
  const symbols = model.statsList.filter((s) => s.count >= 2).slice(0, 12);
  const landmarks = new Set(model.world.landmarks.map((l) => l.symbol));
  const boulevard = model.world.boulevard;

  return (
    <PanelFrame color="#c9a8ff" kicker="The Plaza · the whole city" title="Your dream city" meta="Built from every dream in your journal.">
      <p className="font-display text-[10px] uppercase tracking-wider text-ink-dim">
        {model.dreams.length} dreams · {model.works.length} works · {model.links.length} links
      </p>
      <section>
        <SectionTitle>Biggest islands</SectionTitle>
        <ul className="space-y-1.5">
          {counts.map(({ e, n }) => (
            <li key={e} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-[13px]" style={{ color: EMOTION_COLORS[e] }}>
                {EMOTION_LABELS[e]}
              </span>
              <span className="h-3 flex-1 bg-(--input)">
                <span className="block h-full" style={{ width: `${(n / max) * 100}%`, background: `repeating-linear-gradient(90deg, ${EMOTION_COLORS[e]} 0 8px, transparent 8px 10px)` }} />
              </span>
              <span className="w-5 text-right font-display text-[11px] text-ink-dim">{n}</span>
            </li>
          ))}
        </ul>
      </section>
      {boulevard && (
        <section className="border-2 border-[#7a5a1a] bg-[#1a1404] p-3">
          <SectionTitle>Main boulevard</SectionTitle>
          <p className="text-[15px] text-gold">
            <span className="capitalize">{boulevard.symbol}</span> appears in {boulevard.buildingIds.length} buildings across the city.
          </p>
        </section>
      )}
      <section>
        <SectionTitle>How the city has changed</SectionTitle>
        <p className="mb-2 text-[13px] text-ink-dim">First half of your dreams vs. the second half.</p>
        <ul className="space-y-1">
          {shift.map(({ e, a, b }) => (
            <li key={e} className="flex items-center justify-between text-[14px]">
              <span style={{ color: EMOTION_COLORS[e] }}>{EMOTION_LABELS[e]}</span>
              <span className="font-display text-[11px] text-ink-dim">
                {a} → {b} {b > a ? "▲" : b < a ? "▼" : "="}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <SectionTitle>Recurring symbols · honesty labels</SectionTitle>
        {baseRates.placeholder && <p className="mb-2 text-[12px] leading-snug text-[var(--emo-happiness)]">{baseRates.note}</p>}
        <table className="w-full text-[13px]">
          <thead>
            <tr className="font-display text-[9px] uppercase tracking-wider text-ink-faint">
              <th className="pb-1 text-left font-normal">Symbol</th>
              <th className="pb-1 text-right font-normal">You</th>
              <th className="pb-1 text-right font-normal">Base</th>
              <th className="pb-1 text-right font-normal">Label</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map((s) => (
              <tr key={s.symbol} className="border-t border-line/60">
                <td className="py-1 capitalize">
                  {landmarks.has(s.symbol) ? (
                    <button type="button" className="pixel-focus underline decoration-dotted underline-offset-2" onClick={() => select({ kind: "landmark", id: s.symbol })}>
                      ★ {s.symbol}
                    </button>
                  ) : (
                    s.symbol
                  )}
                </td>
                <td className="py-1 text-right text-ink-dim">{Math.round(s.userRate * 100)}%</td>
                <td className="py-1 text-right text-ink-faint">{s.baseRate === null ? "—" : `${Math.round(s.baseRate * 100)}%`}</td>
                <td className="py-1 text-right">
                  <HonestyBadge label={s.label} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <SectionTitle>Research this city is grounded in</SectionTitle>
        <ul className="space-y-1">
          {[...cards.values()].map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => openCitation(c.id)} className="pixel-focus w-full border-2 border-transparent px-2 py-1 text-left hover:border-line">
                <span className="block font-display text-[9px] uppercase tracking-wider text-gold">{c.id}</span>
                <span className="block text-[13px] leading-snug text-ink-dim">{c.citation}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </PanelFrame>
  );
}
