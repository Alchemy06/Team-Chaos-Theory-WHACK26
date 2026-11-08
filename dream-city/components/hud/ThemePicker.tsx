"use client";

import { THEMES } from "@/lib/themes";
import { useThemeStore } from "@/store/useTheme";
import { cx } from "./ui/Pixel";

/** Theme choices for the settings menu: a swatch strip and a name for each. */
export function ThemePicker() {
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-1.5">
      {THEMES.map((t) => {
        const on = t.id === themeId;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={t.blurb}
            onClick={() => setTheme(t.id)}
            className={cx(
              "pixel-focus border-2 p-1.5 text-left text-[12px] leading-tight",
              on ? "border-gold text-gold" : "border-line text-ink-dim hover:border-line-hi hover:text-ink",
            )}
          >
            <span className="mb-1 flex h-3" aria-hidden>
              {t.swatch.map((c) => (
                <span key={c} className="flex-1" style={{ background: c }} />
              ))}
            </span>
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
