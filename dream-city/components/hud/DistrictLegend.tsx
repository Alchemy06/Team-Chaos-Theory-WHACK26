"use client";

import type { ReactNode } from "react";
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
        <div className="mb-1 font-display text-[9px] uppercase tracking-[0.14em] text-ink-faint">Links</div>
        <KeyRow icon={<ArcIcon color="#ffd27a" />}>Dream ↔ book, film, song or game</KeyRow>
        <KeyRow icon={<ArcIcon color="#9db2ff" />}>Recurring · dream ↔ dream</KeyRow>
        <KeyRow icon={<ArcIcon color="#d9a75a" dashed />}>Weaker link</KeyRow>
        <KeyRow icon={<ArcIcon color="#ffd27a" thick />}>Strong link (thicker)</KeyRow>
        <KeyRow icon={<RingIcon />}>Main boulevard · top recurring symbol</KeyRow>
        <p className="pb-1 text-[11px] text-ink-faint">Hover or select a building to light up its links.</p>
        <div className="mb-1 mt-2 font-display text-[9px] uppercase tracking-[0.14em] text-ink-faint">Places</div>
        <KeyRow icon={<span className="text-[var(--yours)]">★</span>}>Landmark · “Yours” symbol</KeyRow>
        <KeyRow icon={<span className="text-[#ff9d3b]">?</span>}>Construction site</KeyRow>
        <p className="pt-1 text-[11px] text-ink-faint">Height = intensity · lit windows = recent</p>
      </div>
    </PixelPanel>
  );
}

function KeyRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid w-7 shrink-0 place-items-center">{icon}</span>
      <span className="leading-tight">{children}</span>
    </div>
  );
}

/** A small raised arc, matching how links are drawn over the city. */
function ArcIcon({ color, dashed, thick }: { color: string; dashed?: boolean; thick?: boolean }) {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden>
      <path d="M2 11 Q13 -3 24 11" fill="none" stroke={color} strokeWidth={thick ? 2.6 : 1.4} strokeLinecap="round" strokeDasharray={dashed ? "3 3" : undefined} />
    </svg>
  );
}

function RingIcon() {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden>
      <ellipse cx="13" cy="6" rx="11" ry="4.5" fill="none" stroke="#ffd27a" strokeWidth="2" />
    </svg>
  );
}
