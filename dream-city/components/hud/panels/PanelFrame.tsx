"use client";

import type { ReactNode } from "react";
import { useCityStore } from "@/store/useCityStore";

export const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function PanelFrame({ color, kicker, title, meta, children }: { color: string; kicker: string; title: string; meta?: ReactNode; children: ReactNode }) {
  const select = useCityStore((s) => s.select);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="h-2 shrink-0" style={{ background: `repeating-linear-gradient(90deg, ${color} 0 12px, transparent 12px 16px)` }} />
      <header className="flex shrink-0 items-start gap-3 border-b-2 border-line px-5 pb-3.5 pt-4">
        <div className="min-w-0 flex-1">
          <div className="font-display text-[11px] uppercase tracking-[0.16em]" style={{ color }}>
            {kicker}
          </div>
          <h2 className="mt-1 text-xl leading-tight text-ink">{title}</h2>
          {meta && <div className="mt-1.5 text-[13px] text-ink-dim">{meta}</div>}
        </div>
        <button type="button" onClick={() => select(null)} aria-label="Close panel" className="pixel-btn grid h-8 w-8 shrink-0 place-items-center font-display text-xs">
          ✕
        </button>
      </header>
      <div className="pixel-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">{children}</div>
      <footer className="shrink-0 border-t-2 border-line px-5 py-2 font-display text-[10px] uppercase leading-relaxed tracking-wider text-ink-faint">
        Patterns, not meanings · cites dream research · never diagnoses
      </footer>
    </div>
  );
}
