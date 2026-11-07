"use client";

import { memo, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Dream, Work } from "@/lib/types";
import { useCityStore, type UISelection } from "@/store/useCityStore";
import type { WBuilding } from "./cityGeometry";
import { EMOTION_COLOR } from "./palette";
import { constructionSite, dreamTower, libraryBuilding } from "./voxel";
import { VoxelMesh } from "./VoxelMesh";
import { introDelay, useRise } from "./useRise";

function useInteractive(id: string, selection: UISelection) {
  const hover = useCityStore((s) => s.hover);
  const select = useCityStore((s) => s.select);
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      hover(id);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      hover(null);
      document.body.style.cursor = "";
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      select(selection);
    },
  };
}

function useHighlight(id: string) {
  const hovered = useCityStore((s) => s.hoverId === id);
  const selected = useCityStore((s) => s.selection !== null && "id" in s.selection && s.selection.id === id);
  return selected ? 0.38 : hovered ? 0.24 : 0;
}

export const DreamBuilding = memo(function DreamBuilding({ b, dream }: { b: WBuilding; dream: Dream }) {
  const model = useMemo(() => dreamTower(dream.id, dream.primaryEmotion, b.height, b.recency), [dream.id, dream.primaryEmotion, b.height, b.recency]);
  const glow = useHighlight(dream.id);
  const justBuilt = useCityStore((s) => s.justBuiltId === dream.id);
  const ref = useRise(justBuilt ? 300 : introDelay(b.order), justBuilt ? 40 : 90, justBuilt ? 6 : 11);
  const handlers = useInteractive(dream.id, { kind: "dream", id: dream.id });
  return (
    <group position={[b.pos.x, 0, b.pos.z]} {...handlers}>
      <group ref={ref}>
        <VoxelMesh voxels={model.voxels} emissive={EMOTION_COLOR[dream.primaryEmotion]} emissiveIntensity={glow} />
      </group>
    </group>
  );
});

export const LibraryBuilding = memo(function LibraryBuilding({ b, work }: { b: WBuilding; work: Work }) {
  const model = useMemo(() => libraryBuilding(work.id, work.kind, work.primaryEmotion, b.height), [work.id, work.kind, work.primaryEmotion, b.height]);
  const glow = useHighlight(work.id);
  const ref = useRise(introDelay(b.order));
  const handlers = useInteractive(work.id, { kind: "work", id: work.id });
  return (
    <group position={[b.pos.x, 0, b.pos.z]} {...handlers}>
      <group ref={ref}>
        <VoxelMesh voxels={model.voxels} emissive={EMOTION_COLOR[work.primaryEmotion]} emissiveIntensity={glow} />
      </group>
    </group>
  );
});

export const ConstructionSite = memo(function ConstructionSite({ b }: { b: WBuilding }) {
  const model = useMemo(() => constructionSite(b.id), [b.id]);
  const glow = useHighlight(b.id);
  const ref = useRise(introDelay(60) + 600);
  const handlers = useInteractive(b.id, { kind: "construction", id: b.id });
  return (
    <group position={[b.pos.x, 0, b.pos.z]} {...handlers}>
      <group ref={ref}>
        <VoxelMesh voxels={model.voxels} emissive="#ff9d3b" emissiveIntensity={glow} />
      </group>
    </group>
  );
});
