"use client";

import { explainStat } from "@/lib/honesty";
import type { SymbolStat } from "@/lib/types";
import { HonestyBadge, cx } from "./Pixel";

export function SymbolChip({ symbol, stat, highlight, onClick }: { symbol: string; stat?: SymbolStat; highlight?: boolean; onClick?: () => void }) {
  const body = (
    <span
      className={cx("inline-flex items-center gap-1.5 border-2 bg-[#0a1030] py-0.5 pl-2 pr-1 text-[13px] capitalize", highlight ? "border-gold text-gold" : "border-line text-ink")}
      title={stat ? explainStat(stat) : "Not enough data yet"}
    >
      {symbol}
      {stat && <HonestyBadge label={stat.label} />}
    </span>
  );
  return onClick ? (
    <button type="button" className="pixel-focus" onClick={onClick}>
      {body}
    </button>
  ) : (
    body
  );
}
