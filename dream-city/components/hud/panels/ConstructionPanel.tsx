"use client";

import type { Recommendation } from "@/lib/types";
import { EMOTION_COLORS, EMOTION_LABELS } from "@/lib/theme";
import type { CityModel } from "@/store/cityModel";
import { WORK_ICON } from "../icons";
import { SectionTitle } from "../ui/Pixel";
import { SymbolChip } from "../ui/SymbolChip";
import { PanelFrame } from "./PanelFrame";

export function ConstructionPanel({ rec, model }: { rec: Recommendation; model: CityModel }) {
  return (
    <PanelFrame
      color="#ff9d3b"
      kicker="Construction site · unexplored edge"
      title={`${WORK_ICON[rec.kind]} ${rec.title}`}
      meta={
        <span>
          <span className="capitalize">{rec.kind}</span>
          {rec.creator && <> · {rec.creator}</>} · could open a new corner of{" "}
          <span style={{ color: EMOTION_COLORS[rec.primaryEmotion] }}>{EMOTION_LABELS[rec.primaryEmotion]}</span>
        </span>
      }
    >
      <section>
        <SectionTitle>Which of your patterns led here</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {rec.viaSymbols.map((s) => (
            <SymbolChip key={s} symbol={s} stat={model.stats.get(s)} highlight />
          ))}
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-ink">{rec.reason}</p>
      </section>
      <section>
        <SectionTitle>Its symbols &amp; themes</SectionTitle>
        <p className="text-[13px] capitalize text-ink-dim">{rec.symbols.join(" · ")}</p>
        <p className="mt-1 text-[13px] text-ink-faint">{rec.themes.map((t) => `#${t}`).join(" ")}</p>
      </section>
      <section className="border-2 border-dashed border-[#ff9d3b]/60 p-3">
        <p className="text-[14px] leading-relaxed text-ink-dim">
          A suggestion for something new to explore, built from your recurring symbols. Not a prediction about what you will dream.
        </p>
      </section>
    </PanelFrame>
  );
}
