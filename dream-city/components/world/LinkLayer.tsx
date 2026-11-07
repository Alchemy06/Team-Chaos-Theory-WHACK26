"use client";

import { useMemo } from "react";
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
