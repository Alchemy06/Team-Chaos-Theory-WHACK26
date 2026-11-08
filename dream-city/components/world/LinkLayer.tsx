"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCity } from "@/store/useCity";
import { useCityStore } from "@/store/useCityStore";
import { cameraBus } from "./cameraBus";
import { introDelay } from "./useRise";
import { Boulevard, Road } from "./Roads";

/**
 * Links live on their own transparent canvas layered over the city. It never
 * goes through the post-processing chain, so the pixel filter can't touch the
 * lines: they stay smooth and crisp. Its camera copies the city camera every
 * frame. The layer draws over the city, which suits the raised arcs.
 */
export function LinkLayer() {
  return (
    <Canvas
      className="!pointer-events-none !absolute inset-0"
      style={{ pointerEvents: "none" }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      orthographic
      camera={{ position: [0, 100, 0], zoom: 10, near: 0.1, far: 400 }}
      events={undefined}
    >
      <CameraSync />
      <Occluders />
      <Links />
    </Canvas>
  );
}

/** Mirror the city camera (position, rotation, zoom) so links line up exactly. */
function CameraSync() {
  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera;
    const src = cameraBus.camera as THREE.OrthographicCamera | null;
    if (!src) return;
    camera.position.copy(src.position);
    camera.quaternion.copy(src.quaternion);
    camera.zoom = src.zoom;
    camera.near = src.near;
    camera.far = src.far;
    camera.updateProjectionMatrix();
  }, -1);
  return null;
}

const tmp = new THREE.Object3D();

/**
 * Invisible stand-ins for buildings and landmarks. They write depth only, so
 * links passing behind a tower are hidden correctly even though the links
 * live on their own canvas.
 */
function Occluders() {
  const model = useCity();
  const ref = useRef<THREE.InstancedMesh>(null);
  const boxes = useMemo(() => {
    const out: { x: number; z: number; h: number }[] = [];
    for (const b of model.world.buildings) if (model.visible.has(b.id)) out.push({ x: b.pos.x, z: b.pos.z, h: b.height + 1 });
    for (const l of model.world.landmarks) out.push({ x: l.pos.x, z: l.pos.z, h: l.height + 1 });
    return out;
  }, [model]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    boxes.forEach((b, i) => {
      tmp.position.set(b.x, b.h / 2, b.z);
      tmp.scale.set(2.9, b.h, 2.9);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes]);
  return (
    <instancedMesh key={boxes.length} ref={ref} args={[undefined, undefined, boxes.length]} renderOrder={-10} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial colorWrite={false} />
    </instancedMesh>
  );
}

function Links() {
  const model = useCity();
  const justBuiltId = useCityStore((s) => s.justBuiltId);
  const roads = model.world.roads;
  // Ids that have at least one link: focus mode only kicks in for these.
  const linked = useMemo(() => new Set(roads.flatMap((r) => [r.from, r.to])), [roads]);
  const introRoads = introDelay(model.allDreams.length + model.allWorks.length);
  const boulevard = model.world.boulevard;
  return (
    <>
      {boulevard && <Boulevard key={boulevard.symbol} anchors={boulevard.anchors} />}
      {roads.map((r, i) => (
        <Road
          key={r.id}
          road={r}
          linked={linked}
          delay={r.from === justBuiltId || r.to === justBuiltId ? 1700 : introRoads > 0 ? introRoads + i * 25 : 0}
        />
      ))}
    </>
  );
}
