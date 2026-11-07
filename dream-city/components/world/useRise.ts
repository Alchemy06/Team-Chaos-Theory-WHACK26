"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";

let worldMountedAt = 0;
export function markWorldMounted() {
  worldMountedAt = performance.now();
}
/** During the first moments the city assembles in chronological order; afterwards new buildings rise immediately. */
export function introDelay(order: number) {
  return performance.now() - worldMountedAt < 2500 ? 250 + order * 45 : 0;
}

/** Spring a group's Y scale from 0 to 1 after `delayMs` — the "building rises" animation. */
export function useRise(delayMs: number, stiffness = 90, damping = 11) {
  const ref = useRef<THREE.Group>(null);
  const state = useRef({ start: -1, s: 0.001, v: 0, done: false });
  useFrame((_, dt) => {
    const g = ref.current;
    const st = state.current;
    if (!g || st.done) return;
    if (st.start < 0) st.start = performance.now() + delayMs;
    if (performance.now() < st.start) {
      g.scale.set(1, 0.001, 1);
      g.visible = false;
      return;
    }
    g.visible = true;
    const d = Math.min(dt, 1 / 30);
    const a = stiffness * (1 - st.s) - damping * st.v;
    st.v += a * d;
    st.s += st.v * d;
    if (Math.abs(1 - st.s) < 0.002 && Math.abs(st.v) < 0.01) {
      st.s = 1;
      st.done = true;
    }
    g.scale.set(1, Math.max(0.001, st.s), 1);
  });
  return ref;
}
