"use client";

import { useEffect, useMemo } from "react";
import { computeLinks } from "@/lib/link";
import type { Dream } from "@/lib/types";
import { EMOTION_COLORS, EMOTION_LABELS } from "@/lib/theme";
import type { CityModel } from "@/store/cityModel";
import { useCityStore } from "@/store/useCityStore";
import { WORK_ICON } from "../icons";
import { BlockMeter, PixelButton, SectionTitle } from "../ui/Pixel";
import { CitedText } from "../ui/CitedText";
import { SymbolChip } from "../ui/SymbolChip";
import { Highlighted, LinkCard } from "./LinkCard";
import { PanelFrame, fmtDate } from "./PanelFrame";

export function DreamPanel({ dream, model }: { dream: Dream; model: CityModel }) {
  const select = useCityStore((s) => s.select);
  const requestInsight = useCityStore((s) => s.requestInsight);
  const loading = useCityStore((s) => !!s.insightLoading[dream.id]);
  const source = useCityStore((s) => s.insights[dream.id]?.source);
  const color = EMOTION_COLORS[dream.primaryEmotion];
  const links = model.links.filter((l) => l.from === dream.id || l.to === dream.id).sort((a, b) => b.strength - a.strength);
  const shared = [...new Set(links.flatMap((l) => l.shared))];
  const landmarks = new Set(model.world.landmarks.map((l) => l.symbol));

  // Ask the backend for an insight the first time a dream without one is opened.
  useEffect(() => {
    if (!dream.insight) void requestInsight(dream.id);
  }, [dream.id, dream.insight, requestInsight]);

  return (
    <PanelFrame
      color={color}
      kicker={`${EMOTION_LABELS[dream.primaryEmotion]} district · ${dream.microEmotion}`}
      title={dream.summary}
      meta={
        <span>
          {fmtDate(dream.date)}
          {dream.hvdcEmotion && dream.hvdcEmotion !== dream.primaryEmotion && <> · coded as {dream.hvdcEmotion} (Hall &amp; Van de Castle)</>}
          {!dream.emotionStated && <> · feeling not stated</>}
        </span>
      }
    >
      <section>
        <SectionTitle aside={<span className="font-display text-[10px] text-ink-dim">{dream.intensity}/10 · {dream.intensitySource === "self" ? "self-rated" : "AI estimate"}</span>}>
          Intensity · building height
        </SectionTitle>
        <BlockMeter value={dream.intensity} color={color} label="Emotional intensity" />
      </section>

      <section>
        <SectionTitle aside={source === "fallback" ? <span className="font-display text-[9px] uppercase text-ink-faint">template</span> : undefined}>Insight</SectionTitle>
        <div className="border-2 border-line bg-(--well) p-3">
          {dream.insight ? (
            <CitedText text={dream.insight} />
          ) : loading ? (
            <p className="animate-pulse text-[14px] text-ink-dim">Gathering evidence and writing a cited insight…</p>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] text-ink-dim">No insight yet.</p>
              <PixelButton className="px-2 py-1" onClick={() => void requestInsight(dream.id)}>
                Generate
              </PixelButton>
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Symbols</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {dream.symbols.map((s) => (
            <SymbolChip
              key={s}
              symbol={s}
              stat={model.stats.get(s)}
              highlight={shared.includes(s)}
              onClick={landmarks.has(s) ? () => select({ kind: "landmark", id: s }) : undefined}
            />
          ))}
        </div>
        {(dream.places.length > 0 || dream.themes.length > 0) && (
          <p className="mt-2 text-[13px] text-ink-dim">
            {dream.places.length > 0 && <>Places: {dream.places.join(", ")}. </>}
            {dream.themes.length > 0 && <>Themes: {dream.themes.map((t) => `#${t}`).join(" ")}</>}
          </p>
        )}
      </section>

      <section>
        <SectionTitle>Links from this building</SectionTitle>
        {links.length === 0 ? (
          <p className="text-[13px] text-ink-dim">No link is strong enough to draw yet.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => {
              const otherId = l.from === dream.id ? l.to : l.from;
              const work = model.workById.get(otherId);
              const other = model.dreamById.get(otherId);
              return (
                <li key={`${l.from}-${l.to}`}>
                  <LinkCard
                    link={l}
                    title={work ? work.title : (other?.summary ?? otherId)}
                    icon={work ? WORK_ICON[work.kind] : "☾"}
                    sub={work ? `${work.kind}${work.creator ? " · " + work.creator : ""}` : other ? `Dream · ${fmtDate(other.date)}` : ""}
                    onOpen={() => select(work ? { kind: "work", id: otherId } : { kind: "dream", id: otherId })}
                    otherText={work?.userNote ?? other?.transcript}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <RelatedMedia dream={dream} />

      <section>
        <SectionTitle>Transcript</SectionTitle>
        <p className="text-[15px] leading-relaxed text-ink-dim">
          <Highlighted text={dream.transcript} symbols={shared} />
        </p>
        {dream.followUps.length > 0 && (
          <dl className="mt-3 space-y-2 border-l-2 border-line pl-3">
            {dream.followUps.map((f, i) => (
              <div key={i}>
                <dt className="text-[13px] text-ink-faint">{f.q}</dt>
                <dd className="text-[14px] text-ink">{f.a || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </PanelFrame>
  );
}

// Media from the + Media form that shares themes (and maybe the feeling) with this dream.
// Same scoring as the roads (lib/link.ts), but listed here instead of drawn as buildings.
function RelatedMedia({ dream }: { dream: Dream }) {
  const media = useCityStore((s) => s.userWorks);
  const related = useMemo(() => {
    const byId = new Map(media.map((m) => [m.id, m]));
    return computeLinks([dream], media, { maxWorksPerDream: 5, maxDreamsPerDream: 0 })
      .filter((l) => l.toType === "work")
      .map((l) => ({ link: l, work: byId.get(l.to)! }));
  }, [dream, media]);

  return (
    <section>
      <SectionTitle>Related media</SectionTitle>
      {related.length === 0 ? (
        <p className="text-[13px] text-ink-dim">
          {media.length === 0 ? "Add films, books or songs with + Media to see links here." : "Nothing you logged before this dream shares its themes yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {related.map(({ link, work }) => (
            <li key={work.id} className="border-2 border-line bg-[#0a1030] px-3 py-2">
              <div className="flex items-baseline gap-2 text-[14px] text-ink">
                <span aria-hidden>{WORK_ICON[work.kind]}</span>
                <span className="truncate">{work.title}</span>
                <span className="ml-auto shrink-0 font-display text-[10px] text-ink-faint">{Math.round(link.strength * 100)}%</span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-ink-dim">{link.explanation}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
