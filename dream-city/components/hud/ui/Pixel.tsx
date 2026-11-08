"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LABEL_TEXT } from "@/lib/honesty";
import type { HonestyLabel } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PixelPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("pixel-panel", className)}>{children}</div>;
}

export function PixelButton({ variant = "default", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "pixel-btn font-display text-[11px] uppercase tracking-wider disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "pixel-btn-primary",
        className,
      )}
    />
  );
}

export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...props} className={cx("pixel-btn grid h-10 w-10 place-items-center text-base leading-none", className)}>
      {children}
    </button>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="font-display text-[11px] uppercase tracking-[0.14em] text-ink-faint">{children}</h3>
      {aside}
    </div>
  );
}

/** A meter drawn as blocks (intensity, strength). */
export function BlockMeter({ value, max = 10, color, label }: { value: number; max?: number; color: string; label: string }) {
  const filled = Math.round(value);
  return (
    <div className="flex gap-[3px]" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="h-3 w-[9px]"
          style={{ background: i < filled ? color : "var(--input)", boxShadow: i < filled ? "inset 0 -2px 0 rgba(0,0,0,.3)" : "inset 0 0 0 1px var(--line)" }}
        />
      ))}
    </div>
  );
}

const LABEL_CLASS: Record<HonestyLabel, string> = {
  yours: "text-[var(--yours)]",
  common: "text-[var(--common)]",
  too_early: "text-[var(--early)] border-dashed",
  no_baseline: "text-[var(--early)] border-dashed",
};

export function HonestyBadge({ label, title }: { label: HonestyLabel; title?: string }) {
  return (
    <span title={title} className={cx("pixel-chip inline-flex items-center px-1.5 font-display text-[10px] uppercase leading-[16px] tracking-wider", LABEL_CLASS[label])}>
      {LABEL_TEXT[label]}
    </span>
  );
}
