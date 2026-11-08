"use client";

import { LABEL_TEXT, MIN_COUNT, YOURS_MULTIPLIER, explainStat } from "@/lib/honesty";
import { EMOTION_COLORS, EMOTION_LABELS } from "@/lib/theme";
import { baseRates, type CityModel } from "@/store/cityModel";
import { useCityStore } from "@/store/useCityStore";
import { HonestyBadge, SectionTitle } from "../ui/Pixel";
import { CitedText } from "../ui/CitedText";
import { PanelFrame, fmtDate } from "./PanelFrame";

function RateBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <span className="text-ink-dim">{label}</span>
        <span className="font-display text-[11px]" style={{ color }}>
          {(value * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-4 border-2 border-line bg-(--input)">
        <div className="h-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: `repeating-linear-gradient(90deg, ${color} 0 8px, transparent 8px 10px)` }} />
      </div>
    </div>
  );
}

export function LandmarkPanel({ symbol, model }: { symbol: string; model: CityModel }) {
  const select = useCityStore((s) => s.select);
  const stat = model.stats.get(symbol);
  if (!stat) return null;
  const dreams = model.dreams.filter((d) => d.symbols.includes(symbol));
  const works = model.works.filter((w) => w.symbols.includes(symbol));
  const max = Math.max(stat.userRate, stat.baseRate ?? 0) * 1.15 || 1;
  return (
    <PanelFrame color="var(--yours)" kicker="Landmark · recurring symbol" title={`★ ${symbol.charAt(0).toUpperCase() + symbol.slice(1)}`} meta={<HonestyBadge label={stat.label} />}>
      <section>
        <SectionTitle>How often, compared with other dreamers</SectionTitle>
        <div className="space-y-3">
          <RateBar label={`Your dreams (${stat.count} of ${model.dreams.length})`} value={stat.userRate} max={max} color="var(--yours)" />
          {stat.baseRate !== null && <RateBar label="DreamBank reports" value={stat.baseRate} max={max} color="var(--common)" />}
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-ink">{explainStat(stat)}</p>
        {baseRates.placeholder && (
          <p className="mt-2 border-2 border-dashed border-[var(--emo-happiness)]/60 p-2 text-[12px] leading-snug text-[var(--emo-happiness)]">{baseRates.note}</p>
        )}
      </section>
      <section className="border-2 border-line bg-(--well) p-3">
        <SectionTitle>Why “{LABEL_TEXT[stat.label]}”</SectionTitle>
        <p className="text-[12px] leading-relaxed text-ink-faint">
          Fewer than {MIN_COUNT} appearances → Too early; at least {YOURS_MULTIPLIER}× the DreamBank rate → Yours; otherwise Common. The {YOURS_MULTIPLIER}× threshold is a heuristic,
          not a statistical test.
        </p>
        <CitedText className="mt-2 text-[12px] text-ink-faint" text="Baseline: [card:dreambank]" />
      </section>
      <section>
        <SectionTitle>Buildings with this symbol</SectionTitle>
        <ul className="space-y-1">
          {dreams.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => select({ kind: "dream", id: d.id })} className="pixel-focus flex w-full items-center gap-2 border-2 border-transparent px-2 py-1 text-left hover:border-line">
                <span className="h-3 w-3 shrink-0" style={{ background: EMOTION_COLORS[d.primaryEmotion] }} />
                <span className="flex-1 truncate text-[14px]">{d.summary}</span>
                <span className="font-display text-[9px] uppercase text-ink-faint">{fmtDate(d.date)}</span>
              </button>
            </li>
          ))}
          {works.map((w) => (
            <li key={w.id}>
              <button type="button" onClick={() => select({ kind: "work", id: w.id })} className="pixel-focus flex w-full items-center gap-2 border-2 border-transparent px-2 py-1 text-left hover:border-line">
                <span className="h-3 w-3 shrink-0 border-2 border-gold" />
                <span className="flex-1 truncate text-[14px] text-gold">{w.title}</span>
                <span className="font-display text-[9px] uppercase text-ink-faint">{EMOTION_LABELS[w.primaryEmotion]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-[13px] italic text-ink-faint">We never say what {symbol} “means”, only how often it shows up and where.</p>
    </PanelFrame>
  );
}
