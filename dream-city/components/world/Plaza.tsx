"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Voxel } from "./voxel";
import { useCityStore } from "@/store/useCityStore";
import { VoxelMesh } from "./VoxelMesh";

// The central plaza represents the dreamer. A floating, slowly turning
// crystal sits on a stepped dais; clicking it opens city-wide insights.

function dais(): Voxel[] {
  const v: Voxel[] = [];
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) + Math.abs(z) > 3) continue;
      v.push({ x, y: 0, z, c: (x + z) % 2 ? "#5a6080" : "#686e92" });
      if (Math.abs(x) + Math.abs(z) <= 1) v.push({ x, y: 1, z, c: "#7c83ab" });
    }
  for (const [x, z] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) {
    v.push({ x, y: 0, z, c: "#3d4260" });
    v.push({ x, y: 1, z, c: "#9fd0ff", g: true });
  }
  return v;
}

function crystal(): Voxel[] {
  const v: Voxel[] = [];
  const cols = ["#ff7ccf", "#a77bff", "#8be9ff"];
  for (let y = 0; y < 5; y++) {
    const r = y < 2 ? y : 4 - y;
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++) if (Math.abs(x) + Math.abs(z) <= r) v.push({ x, y, z, c: cols[(y + x + z + 9) % 3], g: true });
  }
  return v;
}

export function Plaza() {
  const daisVoxels = useMemo(() => dais(), []);
  const crystalVoxels = useMemo(() => crystal(), []);
  const spin = useRef<THREE.Group>(null);
  const select = useCityStore((s) => s.select);
  const hover = useCityStore((s) => s.hover);
  useFrame((s) => {
    if (!spin.current) return;
    spin.current.rotation.y = s.clock.elapsedTime * 0.35;
    spin.current.position.y = 3.2 + Math.sin(s.clock.elapsedTime * 1.2) * 0.35;
  });
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "plaza" });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        hover("plaza");
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        hover(null);
        document.body.style.cursor = "";
      }}
    >
      <VoxelMesh voxels={daisVoxels} />
      <group ref={spin} scale={0.6}>
        <VoxelMesh voxels={crystalVoxels} castShadow={false} />
      </group>
      <pointLight position={[0, 5, 0]} intensity={40} distance={22} color="#c9a8ff" decay={2} />
    </group>
  );
}
