"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCityStore } from "@/store/useCityStore";
import type { Vec2, WRoad } from "./cityGeometry";
import { WORLD } from "./palette";

// Links are thin, smooth, glowing curves (not voxels), so they read as
// connections rather than more objects in the city. Each vertex carries its
// position along the curve (aT) and its distance from the plaza (aR) so the
// shader can animate a travelling pulse, reveal the line progressively, dash
// weak links, fade near the centre and brighten on hover / selection.

/** Links fade toward the plaza inside this radius (≈ the library ring). */
const FADE_RADIUS = 30;

const vertex = /* glsl */ `
  attribute float aT;
  attribute float aR;
  uniform float uGrow;
  varying float vT;
  varying float vR;
  void main() {
    vT = aT;
    vR = aR;
    // focus mode thickens a link by pushing its surface outward along the tube normal
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uGrow, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uReveal;
  uniform float uStrength;
  uniform float uHighlight;
  uniform float uLength;
  uniform float uInner;
  uniform float uDashed;
  uniform float uDim;
  uniform float uOutline;
  varying float vT;
  varying float vR;
  void main() {
    if (vT > uReveal) discard;
    if (uDashed > 0.5 && fract(vT * uLength / 1.6) > 0.55) discard;
    // Outline pass: a dark sleeve behind the line, so it separates from the busy city underneath.
    if (uOutline > 0.5) {
      gl_FragColor = vec4(0.012, 0.016, 0.04, mix(0.75, 0.0, uDim));
      return;
    }
    float wave = fract(vT * uLength / 9.0 - uTime * 0.4);
    float pulse = smoothstep(0.0, 0.1, wave) * (1.0 - smoothstep(0.1, 0.3, wave));
    // Quiet at rest, fading toward the plaza; hover/selection brings a link back to full strength.
    float centre = mix(0.65, 1.0, smoothstep(uInner * 0.45, uInner, vR));
    float rest = (0.62 + 0.3 * uStrength + pulse * 0.4) * centre;
    float lit = 1.0 + pulse * 1.2;
    vec3 c = uColor * mix(rest, lit, uHighlight);
    float head = smoothstep(uReveal - 0.03, uReveal, vT) * step(uReveal, 0.999);
    // dimmed links fade out (transparent) rather than turning into dark wires
    float alpha = mix(1.0, 0.12, uDim);
    gl_FragColor = vec4(c + uColor * head * 1.2, alpha);
  }
`;

/** Tube along a smooth curve, with per-vertex aT (0..1 along) and aR (distance from centre). */
function buildTube(curve: THREE.Curve<THREE.Vector3>, length: number, radius: number) {
  const segments = Math.max(16, Math.ceil(length * 3));
  const radial = 5;
  const g = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const pos = g.getAttribute("position");
  const aT = new Float32Array(pos.count);
  const aR = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    aT[i] = Math.floor(i / (radial + 1)) / segments;
    aR[i] = Math.hypot(pos.getX(i), pos.getZ(i));
  }
  g.setAttribute("aT", new THREE.BufferAttribute(aT, 1));
  g.setAttribute("aR", new THREE.BufferAttribute(aR, 1));
  return g;
}

