"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { useWorldTheme } from "@/store/useTheme";

export function Lighting({ radius }: { radius: number }) {
  const r = radius + 12;
  const t = useWorldTheme();
  // The night "breathes": sky light and the warm city glow swell and settle very slowly.
  const hemi = useRef<THREE.HemisphereLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  useFrame((s) => {
    const breath = Math.sin((s.clock.elapsedTime / 18) * Math.PI * 2);
    if (hemi.current) hemi.current.intensity = 0.85 * (1 + breath * 0.06);
    if (fill.current) fill.current.intensity = 0.25 * (1 + breath * 0.25);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={[t.hemiSky, t.hemiGround, 0.85]} />
      <ambientLight intensity={0.18} color={t.ambient} />
      <directionalLight
        position={[-32, 60, 26]}
        intensity={1.5}
        color={t.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
        shadow-camera-left={-r}
        shadow-camera-right={r}
        shadow-camera-top={r}
        shadow-camera-bottom={-r}
        shadow-camera-near={1}
        shadow-camera-far={180}
      />
      {/* warm fill from the city glow */}
      <directionalLight ref={fill} position={[30, 14, -30]} intensity={0.25} color={t.fill} />
    </>
  );
}
