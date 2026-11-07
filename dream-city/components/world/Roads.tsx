"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec2, WRoad as RoadLayout } from "./cityGeometry";
import { WORLD } from "./palette";
import { useCityStore } from "@/store/useCityStore";
import { roadTileGeometry } from "./resources";

// Flowing voxel roads: each tile carries its position along the path (aT) so a
// shader can animate a travelling glow, reveal the road progressively, and
// brighten it when an endpoint is hovered or selected.

const vertex = /* glsl */ `
  attribute float aT;
  varying float vT;
  varying vec3 vNormal2;
  void main() {
    vT = aT;
    vNormal2 = normalMatrix * mat3(instanceMatrix) * normal;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uReveal;
  uniform float uStrength;
  uniform float uHighlight;
  uniform float uLength;
  varying float vT;
  varying vec3 vNormal2;
  void main() {
    if (vT > uReveal) discard;
    float top = clamp(vNormal2.y, 0.0, 1.0) * 0.5 + 0.5;
    float wave = fract(vT * uLength / 7.0 - uTime * 0.45);
    float pulse = smoothstep(0.0, 0.12, wave) * (1.0 - smoothstep(0.12, 0.35, wave));
    float base = 0.22 + 0.35 * uStrength + uHighlight * 0.45;
    vec3 c = uColor * (base + pulse * (0.9 + uHighlight * 1.4)) * top;
    float head = smoothstep(uReveal - 0.04, uReveal, vT) * step(uReveal, 0.999);
    gl_FragColor = vec4(c + uColor * head * 2.0, 1.0);
  }
`;

const tmp = new THREE.Object3D();

function RoadTiles({
  cells,
  color,
  strength,
  highlight,
  y = 0.07,
  revealDelay = 0,
  revealSpeed = 1.1,
  stride = 1,
}: {
  cells: Vec2[];
  color: string;
  strength: number;
  highlight: boolean;
  y?: number;
  revealDelay?: number;
  revealSpeed?: number;
  stride?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const born = useRef(-1);
  const tiles = useMemo(() => cells.filter((_, i) => i % stride === 0), [cells, stride]);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uStrength: { value: strength },
      uHighlight: { value: 0 },
      uLength: { value: 1 },
    }),
    // Uniform values are updated through matRef below; the object itself is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const geometry = useMemo(() => {
    const g = roadTileGeometry().clone();
    g.setAttribute(
      "aT",
      new THREE.InstancedBufferAttribute(Float32Array.from(tiles, (_, i) => (tiles.length > 1 ? i / (tiles.length - 1) : 1)), 1),
    );
    return g;
  }, [tiles]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    tiles.forEach((c, i) => {
      tmp.position.set(c.x, y, c.z);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [tiles, y]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, dt) => {
    const m = matRef.current;
    if (!m) return;
    const u = m.uniforms;
    if (born.current < 0) born.current = performance.now() + revealDelay;
    u.uTime.value = state.clock.elapsedTime;
    u.uLength.value = tiles.length;
    u.uStrength.value = strength;
    (u.uColor.value as THREE.Color).set(color);
    const since = (performance.now() - born.current) / 1000;
    u.uReveal.value = since <= 0 ? 0 : Math.min(1, since * revealSpeed);
    u.uHighlight.value += ((highlight ? 1 : 0) - u.uHighlight.value) * Math.min(1, dt * 8);
  });

  return (
    <instancedMesh key={tiles.length} ref={ref} args={[geometry, undefined, tiles.length]} raycast={() => null}>
      <shaderMaterial ref={matRef} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} toneMapped={false} />
    </instancedMesh>
  );
}

export const Road = memo(function Road({ road, delay }: { road: RoadLayout; delay: number }) {
  const highlight = useCityStore((s) => {
    const sel = s.selection && "id" in s.selection ? s.selection.id : null;
    return [road.from, road.to].includes(s.hoverId ?? "") || [road.from, road.to].includes(sel ?? "");
  });
  const isMedia = road.to.startsWith("w"); // dream -> work road (dream -> dream roads are recurring patterns)
  const color = isMedia ? (road.bright ? "#ffd27a" : "#d9a75a") : "#9db2ff";
  return (
    <RoadTiles
      cells={road.cells}
      color={color}
      strength={road.strength}
      highlight={highlight}
      stride={road.dotted ? 2 : 1}
      revealDelay={delay}
    />
  );
});

export function Boulevard({ cells }: { cells: Vec2[] }) {
  return <RoadTiles cells={cells} color={WORLD.boulevard} strength={0.7} highlight={false} y={0.05} revealSpeed={0.5} revealDelay={600} />;
}
