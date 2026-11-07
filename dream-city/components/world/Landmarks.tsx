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

/** A tower for a recurring symbol labelled "yours", with a beacon of light. */
export const Landmark = memo(function Landmark({ l, index }: { l: WLandmark; index: number }) {
  const color = EMOTION_COLOR[l.emotion];
  const model = useMemo(() => landmarkTower(l.symbol, l.height, color), [l.symbol, l.height, color]);
  const ref = useRise(introDelay(index) + 900);
  const beam = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const m = beam.current?.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = 0.1 + Math.sin(s.clock.elapsedTime * 1.3 + index) * 0.04;
  });
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
      </group>
      <mesh ref={beam} position={[0, model.height + 14, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.35, 0.6, 28, 6, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
});
