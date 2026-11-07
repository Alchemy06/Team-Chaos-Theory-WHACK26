"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { WorldCity } from "./cityGeometry";
import { noiseTexture, voxelGeometry } from "./resources";
import { buildGround, buildProps } from "./terrain";
import { VoxelMesh } from "./VoxelMesh";

const tmp = new THREE.Object3D();
const col = new THREE.Color();

export function Terrain({ city }: { city: WorldCity }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tiles = useMemo(() => buildGround(city), [city]);
  const props = useMemo(() => buildProps(city), [city]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    tiles.forEach((t, i) => {
      const h = 1 + t.y;
      tmp.position.set(t.x, t.y - h / 2, t.z); // tile top surface sits at y = t.y
      tmp.scale.set(1, h, 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      mesh.setColorAt(i, col.set(t.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [tiles]);

  return (
    <group>
      <instancedMesh key={tiles.length} ref={ref} args={[voxelGeometry(), undefined, tiles.length]} receiveShadow onPointerOver={(e) => e.stopPropagation()}>
        <meshStandardMaterial map={noiseTexture()} roughness={0.95} metalness={0} />
      </instancedMesh>
      <VoxelMesh voxels={props} />
    </group>
  );
}
