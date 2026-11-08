"use client";

import { useEffect, useMemo, useState } from "react";
import { computeLinks } from "@/lib/link";
import { TDQ_SOURCE, byPrevalence } from "@/lib/typicalDreams";
import type { Dream } from "@/lib/types";
import { EMOTION_COLORS, EMOTION_LABELS, emotionLabel } from "@/lib/theme";
import type { CityModel } from "@/store/cityModel";
import { useCityStore } from "@/store/useCityStore";
import { WORK_ICON } from "../icons";
import { PixelButton, SectionTitle } from "../ui/Pixel";
import { CitedText } from "../ui/CitedText";
import { SymbolChip } from "../ui/SymbolChip";
import { Highlighted, LinkCard } from "./LinkCard";
import { PanelFrame, fmtDate } from "./PanelFrame";

// ── (ADDED) Short navigation titles; the full account stays in the journal ──
function shortTitle(text: string) {
  const prefix = text.split(":")[0].trim();
  if (text.includes(":") && prefix.length <= 65) return prefix;
  const words = text.trim().split(/\s+/);
  return words.length > 8 ? words.slice(0, 8).join(" ") + "…" : text;
}

export function DreamPanel({ dream, model }: { dream: Dream; model: CityModel }) {
  const select = useCityStore(s => s.select);
  const requestInsight = useCityStore(s => s.requestInsight);
  const openEntry = useCityStore(s => s.openEntry);
  const loading = useCityStore(s => !!s.insightLoading[dream.id]);
  const source = useCityStore(s => s.insights[dream.id]?.source);
  const [showAllLinks, setShowAllLinks] = useState(false);
  const color = EMOTION_COLORS[dream.primaryEmotion];
  const links = model.links.filter(l => l.from === dream.id || l.to === dream.id).sort((a,b) => b.strength-a.strength);
  const shared = [...new Set(links.flatMap(l => l.shared))];
  const landmarks = new Set(model.world.landmarks.map(l => l.symbol));

  useEffect(() => {
    if (!dream.insight) void requestInsight(dream.id);
  }, [dream.id, dream.insight, requestInsight]);

  return (
    <PanelFrame color={color} kicker={`${EMOTION_LABELS[dream.primaryEmotion]} · ${dream.microEmotion}`}
      title={shortTitle(dream.summary)} onTitleClick={() => openEntry(dream.id)} titleHint="Read the full journal entry"
      meta={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{fmtDate(dream.date)}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5" style={{ background: color }} />Intensity {dream.intensity}/10</span>
        {dream.secondaryEmotion && <span>Also {EMOTION_LABELS[dream.secondaryEmotion].toLowerCase()}</span>}
      </span>}>
      <div className="dream-detail">
        <section>
          <SectionTitle aside={source === "fallback" ? <span className="font-display text-[8px] text-ink-faint">Basic reflection</span> : undefined}>Your reflection</SectionTitle>
          <div className="dream-reflection" style={{ borderLeftColor: color }}>
            {dream.insight ? <CitedText text={dream.insight} className="dream-reading text-ink" />
              : loading ? <p role="status" className="dream-reading animate-pulse text-ink-dim">Gathering the threads of this dream…</p>
              : <div className="space-y-3"><p className="dream-reading text-ink-dim">Discover what connects this dream to your journal.</p>
                <PixelButton className="px-3 py-2 text-[11px]" onClick={() => void requestInsight(dream.id)}>Generate reflection</PixelButton></div>}
          </div>
          <button type="button" onClick={() => openEntry(dream.id)} className="pixel-focus mt-3 inline-flex items-center gap-2 font-display text-[9px] uppercase tracking-wider text-ink-dim hover:text-gold">Open journal <span aria-hidden>↗</span></button>
        </section>

        <section>
          <SectionTitle aside={<span className="font-display text-[9px] text-ink-faint">{links.length}</span>}>Connected dreams & media</SectionTitle>
          {links.length === 0 ? <p className="dream-reading text-ink-dim">No connections yet. This dream has its own place in your city.</p>
            : <ul className="space-y-2">{(showAllLinks ? links : links.slice(0,2)).map(l => {
              const otherId = l.from === dream.id ? l.to : l.from;
              const work = model.workById.get(otherId); const other = model.dreamById.get(otherId);
              return <li key={`${l.from}-${l.to}`}><LinkCard compact link={l}
                title={work ? work.title : shortTitle(other?.summary ?? "Another dream")}
                icon={work ? WORK_ICON[work.kind] : "☾"}
                sub={work ? work.kind : other ? `Dream · ${fmtDate(other.date)}` : "Dream"}
                onOpen={() => select(work ? { kind:"work", id:otherId } : { kind:"dream", id:otherId })}
                otherText={work?.userNote ?? other?.transcript} /></li>;
            })}</ul>}
          {links.length > 2 && <button type="button" className="pixel-focus mt-3 font-display text-[9px] uppercase tracking-wider text-ink-dim hover:text-ink" aria-expanded={showAllLinks} onClick={() => setShowAllLinks(v => !v)}>{showAllLinks ? "Show fewer connections −" : `Show all ${links.length} connections +`}</button>}
        </section>

        <section>
          <SectionTitle>Symbols & themes</SectionTitle>
          <div className="dream-symbols flex flex-wrap gap-2">{dream.symbols.map(symbol => <SymbolChip key={symbol} symbol={symbol} stat={model.stats.get(symbol)} highlight={shared.includes(symbol)} onClick={landmarks.has(symbol) ? () => select({kind:"landmark",id:symbol}) : undefined} />)}</div>
          {dream.themes.length > 0 && <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">{dream.themes.map(theme => <span key={theme} className="font-sans text-[12px] text-ink-dim">#{theme}</span>)}</div>}
          {dream.places.length > 0 && <p className="dream-reading mt-3 text-ink-faint">Places: {dream.places.join(", ")}</p>}
          {(dream.mentionedWorks?.length ?? 0) > 0 && <p className="dream-reading mt-2 text-ink-dim">You mentioned: {dream.mentionedWorks!.join(", ")}</p>}
        </section>

        <details className="dream-disclosure">
          <summary>Read original journal <span aria-hidden>+</span></summary>
          <div className="space-y-4 pt-4">
            <p className="dream-reading text-ink-dim"><Highlighted text={dream.transcript} symbols={shared} /></p>
            {dream.description && dream.description !== dream.summary && <p className="dream-reading text-ink-dim">{dream.description}</p>}
            <dl className="space-y-4">{dream.followUps.map((f,i) => <div key={i} className="border-l-2 border-line pl-3"><dt className="font-sans text-[12px] leading-relaxed text-ink-faint">{f.q}</dt><dd className="dream-reading mt-1 text-ink">{f.a || "Not answered"}</dd></div>)}</dl>
            <p className="font-sans text-[11px] text-ink-faint">Intensity: {dream.intensitySource === "self" ? "self-rated" : "AI estimate"}.
              {dream.hvdcEmotion && dream.hvdcEmotion !== dream.primaryEmotion && ` Research category: ${emotionLabel(dream.hvdcEmotion)}.`}
              {!dream.emotionStated && " Feeling was not explicitly stated."}</p>
            <PixelButton className="px-3 py-2 text-[10px]" onClick={() => openEntry(dream.id)}>View full entry →</PixelButton>
          </div>
        </details>
        <details className="dream-disclosure">
          <summary>Compare with research <span aria-hidden>+</span></summary>
          <div className="pt-4"><TypicalDreams ids={dream.typicalDreams ?? []} />{!dream.typicalDreams?.length && <p className="dream-reading text-ink-dim">No typical-dream comparison is available for this entry.</p>}</div>
        </details>
        <details className="dream-disclosure">
          <summary>Explore related media <span aria-hidden>+</span></summary>
          <div className="pt-4"><RelatedMedia dream={dream} /></div>
        </details>
      </div>
    </PanelFrame>
  );
}

// Which of the 55 Typical Dreams Questionnaire themes this dream contains, with how many people
// have ever had one (Nielsen et al. 2003). Sensitive items are listed plainly, last, with no bar.
function TypicalDreams({ ids }: { ids: string[] }) {
  const openCitation = useCityStore((s) => s.openCitation);
  const items = byPrevalence(ids).sort((a, b) => Number(a.sensitive) - Number(b.sensitive));
  if (items.length === 0) return null;
  return (
    <section>
      <SectionTitle
        aside={
          <button
            type="button"
            onClick={() => openCitation(TDQ_SOURCE.cardId)}
            className="pixel-focus border-2 border-[#7a5a1a] bg-[#2a1f06] px-1 font-display text-[9px] uppercase leading-[14px] tracking-wider text-gold hover:bg-[#3b2c0a]"
          >
            {TDQ_SOURCE.cardId}
          </button>
        }
      >
        Typical dreams
      </SectionTitle>
      <ul className="space-y-1.5">
        {items.map((t) => (
          <li key={t.id} className="border-2 border-line bg-(--well) px-2 py-1.5" title={t.text}>
            <div className="flex items-baseline gap-2 text-[14px] text-ink">
              <span className="min-w-0 flex-1 truncate">{t.label}</span>
              <span className="shrink-0 font-display text-[10px] text-ink-dim">{t.prevalence}%</span>
            </div>
            {!t.sensitive && (
              <div className="mt-1 h-1.5 w-full bg-(--input)" aria-hidden>
                <div className="h-full bg-ink-faint" style={{ width: `${t.prevalence}%` }} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">
        % of {TDQ_SOURCE.sampleSize.toLocaleString("en-GB")} university students who had ever had a dream like this. Common themes are shared by most people, so they say little on their own.
      </p>
    </section>
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
          {media.length === 0 ? "Add films, books, songs or games with + Media to see links here." : "Nothing you logged before this dream shares its themes yet."}
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
