"use client";

import { EMOTION_COLORS, EMOTION_LABELS } from "@/lib/theme";
import type { Emotion } from "@/lib/types";
import type { CityModel } from "@/store/cityModel";
import { useCityStore } from "@/store/useCityStore";
import { WORK_ICON } from "../icons";
import { SectionTitle } from "../ui/Pixel";
import { PanelFrame, fmtDate } from "./PanelFrame";

/** Summary of one emotion island: its streets, dreams and works, each a jump-off point. */
export function IslandPanel({ emotion, model }: { emotion: Emotion; model: CityModel }) {
  const select = useCityStore((s) => s.select);
  const color = EMOTION_COLORS[emotion];
  const dreams = model.dreams.filter((d) => d.primaryEmotion === emotion).sort((a, b) => b.date.localeCompare(a.date));
  const works = model.works.filter((w) => w.primaryEmotion === emotion);
  const streets = model.world.streets.filter((s) => s.emotion === emotion);
  const onStreet = (id: string) => model.world.buildings.filter((b) => b.street === id && model.visible.has(b.id)).length;
  const rowClass = "pixel-focus flex w-full items-baseline gap-2 border-2 border-line bg-(--well) px-2 py-1.5 text-left hover:border-line-hi";

  return (
    <PanelFrame
      color={color}
      kicker="Island"
      title={EMOTION_LABELS[emotion]}
      meta={`${dreams.length} dream${dreams.length === 1 ? "" : "s"} · ${works.length} work${works.length === 1 ? "" : "s"}`}
    >
      {streets.length > 0 && (
        <section>
          <SectionTitle>Streets</SectionTitle>
          <ul className="flex flex-wrap gap-1.5">
            {streets.map((s) => (
              <li key={s.id} className="border-2 px-2 py-0.5 text-[13px]" style={{ borderColor: color, color }}>
                {s.name} <span className="text-ink-faint">· {onStreet(s.id)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <SectionTitle>Dreams</SectionTitle>
        {dreams.length === 0 ? (
          <p className="text-[13px] text-ink-faint">No dreams here yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {dreams.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => select({ kind: "dream", id: d.id })} className={rowClass}>
                  <span className="w-12 shrink-0 font-display text-[10px] uppercase text-ink-faint">{fmtDate(d.date)}</span>
                  <span className="min-w-0 flex-1 text-[14px] leading-snug text-ink">{d.summary}</span>
                  <span className="shrink-0 text-[12px]" style={{ color }}>
                    {d.microEmotion}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {works.length > 0 && (
        <section>
          <SectionTitle>Library</SectionTitle>
          <ul className="space-y-1.5">
            {works.map((w) => (
              <li key={w.id}>
                <button type="button" onClick={() => select({ kind: "work", id: w.id })} className={rowClass}>
                  <span className="w-5 shrink-0 text-center text-ink-dim">{WORK_ICON[w.kind]}</span>
                  <span className="min-w-0 flex-1 text-[14px] leading-snug text-ink">{w.title}</span>
                  {w.creator && <span className="shrink-0 truncate text-[12px] text-ink-faint">{w.creator}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PanelFrame>
  );
}
