"use client";

import { useEffect } from "react";
import { TIMELINE_DAYS, dayToDate } from "@/store/cityModel";
import { useCityStore } from "@/store/useCityStore";
import { fmtDate } from "./panels/PanelFrame";
import { PixelPanel } from "./ui/Pixel";

/** Time-lapse: replays the persona's nights so the city grows district by district. */
export function Timeline() {
  const day = useCityStore((s) => s.timelineDay);
  const playing = useCityStore((s) => s.playing);
  const setDay = useCityStore((s) => s.setTimelineDay);
  const setPlaying = useCityStore((s) => s.setPlaying);
  const max = TIMELINE_DAYS;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const s = useCityStore.getState();
      const cur = s.timelineDay ?? -1;
      if (cur >= max - 1) {
        s.setTimelineDay(null);
        s.setPlaying(false);
      } else s.setTimelineDay(cur + 1);
    }, 420);
    return () => clearInterval(id);
  }, [playing, max]);

  const label = day === null ? "Tonight · full city" : `Night ${day + 1} · ${fmtDate(dayToDate(day))}`;

  return (
    <PixelPanel className="pointer-events-auto flex items-center gap-3 px-3 py-2 sm:w-[min(460px,60vw)]">
      <button
        type="button"
        onClick={() => {
          if (!playing && day === null) setDay(0);
          setPlaying(!playing);
        }}
        className="pixel-btn grid h-9 w-9 shrink-0 place-items-center font-display text-xs"
        aria-label={playing ? "Pause time-lapse" : "Play time-lapse"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex justify-between font-display text-[9px] uppercase tracking-wider">
          <span className="text-ink-faint">Time-lapse</span>
          <span className="text-gold">{label}</span>
        </div>
        <input
          type="range"
          min={0}
          max={max}
          value={day ?? max}
          onChange={(e) => {
            const v = Number(e.target.value);
            setPlaying(false);
            setDay(v >= max ? null : v);
          }}
          className="pixel-range w-full"
          aria-label="Replay the city night by night"
        />
      </div>
    </PixelPanel>
  );
}
