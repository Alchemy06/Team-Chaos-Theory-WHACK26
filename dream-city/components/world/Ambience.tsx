"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rngFor } from "./rng";
import { voxelGeometry } from "./resources";

const tmp = new THREE.Object3D();

/** Drifting fog blocks ring the built area: the unexplored edge of the city. */
function FogRing({ radius }: { radius: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const count = 160;
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#7d8fd0", transparent: true, opacity: 0.035, depthWrite: false }),
    [],
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rng = rngFor("fog");
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = radius + 8 + rng() * 18; // wisps drifting beyond the cloud
      const s = 2 + Math.floor(rng() * 4);
      tmp.position.set(Math.cos(a) * r, 0.5 + rng() * 4, Math.sin(a) * r);
      tmp.scale.set(s, 1 + Math.floor(rng() * 3), s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [radius]);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.006;
  });
  return (
    <group ref={group}>
      <instancedMesh ref={ref} args={[voxelGeometry(), material, count]} raycast={() => null} />
    </group>
  );
}

export function Ambience({ radius }: { radius: number }) {
  return (
    <>
      <FogRing radius={radius} />
      <Sparkles count={140} scale={[radius * 1.8, 16, radius * 1.8]} position={[0, 8, 0]} size={4} speed={0.25} opacity={0.75} color="#d6dcff" noise={1} />
      <Sparkles count={60} scale={[radius, 8, radius]} position={[0, 4, 0]} size={6} speed={0.4} opacity={0.9} color="#ffd98a" noise={2} />
    </>
  );
}
