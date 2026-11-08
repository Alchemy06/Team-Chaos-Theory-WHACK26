"use client";

import type { Work } from "@/lib/types";
import { EMOTION_COLORS, EMOTION_LABELS } from "@/lib/theme";
import type { CityModel } from "@/store/cityModel";
import { useCityStore } from "@/store/useCityStore";
import { WORK_ICON } from "../icons";
import { BlockMeter, SectionTitle } from "../ui/Pixel";
import { SymbolChip } from "../ui/SymbolChip";
import { LinkCard } from "./LinkCard";
import { PanelFrame, fmtDate } from "./PanelFrame";

const VERB = { book: "Finished", film: "Watched", song: "Listened", game: "Played" } as const;

export function WorkPanel({ work, model }: { work: Work; model: CityModel }) {
  const select = useCityStore((s) => s.select);
  const links = model.links.filter((l) => l.to === work.id).sort((a, b) => b.strength - a.strength);
  const color = EMOTION_COLORS[work.primaryEmotion];
  return (
    <PanelFrame
      color={color}
      kicker={`Library building · ${EMOTION_LABELS[work.primaryEmotion]}`}
      title={`${WORK_ICON[work.kind]} ${work.title}`}
      meta={
        <span>
          <span className="capitalize">{work.kind}</span>
          {work.creator && <> · {work.creator}</>}
          {work.consumedOn && (
            <>
              {" "}
              · {VERB[work.kind]} {fmtDate(work.consumedOn)}
            </>
          )}
        </span>
      }
    >
      {work.userNote && (
        <section>
          <SectionTitle>Your note</SectionTitle>
          <p className="border-l-2 border-gold pl-3 text-[15px] italic leading-relaxed text-ink">“{work.userNote}”</p>
        </section>
      )}
      {work.rating && (
        <section>
          <SectionTitle aside={<span className="font-display text-[11px] text-ink-dim">{work.rating}/5</span>}>Your rating · involvement</SectionTitle>
          <BlockMeter value={work.rating} max={5} color={color} label="Rating" />
        </section>
      )}
      <section>
        <SectionTitle>Symbols &amp; themes</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {work.symbols.map((s) => (
            <SymbolChip key={s} symbol={s} stat={model.stats.get(s)} />
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-dim">{work.themes.map((t) => `#${t}`).join(" ")}</p>
      </section>
      <section>
        <SectionTitle aside={<span className="font-display text-[11px] text-gold">{links.length}</span>}>Dreams linked by road</SectionTitle>
        {links.length === 0 ? (
          <p className="text-[13px] text-ink-dim">No dream shares enough with this yet.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => {
              const d = model.dreamById.get(l.from);
              if (!d) return null;
              return (
                <li key={l.from}>
                  <LinkCard
                    link={l}
                    title={d.summary}
                    icon="☾"
                    sub={`${fmtDate(d.date)} · ${EMOTION_LABELS[d.primaryEmotion]}`}
                    onOpen={() => select({ kind: "dream", id: d.id })}
                    otherText={d.transcript}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PanelFrame>
  );
}
