"use client";

import { EMOTION_COLORS, EMOTION_LABELS } from "@/lib/theme";
import { EMOTION_LIST, VOCAB } from "@/lib/vocab";
import { useCity } from "@/store/useCity";
import { PixelPanel } from "./ui/Pixel";

export function DistrictLegend() {
  const model = useCity();
  return (
    <PixelPanel className="pointer-events-auto w-60 p-3">
      <div className="mb-2 font-display text-[10px] uppercase tracking-[0.14em] text-ink-faint">Districts · emotions</div>
      <ul className="space-y-1">
        {EMOTION_LIST.map((e) => (
          <li key={e} className="flex items-center gap-2 text-[13px]" title={VOCAB.emotionDefinitions[e]}>
            <span className="h-3 w-3 shrink-0" style={{ background: EMOTION_COLORS[e], boxShadow: "2px 2px 0 #02030a" }} />
            <span className="flex-1 truncate text-ink">{EMOTION_LABELS[e]}</span>
            <span className="w-4 text-right font-display text-[10px] text-ink-dim">{model.dreams.filter((d) => d.primaryEmotion === e).length}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 space-y-1 border-t-2 border-line pt-2 text-[12px] text-ink-dim">
        <div className="flex items-center gap-2">
          <span className="h-2 w-6 bg-[#ffd27a]" /> Road to a work · shared symbols
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-6 bg-[#9db2ff]" /> Recurring · dream to dream
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-6" style={{ background: "repeating-linear-gradient(90deg,#d9a75a 0 4px,transparent 4px 8px)" }} /> Weaker link
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 text-center text-[var(--yours)]">★</span> Landmark · “Yours” symbol
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 text-center text-[#ff9d3b]">?</span> Construction site
        </div>
        <p className="pt-1 text-[11px] text-ink-faint">Height = intensity · lit windows = recent</p>
      </div>
    </PixelPanel>
  );
}
