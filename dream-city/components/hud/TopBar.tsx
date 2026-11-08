"use client";

import { useState } from "react";
import { useCity } from "@/store/useCity";
import { useCityStore, type Settings } from "@/store/useCityStore";
import { AddMediaButton } from "./AddMediaSheet";
import { DistrictLegend } from "./DistrictLegend";
import { ThemePicker } from "./ThemePicker";
import { IconButton, PixelPanel, cx } from "./ui/Pixel";

const SETTING_LABELS: Record<keyof Settings, string> = {
  pixelation: "Pixel filter",
  bloom: "Glow (bloom)",
  labels: "Map labels",
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 14 14" shapeRendering="crispEdges" aria-hidden>
        <rect x="3" y="1" width="6" height="2" fill="#ffe08a" />
        <rect x="1" y="3" width="4" height="6" fill="#ffe08a" />
        <rect x="3" y="9" width="6" height="2" fill="#ffe08a" />
        <rect x="9" y="3" width="2" height="5" fill="#9d7bff" />
        <rect x="11" y="5" width="2" height="8" fill="#ec6fe0" />
        <rect x="6" y="6" width="2" height="7" fill="#3d8bff" />
      </svg>
      <div>
        <div className="whitespace-nowrap font-display text-[13px] font-bold uppercase leading-none tracking-[0.12em] text-ink sm:text-[15px]">Dream City</div>
        <div className="mt-1 hidden whitespace-nowrap font-display text-[8px] uppercase tracking-[0.2em] text-ink-faint sm:block">A map of your mind</div>
      </div>
    </div>
  );
}

export function TopBar() {
  const model = useCity();
  const settings = useCityStore((s) => s.settings);
  const toggle = useCityStore((s) => s.toggleSetting);
  const select = useCityStore((s) => s.select);
  const resetCamera = useCityStore((s) => s.resetCamera);
  const plazaOpen = useCityStore((s) => s.selection?.kind === "plaza");
  const [menu, setMenu] = useState<"settings" | "legend" | null>(null);

  return (
    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
      <div className="flex items-stretch gap-2">
      <PixelPanel className="pointer-events-auto flex items-center gap-4 px-3 py-2">
        <Logo />
        <div className="hidden border-l-2 border-line pl-4 sm:block">
          <div className="text-[14px] leading-tight text-ink">Saved dream city</div>
          <div className="text-[12px] leading-tight text-ink-dim">
            {model.dreams.length} dreams · {model.works.length} works · {model.links.length} roads
          </div>
        </div>
      </PixelPanel>
      <AddMediaButton />
      </div>

      <div className="pointer-events-auto relative flex gap-2">
        <IconButton label="City-wide insights" aria-pressed={plazaOpen} onClick={() => select(plazaOpen ? null : { kind: "plaza" })}>
          ✦
        </IconButton>
        <IconButton label="Districts" className="lg:hidden" aria-pressed={menu === "legend"} onClick={() => setMenu(menu === "legend" ? null : "legend")}>
          ◧
        </IconButton>
        <IconButton label="Reset view" onClick={resetCamera}>
          ⌖
        </IconButton>
        <IconButton label="Settings" aria-pressed={menu === "settings"} onClick={() => setMenu(menu === "settings" ? null : "settings")}>
          ⚙
        </IconButton>
        {menu === "legend" && (
          <div className="anim-rise absolute right-0 top-12 z-40 lg:hidden">
            <DistrictLegend />
          </div>
        )}
        {menu === "settings" && (
          <PixelPanel className="anim-rise absolute right-0 top-12 z-40 w-64 p-3">
            <div className="mb-2 font-display text-[10px] uppercase tracking-[0.14em] text-ink-faint">Theme</div>
            <ThemePicker />
            <div className="mb-2 mt-3 font-display text-[10px] uppercase tracking-[0.14em] text-ink-faint">Settings</div>
            <ul className="space-y-1">
              {(Object.keys(SETTING_LABELS) as (keyof Settings)[]).map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings[k]}
                    onClick={() => toggle(k)}
                    className="pixel-focus flex w-full items-center justify-between px-1 py-1.5 text-left text-[14px] hover:bg-(--hover)"
                  >
                    {SETTING_LABELS[k]}
                    <span className={cx("h-4 w-8 border-2", settings[k] ? "border-gold bg-gold/30" : "border-line bg-(--input)")}>
                      <span className={cx("block h-full w-3 transition-transform", settings[k] ? "translate-x-[14px] bg-gold" : "bg-line-hi")} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] leading-snug text-ink-faint">Turn off the pixel filter and glow on slower laptops.</p>

          </PixelPanel>
        )}
      </div>
    </div>
  );
}
