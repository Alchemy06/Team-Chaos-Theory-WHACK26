"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Voxel } from "./voxel";
import { useCityStore } from "@/store/useCityStore";
import { VoxelMesh } from "./VoxelMesh";

// The central plaza represents the dreamer. A floating, slowly turning
// heart sits on a stepped dais; clicking it opens city-wide insights.

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

// Voxel heart, extruded with a thinner front/back so it reads as rounded
// while it turns. Shades run violet (bottom) to pink (top) like the city palette.
const HEART = [
  ".XX.XX.",
  "XXXXXXX",
  "XXXXXXX",
  ".XXXXX.",
  "..XXX..",
  "...X...",
];

function heart(): Voxel[] {
  const v: Voxel[] = [];
  const rows = HEART.length;
  const filled = (x: number, y: number) => HEART[y]?.[x] === "X";
  const shades = ["#a77bff", "#b97aef", "#cc7ce4", "#e07cd9", "#f07cd3", "#ff7ccf"];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < HEART[row].length; col++) {
      if (!filled(col, row)) continue;
      const x = col - 3;
      const y = rows - 1 - row;
      const c = shades[y];
      v.push({ x, y, z: 0, c, g: true });
      const inner = filled(col - 1, row) && filled(col + 1, row) && filled(col, row - 1) && filled(col, row + 1);
      if (inner) {
        v.push({ x, y, z: 1, c, g: true });
        v.push({ x, y, z: -1, c, g: true });
      }
    }
  // A soft highlight on the left lobe.
  for (const p of v) if (p.x === -2 && p.y === 4 && p.z !== 0) p.c = "#ffd6f0";
  return v;
}

export function Plaza() {
  const daisVoxels = useMemo(() => dais(), []);
  const heartVoxels = useMemo(() => heart(), []);
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
        <VoxelMesh voxels={heartVoxels} castShadow={false} />
      </group>
      <pointLight position={[0, 5, 0]} intensity={40} distance={22} color="#e0a0f0" decay={2} />
    </group>
  );
}
