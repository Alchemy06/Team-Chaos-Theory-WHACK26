"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { noiseTexture, voxelGeometry } from "./resources";
import type { WorldTheme } from "@/lib/themes";
import { useWorldTheme } from "@/store/useTheme";
import { rngFor } from "./rng";

// The whole archipelago floats on one giant cloud: a soft, moonlit cloud sea
// between the islands, a puffy voxel rim around the edge, and a bulging
// underside that tapers away into the night sky.

const seaVertex = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const seaFragment = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  uniform vec3 uShadow;
  uniform vec3 uLit;
  varying vec2 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  void main() {
    // sample on the voxel grid so the cloud reads as blocky puffs, drifting slowly
    vec2 cell = floor(vWorld);
    vec2 drift = vec2(uTime * 0.35, uTime * 0.12);
    float n = fbm((cell + drift) * 0.07);
    float puff = smoothstep(0.35, 0.75, n);
    vec3 c = mix(uShadow, uLit, puff);
    // a soft moonlit sheen and a darker band just inside the rim for depth
    float r = length(vWorld);
    c *= mix(1.0, 0.75, smoothstep(uRadius * 0.7, uRadius, r));
    c += uLit * 0.15 * step(0.995, hash(cell + floor(uTime)));
    gl_FragColor = vec4(c, 1.0);
  }
`;

function CloudSea({ radius, theme }: { radius: number; theme: WorldTheme }) {
  const ref = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRadius: { value: radius }, uShadow: { value: new THREE.Color() }, uLit: { value: new THREE.Color() } }),
    [radius],
  );
  // The shader writes its colour straight out, so take the hex values as-is
  // (no sRGB -> linear conversion).
  const shadow = useMemo(() => new THREE.Color().setStyle(theme.seaShadow, THREE.LinearSRGBColorSpace), [theme.seaShadow]);
  const lit = useMemo(() => new THREE.Color().setStyle(theme.seaLit, THREE.LinearSRGBColorSpace), [theme.seaLit]);
  const started = useRef(false);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    m.uniforms.uTime.value = s.clock.elapsedTime;
    // snap on the first frame, then ease toward a newly picked theme
    const k = started.current ? 0.08 : 1;
    started.current = true;
    (m.uniforms.uShadow.value as THREE.Color).lerp(shadow, k);
    (m.uniforms.uLit.value as THREE.Color).lerp(lit, k);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} raycast={() => null}>
      <circleGeometry args={[radius + 1, 128]} />
      <shaderMaterial ref={ref} vertexShader={seaVertex} fragmentShader={seaFragment} uniforms={uniforms} />
    </mesh>
  );
}

type Puff = { x: number; y: number; z: number; s: number; h: number; c: string };

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
  return `#${((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0")}`;
}

/** Puffy rim + layered underside, as big soft blocks. */
function buildPuffs(radius: number, theme: WorldTheme): Puff[] {
  const rng = rngFor("cloud");
  const out: Puff[] = [];
  const R = radius + 1;
  // Rim: big puffs bulging out of and over the edge of the cloud sea.
  const rimCount = Math.ceil((Math.PI * 2 * R) / 2.6);
  for (let i = 0; i < rimCount; i++) {
    const a = (i / rimCount) * Math.PI * 2 + rng() * 0.05;
    const r = R + (rng() - 0.35) * 4;
    const s = 3 + rng() * 4;
    // billows: some puffs rise well above the cloud sea, so the edge reads as fluffy, not as a band
    const rise = rng() < 0.35 ? 1 + rng() * 2.5 : rng() * 1.2;
    out.push({ x: Math.cos(a) * r, y: -1 + rise, z: Math.sin(a) * r, s, h: s * (0.6 + rng() * 0.5), c: shade(theme.cloudRim, (rng() - 0.3) * 0.25) });
    if (rng() > 0.45) {
      const s2 = 2 + rng() * 3;
      const off = (rng() - 0.5) * 3;
      out.push({ x: Math.cos(a) * (r + off), y: rise + 0.6 + rng() * 1.5, z: Math.sin(a) * (r + off), s: s2, h: s2 * 0.75, c: shade(theme.cloudTop, (rng() - 0.3) * 0.2) });
    }
  }
  // Underside: rings that shrink and darken as they go down, like the belly of a cloud.
  const layers = 6;
  for (let k = 1; k <= layers; k++) {
    const t = k / layers;
    const rk = R * (1 - t * 0.82);
    const y = -2.5 - k * 3.4;
    const count = Math.max(10, Math.ceil((Math.PI * 2 * rk) / 3.4));
    const base = shade(theme.cloudBelly, -t * 0.55);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.08 + k * 0.3;
      const r = rk + (rng() - 0.5) * 4;
      const s = 4 + rng() * 5 * (1 - t * 0.4);
      out.push({ x: Math.cos(a) * r, y: y + (rng() - 0.5) * 2, z: Math.sin(a) * r, s, h: s * 0.8, c: shade(base, (rng() - 0.5) * 0.2) });
    }
  }
  return out;
}

const tmp = new THREE.Object3D();
const col = new THREE.Color();

function CloudPuffs({ radius, theme }: { radius: number; theme: WorldTheme }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(() => buildPuffs(radius, theme), [radius, theme]);
  const group = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    puffs.forEach((p, i) => {
      tmp.position.set(p.x, p.y - p.h / 2, p.z);
      tmp.scale.set(p.s, p.h, p.s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      mesh.setColorAt(i, col.set(p.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [puffs]);
  // a very slow bob, so the whole cloud feels like it is floating
  useFrame((s) => {
    if (group.current) group.current.position.y = Math.sin(s.clock.elapsedTime * 0.25) * 0.15;
  });
  return (
    <group ref={group}>
      <instancedMesh key={puffs.length} ref={ref} args={[voxelGeometry(), undefined, puffs.length]} receiveShadow raycast={() => null}>
        <meshStandardMaterial map={noiseTexture()} roughness={1} metalness={0} />
      </instancedMesh>
    </group>
  );
}

export function CloudBase({ radius }: { radius: number }) {
  const theme = useWorldTheme();
  return (
    <>
      <CloudSea radius={radius} theme={theme} />
      <CloudPuffs radius={radius} theme={theme} />
    </>
  );
}
