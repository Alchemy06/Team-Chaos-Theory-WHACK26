"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { MapControls, OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldCity } from "./cityGeometry";
import { locate } from "./locate";
import { useCityStore } from "@/store/useCityStore";

type MapControlsImpl = ComponentRef<typeof MapControls>;

const AZIMUTH = -Math.PI / 4; // looks across the Happiness/Wonder side of the city
const DIST = 120;
const ELEV = 0.62; // radians above the horizon (~35°, isometric-ish)

export function CameraRig({ layout }: { layout: WorldCity }) {
  const controls = useRef<MapControlsImpl>(null);
  const size = useThree((s) => s.size);
  const fitZoom = Math.max(2, Math.min(14, Math.min(size.width, size.height * 1.35) / (layout.radius * (size.width < 640 ? 2.2 : 2.25))));
  const goal = useRef<{ target: THREE.Vector3; zoom: number } | null>({ target: new THREE.Vector3(), zoom: fitZoom });
  const interacting = useRef(false);
  const selection = useCityStore((s) => s.selection);
  const nonce = useCityStore((s) => s.cameraNonce);
  const recordOpen = useCityStore((s) => s.record.open);

  // Fly to a selection; deselecting an island or the plaza flies back out to the whole city.
  // While an island is in focus, picking things on it only swaps the panel: the view stays put.
  const prevKind = useRef<string | null>(null);
  const islandView = useRef(false);
  useEffect(() => {
    const prev = prevKind.current;
    prevKind.current = selection?.kind ?? null;
    if (!selection) {
      if (prev === "island" || prev === "plaza" || islandView.current) goal.current = { target: new THREE.Vector3(), zoom: fitZoom };
      islandView.current = false;
      return;
    }
    if (selection.kind === "island") islandView.current = true;
    else if (islandView.current && selection.kind !== "plaza") return;
    else islandView.current = false;
    const hit = locate(layout, selection);
    if (!hit) return;
    // The part of the screen the HUD leaves free: below the top bar, left of the
    // side panel (or above the phone bottom sheet). The map key collapses while
    // something is selected, so it barely intrudes on the left.
    const sheet = size.width < 768; // phones: the panel is a bottom sheet over the lower ~62%
    const free = {
      left: 16,
      right: sheet ? size.width - 16 : size.width - 416,
      top: 76,
      bottom: sheet ? size.height * 0.38 : size.height - 16,
    };
    const freeW = Math.max(160, free.right - free.left);
    const freeH = Math.max(120, free.bottom - free.top);
    let zoom: number;
    if (selection.kind === "island") {
      // fit the whole island into the free area
      zoom = Math.min(18, Math.max(fitZoom * 1.1, Math.min(freeW, freeH * 1.35) / ((hit.w / 2) * 2.3)));
    } else {
      zoom = selection.kind === "plaza" ? Math.max(fitZoom * 1.3, 9) : Math.min(24, Math.max(fitZoom * 1.6, 14));
    }
    // Move the camera target so the focus lands in the middle of the free area.
    const t = new THREE.Vector3(hit.pos.x, hit.top * 0.35, hit.pos.z);
    const cam = controls.current?.object;
    if (cam) {
      const dx = (free.left + free.right) / 2 - size.width / 2; // px, + = right of screen centre
      const dy = (free.top + free.bottom) / 2 - size.height / 2; // px, + = below screen centre
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
      const forward = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).setY(0).normalize();
      // ground distances along the view are foreshortened by the camera's actual tilt
      const sinTilt = Math.max(0.3, -cam.getWorldDirection(new THREE.Vector3()).y);
      t.addScaledVector(right, -dx / zoom);
      t.addScaledVector(forward, dy / (zoom * sinTilt));
    }
    goal.current = { target: t, zoom };
  }, [selection, layout, fitZoom, size.width, size.height]);

  // Reset view
  useEffect(() => {
    goal.current = { target: new THREE.Vector3(), zoom: fitZoom };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Pull back while recording so the new building is visible when it rises
  useEffect(() => {
    if (recordOpen) goal.current = { target: new THREE.Vector3(), zoom: fitZoom * 1.1 };
  }, [recordOpen, fitZoom]);

  useFrame((_, dt) => {
    const c = controls.current;
    const g = goal.current;
    if (!c || !g || interacting.current) return;
    const cam = c.object as THREE.OrthographicCamera;
    const k = 1 - Math.exp(-dt * 3.2);
    const delta = new THREE.Vector3().subVectors(g.target, c.target).multiplyScalar(k);
    c.target.add(delta);
    cam.position.add(delta);
    cam.zoom += (g.zoom - cam.zoom) * k;
    cam.updateProjectionMatrix();
    c.update();
    if (delta.lengthSq() < 1e-5 && Math.abs(g.zoom - cam.zoom) < 0.01) goal.current = null;
  });

  const camPos: [number, number, number] = [
    Math.cos(AZIMUTH) * Math.cos(ELEV) * DIST,
    Math.sin(ELEV) * DIST,
    Math.sin(AZIMUTH) * Math.cos(ELEV) * DIST,
  ];

  return (
    <>
      <OrthographicCamera makeDefault position={camPos} zoom={fitZoom} near={0.1} far={400} />
      <MapControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minZoom={1.8}
        maxZoom={42}
        minPolarAngle={0.55}
        maxPolarAngle={1.12}
        zoomToCursor
        autoRotate={!selection}
        autoRotateSpeed={0.12}
        onStart={() => {
          interacting.current = true;
          goal.current = null;
        }}
        onEnd={() => {
          interacting.current = false;
        }}
        onChange={() => {
          // keep the camera over the island
          const c = controls.current;
          if (!c) return;
          const max = layout.radius + 30; // room for the free-area offset when focusing an outer island
          const len = Math.hypot(c.target.x, c.target.z);
          if (len > max) {
            const f = max / len;
            const dx = c.target.x * f - c.target.x;
            const dz = c.target.z * f - c.target.z;
            c.target.x += dx;
            c.target.z += dz;
            c.object.position.x += dx;
            c.object.position.z += dz;
          }
        }}
      />
    </>
  );
}
