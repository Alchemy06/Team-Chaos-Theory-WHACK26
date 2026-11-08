"use client";

import type { ReactNode } from "react";
import { STRONG_STRENGTH, WEAK_STRENGTH } from "@/lib/link";
import type { Link } from "@/lib/types";
import { VOCAB } from "@/lib/vocab";
import { CitedText } from "../ui/CitedText";

/** Highlights the keywords of shared symbols inside a text. */
export function Highlighted({ text, symbols }: { text: string; symbols: string[] }) {
  const words = symbols.flatMap((s) => VOCAB.symbols[s] ?? [s]).filter(Boolean);
  if (!words.length || !text) return <>{text}</>;
  const re = new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index));
    out.push(
      <mark key={m.index} className="bg-[#3b2c0a] px-0.5 text-gold">
        {m[0]}
      </mark>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

export function LinkCard({ link, title, sub, icon, onOpen, otherText }: { link: Link; title: string; sub: string; icon: string; onOpen: () => void; otherText?: string }) {
  // Same words as the map key: strong, recurring, weaker (dashed); anything in between is moderate.
  const tag = link.strength >= STRONG_STRENGTH ? "strong" : link.toType === "dream" ? "recurring" : link.strength < WEAK_STRENGTH ? "weaker" : "moderate";
  return (
    <div className="border-2 border-line bg-(--well)">
      <button type="button" onClick={onOpen} className="pixel-focus flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-(--hover)">
        <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-line-hi bg-panel-2 text-gold">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-ink">{title}</span>
          <span className="block truncate font-display text-[9px] uppercase tracking-wider text-ink-faint">{sub}</span>
        </span>
        <span className="text-right">
          <span className="block font-display text-[11px] text-gold">{Math.round(link.strength * 100)}%</span>
          <span className="block font-display text-[8px] uppercase tracking-wider text-ink-faint">{tag}</span>
        </span>
      </button>
      <div className="space-y-2 border-t-2 border-line px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {link.shared.map((s) => (
            <span key={s} className="border border-[#7a5a1a] bg-[#2a1f06] px-1.5 text-[12px] capitalize text-gold">
              {s}
            </span>
          ))}
          {link.sharedThemes.map((t) => (
            <span key={t} className="border border-line px-1.5 text-[12px] text-ink-dim">
              #{t}
            </span>
          ))}
        </div>
        <p className="text-[13px] leading-snug text-ink-dim">{link.explanation}</p>
        {otherText && (
          <p className="border-l-2 border-line pl-2 text-[13px] italic leading-snug text-ink-faint">
            <Highlighted text={otherText} symbols={link.shared} />
          </p>
        )}
        {link.researchCardIds.length > 0 && (
          <CitedText className="text-[12px] text-ink-faint" text={`Evidence: ${link.researchCardIds.map((c) => `[card:${c}]`).join(" ")}`} />
        )}
      </div>
    </div>
  );
}
