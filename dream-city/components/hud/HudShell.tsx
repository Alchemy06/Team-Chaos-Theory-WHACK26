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
  const openRecord = useCityStore((s) => s.openRecord);
  const recordOpen = useCityStore((s) => s.record.open);
  const hasSelection = useCityStore((s) => s.selection !== null);

  useEffect(() => {
    void useCityStore.persist.rehydrate();
    void useCityStore.getState().loadMedia();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = useCityStore.getState();
      if (s.citation) s.openCitation(null);
      else if (s.record.open) s.closeRecord();
      else s.select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <TopBar />
      <div className="absolute bottom-3 left-3 hidden lg:block">
        <DistrictLegend />
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
