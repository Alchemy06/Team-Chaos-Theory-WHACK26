"use client";

import { useCity } from "@/store/useCity";
import { cards } from "@/store/cityModel";
import { useCityStore } from "@/store/useCityStore";
import { TDQ_SOURCE, TYPICAL_BY_ID } from "@/lib/typicalDreams";

const chip = "pixel-focus mx-0.5 inline-flex -translate-y-px items-center border-2 px-1 align-middle font-display text-[9px] uppercase leading-[14px] tracking-wider";

/**
 * Renders backend insight text. Citations look like [card:media-2018],
 * [road:w01], [road:media:<id>], [label:water], [db:water], [typical:tdq-01] or [dream] (see lib/prompts.ts).
 */
export function CitedText({ text, className }: { text: string; className?: string }) {
  const openCitation = useCityStore((s) => s.openCitation);
  const select = useCityStore((s) => s.select);
  const { workById, dreamById } = useCity();
  const media = useCityStore((s) => s.userWorks); // logged media: links to these are listed, not drawn as buildings
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <p className={className ?? "text-[15px] leading-relaxed text-ink"}>
      {parts.map((part, i) => {
        const m = part.match(/^\[(card|road|label|db|dream|typical)(?::([a-z0-9_:-]+))?\]$/i);
        if (!m) return <span key={i}>{part}</span>;
        const [, kind, id = ""] = m;
        if (kind === "dream") return null;
        if (kind === "card") {
          const card = cards.get(id);
          return (
            <button key={i} type="button" onClick={() => openCitation(id)} title={card?.claim} className={`${chip} border-[#7a5a1a] bg-[#2a1f06] text-gold hover:bg-[#3b2c0a]`}>
              {id}
            </button>
          );
        }
        if (kind === "typical") {
          const t = TYPICAL_BY_ID.get(id);
          return (
            <button
              key={i}
              type="button"
              onClick={() => openCitation(TDQ_SOURCE.cardId)}
              title={t ? `${t.prevalence}% of students have ever had this dream (Typical Dreams Questionnaire)` : undefined}
              className={`${chip} border-[#7a5a1a] bg-[#2a1f06] text-gold hover:bg-[#3b2c0a]`}
            >
              typical · {t?.label ?? id}
            </button>
          );
        }
        if (kind === "road" && id.startsWith("media:") && !workById.has(id)) {
          const w = media.find((x) => x.id === id);
          return (
            <span key={i} title={w ? `${w.kind}${w.creator ? ` · ${w.creator}` : ""}` : undefined} className={`${chip} border-line-hi bg-panel-2 text-ink`}>
              link · {w?.title ?? "your media"}
            </span>
          );
        }
        if (kind === "road") {
          const w = workById.get(id);
          const d = dreamById.get(id);
          return (
            <button
              key={i}
              type="button"
              onClick={() => select(w ? { kind: "work", id } : { kind: "dream", id })}
              className={`${chip} border-line-hi bg-panel-2 text-ink hover:bg-(--btn-hover)`}
            >
              link · {w?.title ?? (d ? "earlier dream" : id)}
            </button>
          );
        }
        if (kind === "label")
          return (
            <button key={i} type="button" onClick={() => select({ kind: "landmark", id })} className={`${chip} border-[var(--yours)] bg-[#2a1030] text-[var(--yours)]`}>
              label · {id}
            </button>
          );
        return (
          <span key={i} title="Approximate rate from DreamBank reports" className={`${chip} border-[var(--common)] text-[var(--common)]`}>
            dreambank · {id}
          </span>
        );
      })}
    </p>
  );
}
