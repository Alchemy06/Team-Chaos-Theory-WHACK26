"use client";

import { cards } from "@/store/cityModel";
import { useCityStore } from "@/store/useCityStore";
import { PixelPanel } from "./ui/Pixel";

export function CitationPopover() {
  const id = useCityStore((s) => s.citation);
  const close = useCityStore((s) => s.openCitation);
  const card = id ? cards.get(id) : null;
  if (!card) return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-(--overlay)/60 p-4" onClick={() => close(null)}>
      <PixelPanel className="anim-rise w-full max-w-md">
        <div role="dialog" aria-modal="true" aria-labelledby="card-title" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b-2 border-line px-4 py-2">
            <span id="card-title" className="font-display text-[11px] uppercase tracking-[0.14em] text-gold">
              Research card · {card.id}
            </span>
            <button type="button" onClick={() => close(null)} className="pixel-btn grid h-7 w-7 place-items-center font-display text-[10px]" aria-label="Close">
              ✕
            </button>
          </div>
          <div className="space-y-3 px-4 py-4">
            <p className="text-[17px] leading-relaxed text-ink">{card.claim}</p>
            <a href={card.url} target="_blank" rel="noreferrer" className="pixel-focus block text-[13px] text-ink-dim underline decoration-dotted underline-offset-2 hover:text-gold">
              {card.citation} ↗
            </a>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pixel-chip px-1.5 font-display text-[9px] uppercase leading-[16px] tracking-wider text-[var(--emo-confusion)]">{card.confidence}</span>
              {card.tags.map((t) => (
                <span key={t} className="text-[12px] text-ink-faint">
                  #{t}
                </span>
              ))}
            </div>
            <p className="border-t-2 border-line pt-3 text-[12px] leading-snug text-ink-faint">
              The insight writer may only make research claims that come from cards like this one, and must cite the card id.
            </p>
          </div>
        </div>
      </PixelPanel>
    </div>
  );
}
