"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { EMOTION_COLORS, EMOTION_LABELS } from "@/lib/theme";
import { EMOTION_LIST, VOCAB } from "@/lib/vocab";
import { useCity } from "@/store/useCity";
import { useCityStore } from "@/store/useCityStore";
import { PixelPanel, cx } from "./ui/Pixel";

// Whether the full key is open: a per-viewer convenience kept in localStorage.
// Read through useSyncExternalStore so the server render (always collapsed) matches.
const OPEN_KEY = "dream-city-key-open";
const listeners = new Set<() => void>();
const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
};
const writeOpen = (open: boolean) => {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // storage blocked: the toggle still works until reload
  }
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/**
 * The map key. With `collapsible` it starts slim (just the emotion islands)
 * and expands on demand; it always stays slim while something is selected so
 * it never crowds the focused view. Each emotion jumps to its island.
 */
export function DistrictLegend({ collapsible = false }: { collapsible?: boolean }) {
  const model = useCity();
  const select = useCityStore((s) => s.select);
  const focusedIsland = useCityStore((s) => (s.selection?.kind === "island" ? s.selection.id : null));
  const hasSelection = useCityStore((s) => s.selection !== null);
  const savedOpen = useSyncExternalStore(subscribe, readOpen, () => false);
  const open = !collapsible || (savedOpen && !hasSelection);

  return (
    <PixelPanel className={cx("pointer-events-auto p-3", open ? "w-60" : "w-44")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-display text-[10px] uppercase tracking-[0.14em] text-ink-faint">{open ? "Districts · emotions" : "Islands"}</span>
        {collapsible && (
          <button
            type="button"
            aria-expanded={open}
            disabled={hasSelection}
            onClick={() => writeOpen(!savedOpen)}
            className="pixel-focus font-display text-[9px] uppercase tracking-[0.12em] text-ink-dim hover:text-ink disabled:opacity-40"
          >
            Key {open ? "▾" : "▸"}
          </button>
        )}
      </div>
      <ul className={open ? "space-y-1" : "grid grid-cols-2 gap-x-2 gap-y-1"}>
        {EMOTION_LIST.map((e) => {
          const n = model.dreams.filter((d) => d.primaryEmotion === e).length;
          return (
            <li key={e} title={VOCAB.emotionDefinitions[e]}>
              <button
                type="button"
                onClick={() => select({ kind: "island", id: e })}
                aria-pressed={focusedIsland === e}
                className={cx(
                  "pixel-focus flex w-full items-center gap-1.5 text-left hover:bg-(--hover)",
                  open ? "text-[13px]" : "text-[11px]",
                  focusedIsland === e && "bg-(--hover)",
                )}
              >
                <span className="h-3 w-3 shrink-0" style={{ background: EMOTION_COLORS[e], boxShadow: "2px 2px 0 var(--shadow)" }} />
                <span className="flex-1 truncate text-ink">{EMOTION_LABELS[e]}</span>
                <span className="w-4 text-right font-display text-[10px] text-ink-dim">{n}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && (
      <div className="mt-3 space-y-1 border-t-2 border-line pt-2 text-[12px] text-ink-dim">
        <div className="mb-1 font-display text-[9px] uppercase tracking-[0.14em] text-ink-faint">Links · glowing arcs between places</div>
        <KeyRow icon={<LineIcon color="#ffd27a" />}>Dream ↔ book, film, song or game</KeyRow>
        <KeyRow icon={<LineIcon color="#9db2ff" />}>Recurring · dream ↔ dream</KeyRow>
        <KeyRow icon={<LineIcon color="#d9a75a" dashed />}>Weaker link</KeyRow>
        <KeyRow icon={<LineIcon color="#ffd27a" thick />}>Strong link (thicker)</KeyRow>
        <p className="pb-1 text-[11px] text-ink-faint">Hover or select a building to light up its links.</p>
        <div className="mb-1 mt-2 font-display text-[9px] uppercase tracking-[0.14em] text-ink-faint">Map</div>
        <KeyRow icon={<Swatch color="#5d6178" />}>Path</KeyRow>
        <KeyRow icon={<Swatch color="#8a7440" />}>Main boulevard · ring road on the central island</KeyRow>
        <KeyRow icon={<Swatch color="#4a5080" />}>Cloud sea · the city floats on a giant cloud</KeyRow>
        <div className="mb-1 mt-2 font-display text-[9px] uppercase tracking-[0.14em] text-ink-faint">Places</div>
        <KeyRow icon={<span className="text-[var(--yours)]">★</span>}>Landmark · “Yours” symbol</KeyRow>
        <KeyRow icon={<span className="text-[#ff9d3b]">?</span>}>Construction site</KeyRow>
        <p className="pt-1 text-[11px] text-ink-faint">Height = intensity · lit windows = recent</p>
      </div>
      )}
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

/** A short glowing line, matching how links lie along the paths. */
function LineIcon({ color, dashed, thick }: { color: string; dashed?: boolean; thick?: boolean }) {
  return (
    <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden>
      <path d="M2 5 L24 5" stroke="#03040a" strokeWidth={thick ? 5 : 3.6} strokeLinecap="round" />
      <path d="M2 5 L24 5" fill="none" stroke={color} strokeWidth={thick ? 2.8 : 1.8} strokeLinecap="round" strokeDasharray={dashed ? "3 3" : undefined} />
    </svg>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="block h-3 w-6" style={{ background: color, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12), 2px 2px 0 var(--shadow)" }} />;
}
