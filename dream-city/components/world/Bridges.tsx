"use client";

import { useMemo } from "react";
import type { WBridge } from "./cityGeometry";
import { EMOTION_COLOR } from "./palette";
import { bridgeVoxels } from "./voxel";
import { VoxelMesh } from "./VoxelMesh";

/** Plank bridges joining each emotion island to the central island. */
export function Bridges({ bridges }: { bridges: WBridge[] }) {
  const voxels = useMemo(() => bridges.flatMap((b) => bridgeVoxels(b, EMOTION_COLOR[b.emotion])), [bridges]);
  return <VoxelMesh voxels={voxels} />;
}