function Link({
  curve,
  color,
  strength,
  highlight,
  dimmed = false,
  radius,
  dashed = false,
  revealDelay = 0,
  revealSpeed = 1.1,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  color: string;
  strength: number;
  highlight: boolean;
  dimmed?: boolean;
  radius: number;
  dashed?: boolean;
  revealDelay?: number;
  revealSpeed?: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const outlineRef = useRef<THREE.ShaderMaterial>(null);
  const born = useRef(-1);
  const length = useMemo(() => curve.getLength(), [curve]);
  const geometry = useMemo(() => buildTube(curve, length, radius), [curve, length, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uStrength: { value: strength },
      uHighlight: { value: 0 },
      uLength: { value: length },
      uInner: { value: FADE_RADIUS },
      uDashed: { value: dashed ? 1 : 0 },
      uGrow: { value: 0 },
      uDim: { value: 0 },
      uOutline: { value: 0 },
    }),
    // Values are kept current through matRef in useFrame; the object is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const outlineUniforms = useMemo(
    () => ({
      ...THREE.UniformsUtils.clone(uniforms),
      uOutline: { value: 1 },
      uGrow: { value: radius * 0.9 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state, dt) => {
    const m = matRef.current;
    if (!m) return;
    const u = m.uniforms;
    if (born.current < 0) born.current = performance.now() + revealDelay;
    u.uTime.value = state.clock.elapsedTime;
    u.uLength.value = length;
    u.uStrength.value = strength;
    u.uDashed.value = dashed ? 1 : 0;
    (u.uColor.value as THREE.Color).set(color);
    const since = (performance.now() - born.current) / 1000;
    u.uReveal.value = since <= 0 ? 0 : Math.min(1, (since * revealSpeed * 30) / Math.max(length, 30));
    const k = Math.min(1, dt * 8);
    u.uHighlight.value += ((highlight ? 1 : 0) - u.uHighlight.value) * k;
    u.uDim.value += ((dimmed ? 1 : 0) - u.uDim.value) * k;
    u.uGrow.value += ((highlight ? radius * 1.2 : 0) - u.uGrow.value) * k;
    const o = outlineRef.current?.uniforms;
    if (o) {
      o.uReveal.value = u.uReveal.value;
      o.uDim.value = u.uDim.value;
      o.uDashed.value = u.uDashed.value;
      o.uLength.value = length;
      o.uGrow.value = u.uGrow.value + radius * 0.9;
    }
  });

  return (
    <>
      <mesh geometry={geometry} raycast={() => null} renderOrder={-1}>
        <shaderMaterial
          ref={outlineRef}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={outlineUniforms}
          toneMapped={false}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh geometry={geometry} raycast={() => null}>
        <shaderMaterial
          ref={matRef}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          toneMapped={false}
          transparent
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

/** Links lie along their path, just above the ground tiles (never z-fighting with them). */
const LINK_Y = 0.35;
const onPath = (path: Vec2[]) => path.map((p) => new THREE.Vector3(p.x, LINK_Y, p.z));

/** The id the user is focusing on (hover wins over selection), if it is something links attach to. */
function focusId(s: { hoverId: string | null; selection: { kind: string; id?: string } | null }) {
  const id = s.hoverId ?? (s.selection && "id" in s.selection ? s.selection.id : null);
  return id && !id.startsWith("landmark:") && id !== "plaza" ? id : null;
}

export const Road = memo(function Road({ road, delay, linked }: { road: WRoad; delay: number; linked: Set<string> }) {
  // Focus mode: links of the hovered/selected building light up and thicken; all others dim.
  const state = useCityStore((s) => {
    const f = focusId(s);
    if (!f || !linked.has(f)) return "idle"; // focusing something without links leaves the web as it is
    return road.from === f || road.to === f ? "focus" : "dim";
  });
  const curve = useMemo(() => new THREE.CatmullRomCurve3(onPath(road.path), false, "centripetal"), [road.path]);
  const isMedia = road.to.startsWith("w"); // dream -> work road (dream -> dream roads are recurring patterns)
  const color = isMedia ? (road.bright ? "#ffd27a" : "#d9a75a") : "#9db2ff";
  return (
    <Link
      curve={curve}
      color={color}
      strength={road.strength}
      highlight={state === "focus"}
      dimmed={state === "dim"}
      radius={road.bright ? 0.18 : 0.13}
      dashed={road.dotted}
      revealDelay={delay}
    />
  );
});

/** The main boulevard: a smooth gold ring along the central island's ring road. */
export function Boulevard({ anchors }: { anchors: Vec2[] }) {
  // Sits on the ring road; steps back while a building is in focus.
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        anchors.map((p) => new THREE.Vector3(p.x, LINK_Y - 0.05, p.z)),
        true,
        "centripetal",
      ),
    [anchors],
  );
  const focused = useCityStore((s) => focusId(s) !== null);
  if (anchors.length < 3) return null;
  return (
    <Link
      curve={curve}
      color={WORLD.boulevard}
      strength={0.6}
      highlight={false}
      dimmed={focused}
      radius={0.22}
      revealSpeed={0.5}
      revealDelay={600}
    />
  );
}
