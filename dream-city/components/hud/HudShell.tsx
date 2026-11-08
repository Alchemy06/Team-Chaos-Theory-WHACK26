"use client";

import { useEffect } from "react";
import { useCityStore } from "@/store/useCityStore";
import { CitationPopover } from "./CitationPopover";
import { DistrictLegend } from "./DistrictLegend";
import { RecordDreamSheet } from "./RecordDreamSheet";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";
import { SelectionPanel } from "./panels/SelectionPanel";
import { PixelButton } from "./ui/Pixel";

/** Conventional UI layered over the 3D world. Never imports three.js. */
export function HudShell() {
  const cityLoading = useCityStore((s) => s.cityLoading);
  const cityError = useCityStore((s) => s.cityError);
  const dreamCount = useCityStore((s) => s.userDreams.length);
  const loadCity = useCityStore((s) => s.loadCity);
  const openRecord = useCityStore((s) => s.openRecord);
  const recordOpen = useCityStore((s) => s.record.open);
  const hasSelection = useCityStore((s) => s.selection !== null);

  useEffect(() => {
    void useCityStore.persist.rehydrate();
    void useCityStore.getState().loadCity();
    void useCityStore.getState().loadMedia();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = useCityStore.getState();
      if (s.citation) s.openCitation(null);
      else if (s.record.open) s.closeRecord();
      else s.select(null);
    };
    // ── (ADDED) Pick up database changes when returning to the map ──
    const refreshCity = () => { if (!useCityStore.getState().record.open) void useCityStore.getState().loadCity(); };
    window.addEventListener("focus", refreshCity);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("focus", refreshCity);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <TopBar />
      {/* ── (ADDED) Empty and error states never fall back to demo buildings ── */}
      {!recordOpen && (cityLoading || cityError || dreamCount === 0) && (
        <div role="status" className="pointer-events-auto absolute left-1/2 top-24 w-[min(90vw,420px)] -translate-x-1/2 border-2 border-line bg-(--well) p-3 text-center text-[14px] text-ink">
          {cityLoading ? "Loading saved dreams…" : cityError ?? "Your city is waiting. Record your first dream."}
          {cityError && <button type="button" className="pixel-btn ml-2 px-2 py-1" onClick={() => void loadCity()}>Retry</button>}
        </div>
      )}
      <div className="absolute bottom-3 left-3 hidden lg:block">
        <DistrictLegend collapsible />
      </div>
      <div
        className={`absolute inset-x-2 bottom-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-end sm:justify-center md:inset-x-auto md:left-1/2 md:-translate-x-1/2 ${hasSelection ? "max-md:hidden" : ""}`}
      >
        <Timeline />
        <PixelButton variant="primary" className="rec-pulse pointer-events-auto shrink-0 px-4 py-3 text-[12px]" onClick={openRecord} disabled={recordOpen}>
          ● Record a dream
        </PixelButton>
      </div>
      <SelectionPanel />
      <RecordDreamSheet />
      <CitationPopover />
    </div>
  );
}
