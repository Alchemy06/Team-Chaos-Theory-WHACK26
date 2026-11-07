"use client";

import type { ReactNode } from "react";
import { useCity } from "@/store/useCity";
import { useCityStore } from "@/store/useCityStore";
import { ConstructionPanel } from "./ConstructionPanel";
import { DreamPanel } from "./DreamPanel";
import { LandmarkPanel } from "./LandmarkPanel";
import { PlazaPanel } from "./PlazaPanel";
import { WorkPanel } from "./WorkPanel";

export function SelectionPanel() {
  const selection = useCityStore((s) => s.selection);
  const model = useCity();
  if (!selection) return null;
  let body: ReactNode = null;
  if (selection.kind === "dream") {
    const d = model.dreamById.get(selection.id);
    if (d) body = <DreamPanel key={d.id} dream={d} model={model} />;
  } else if (selection.kind === "work") {
    const w = model.workById.get(selection.id);
    if (w) body = <WorkPanel key={w.id} work={w} model={model} />;
  } else if (selection.kind === "landmark") {
    body = <LandmarkPanel key={selection.id} symbol={selection.id} model={model} />;
  } else if (selection.kind === "construction") {
    const r = model.recById.get(selection.id);
    if (r) body = <ConstructionPanel key={r.id} rec={r} model={model} />;
  } else if (selection.kind === "plaza") {
    body = <PlazaPanel model={model} />;
  }
  if (!body) return null;
  return (
    <aside
      aria-label="Details"
      className="pixel-panel anim-rise pointer-events-auto fixed inset-x-2 bottom-2 z-30 h-[62dvh] overflow-hidden md:inset-x-auto md:bottom-24 md:right-4 md:top-20 md:h-auto md:w-[400px]"
    >
      {body}
    </aside>
  );
}
