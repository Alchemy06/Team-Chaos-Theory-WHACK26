"use client";

import { useEffect, useRef, useState } from "react";
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
  const citationOpen = useCityStore((s) => s.citation !== null);

  // Quiet mode: H fades the HUD back (until H again); after a while with no
  // input it also drifts quiet on its own, and any input wakes it. Never while
  // something needs reading or typing.
  const [quiet, setQuiet] = useState(false);
  const manual = useRef(false);
  useEffect(() => {
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setQuiet(true), 25000);
    };
    const wake = () => {
      if (!manual.current) setQuiet(false);
      arm();
    };
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (!typing && (e.key === "h" || e.key === "H") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setQuiet((q) => {
          manual.current = !q;
          return !q;
        });
        arm();
        return;
      }
      wake();
    };
    const events = ["pointermove", "pointerdown", "wheel", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    window.addEventListener("keydown", onKey);
    arm();
    return () => {
      window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, wake));
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const hushed = quiet && !recordOpen && !citationOpen && !hasSelection;

  useEffect(() => {
    void useCityStore.persist.rehydrate();
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
    <div className="hud-layer pointer-events-none absolute inset-0 z-20" data-quiet={hushed}>
      <TopBar />
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
