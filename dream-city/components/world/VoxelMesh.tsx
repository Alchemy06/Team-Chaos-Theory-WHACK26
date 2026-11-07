"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Voxel } from "./voxel";
import { glowMaterial, noiseTexture, voxelGeometry } from "./resources";

type Props = {
  voxels: Voxel[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Emissive tint for hover / selection highlight. */
  emissive?: string;
  emissiveIntensity?: number;
};

const tmp = new THREE.Object3D();
const col = new THREE.Color();

function fill(mesh: THREE.InstancedMesh | null, list: Voxel[]) {
  if (!mesh) return;
  list.forEach((v, i) => {
    tmp.position.set(v.x, v.y + 0.5, v.z);
    tmp.updateMatrix();
    mesh.setMatrixAt(i, tmp.matrix);
    mesh.setColorAt(i, col.set(v.c));
  });
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/** Renders a voxel list as two instanced meshes: lit solids and unlit glow. */
export function VoxelMesh({ voxels, castShadow = true, receiveShadow = true, emissive = "#000000", emissiveIntensity = 0 }: Props) {
  const solidRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const { solid, glow } = useMemo(
    () => ({ solid: voxels.filter((v) => !v.g), glow: voxels.filter((v) => v.g) }),
    [voxels],
  );

  useLayoutEffect(() => fill(solidRef.current, solid), [solid]);
  useLayoutEffect(() => fill(glowRef.current, glow), [glow]);

  return (
    <>
      {solid.length > 0 && (
        <instancedMesh
          key={`s${solid.length}`}
          ref={solidRef}
          args={[voxelGeometry(), undefined, solid.length]}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        >
          <meshStandardMaterial
            map={noiseTexture()}
            roughness={0.92}
            metalness={0}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
          />
        </instancedMesh>
      )}
      {glow.length > 0 && (
        <instancedMesh key={`g${glow.length}`} ref={glowRef} args={[voxelGeometry(), glowMaterial(), glow.length]} />
      )}
    </>
  );
}
