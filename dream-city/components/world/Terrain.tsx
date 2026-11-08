"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useCityStore } from "@/store/useCityStore";
import { cellKey, type WorldCity } from "./cityGeometry";
import { noiseTexture, voxelGeometry } from "./resources";
import { buildGround, buildProps } from "./terrain";
import { VoxelMesh } from "./VoxelMesh";

const tmp = new THREE.Object3D();
const col = new THREE.Color();

export function Terrain({ city }: { city: WorldCity }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tiles = useMemo(() => buildGround(city), [city]);
  const props = useMemo(() => buildProps(city), [city]);

  // Which island a pointer event landed on: "centre", an emotion, or null.
  const ownerAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const t = e.instanceId === undefined ? undefined : tiles[e.instanceId];
    return t ? (city.land.get(cellKey(t.x, t.z)) ?? null) : null;
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return; // a drag to pan, not a click
    const owner = ownerAt(e);
    if (!owner) return;
    const store = useCityStore.getState();
    store.select(owner === "centre" ? { kind: "plaza" } : { kind: "island", id: owner });
    if (store.hoverId?.startsWith("island:")) store.hover(null); // drop the "click to explore" tag
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const owner = ownerAt(e);
    const id = owner && owner !== "centre" ? `island:${owner}` : null;
    const store = useCityStore.getState();
    // a building or landmark in front of the ground owns the hover
    if (store.hoverId && !store.hoverId.startsWith("island:")) return;
    // the island already in focus needs no "click to explore"
    const focused = store.selection?.kind === "island" && id === `island:${store.selection.id}`;
    const next = focused ? null : id;
    if (store.hoverId !== next) store.hover(next);
    document.body.style.cursor = next ? "pointer" : "";
  };
  const onPointerOut = () => {
    const store = useCityStore.getState();
    if (store.hoverId?.startsWith("island:")) store.hover(null);
    document.body.style.cursor = "";
  };

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
      <instancedMesh key={tiles.length} ref={ref} args={[voxelGeometry(), undefined, tiles.length]} receiveShadow
        onPointerOver={(e) => e.stopPropagation()}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onClick={onClick}
      >
        <meshStandardMaterial map={noiseTexture()} roughness={0.95} metalness={0} />
      </instancedMesh>
      <VoxelMesh voxels={props} />
    </group>
  );
}
