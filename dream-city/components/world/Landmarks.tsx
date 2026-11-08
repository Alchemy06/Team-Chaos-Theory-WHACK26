"use client";

import { memo, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useCityStore } from "@/store/useCityStore";
import type { WLandmark } from "./cityGeometry";
import { EMOTION_COLOR } from "./palette";
import { landmarkTower } from "./voxel";
import { VoxelMesh } from "./VoxelMesh";
import { introDelay, useRise } from "./useRise";

const MOTES = 4;

/** Glowing cubes in the landmark's colour, slowly circling above the tower tip. */
function OrbitingMotes({ color, top, index }: { color: string; top: number; index: number }) {
  const ring = useRef<THREE.Group>(null);
  const motes = useRef<(THREE.Mesh | null)[]>([]);
  // HDR-bright so the motes catch the bloom like other glowing voxels.
  const glow = useMemo(() => new THREE.Color(color).multiplyScalar(1.8), [color]);
  useFrame((s) => {
    const t = s.clock.elapsedTime + index * 1.7;
    if (ring.current) ring.current.rotation.y = t * 0.6;
    motes.current.forEach((m, i) => {
      if (!m) return;
      m.position.y = Math.sin(t * 1.4 + i * 1.6) * 0.35;
      m.rotation.x = m.rotation.z = t * 1.1 + i;
    });
  });
  return (
    <group ref={ring} position={[0, top + 0.6, 0]}>
      {Array.from({ length: MOTES }, (_, i) => {
        const a = (i / MOTES) * Math.PI * 2;
        return (
          <mesh
            key={i}
            ref={(m) => {
              motes.current[i] = m;
            }}
            position={[Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6]}
            raycast={() => null}
          >
            <boxGeometry args={[0.32, 0.32, 0.32]} />
            <meshBasicMaterial color={glow} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A tower for a recurring symbol labelled "yours". */
export const Landmark = memo(function Landmark({ l, index }: { l: WLandmark; index: number }) {
  const color = EMOTION_COLOR[l.emotion];
  const model = useMemo(() => landmarkTower(l.symbol, l.height, color), [l.symbol, l.height, color]);
  const ref = useRise(introDelay(index) + 900);
  const hovered = useCityStore((s) => s.hoverId === `landmark:${l.symbol}`);
  const on = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      useCityStore.getState().hover(`landmark:${l.symbol}`);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      useCityStore.getState().hover(null);
      document.body.style.cursor = "";
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      useCityStore.getState().select({ kind: "landmark", id: l.symbol });
    },
  };
  return (
    <group position={[l.pos.x, 0, l.pos.z]} {...on}>
      <group ref={ref}>
        <VoxelMesh voxels={model.voxels} emissive={color} emissiveIntensity={hovered ? 0.25 : 0} />
        <OrbitingMotes color={color} top={model.height} index={index} />
      </group>
    </group>
  );
});
