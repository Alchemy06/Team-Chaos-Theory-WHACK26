"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { useCityStore } from "@/store/useCityStore";
import type { WorldCity } from "./cityGeometry";
import { locate } from "./locate";
import type { Voxel } from "./voxel";
import { VoxelMesh } from "./VoxelMesh";

/** Glowing footprint ring + bobbing diamond over the selected object. */
export function SelectionMarker({ city }: { city: WorldCity }) {
  const selection = useCityStore((s) => s.selection);
  const hit = locate(city, selection);
  const bob = useRef<THREE.Group>(null);
  const w = hit?.w ?? 3;
  const d = hit?.d ?? 3;
  const ring = useMemo<Voxel[]>(() => {
    const hw = Math.ceil(w / 2) + 1;
    const hd = Math.ceil(d / 2) + 1;
    const v: Voxel[] = [];
    for (let x = -hw; x <= hw; x++)
      for (let z = -hd; z <= hd; z++) if ((Math.abs(x) === hw || Math.abs(z) === hd) && (x + z) % 2 === 0) v.push({ x, y: 0, z, c: "#ffffff", g: true });
    return v;
  }, [w, d]);
  const diamond = useMemo<Voxel[]>(
    () => [
      { x: 0, y: 0, z: 0, c: "#ffe9a8", g: true },
      { x: 0, y: 1, z: 0, c: "#ffffff", g: true },
      { x: 0, y: -1, z: 0, c: "#ffd27a", g: true },
    ],
    [],
  );
  useFrame((s) => {
    if (!bob.current) return;
    bob.current.position.y = (hit?.top ?? 0) + 2.5 + Math.sin(s.clock.elapsedTime * 3) * 0.4;
    bob.current.rotation.y = s.clock.elapsedTime * 1.5;
  });
  if (!hit) return null;
  return (
    <group position={[hit.pos.x, 0, hit.pos.z]}>
      <group scale={[1, 0.2, 1]}>
        <VoxelMesh voxels={ring} castShadow={false} receiveShadow={false} />
      </group>
      <group ref={bob} scale={0.55}>
        <VoxelMesh voxels={diamond} castShadow={false} />
      </group>
    </group>
  );
}
