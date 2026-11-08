"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldTheme } from "@/store/useTheme";
import type { WorldCity } from "./cityGeometry";
import { glowMaterial } from "./resources";
import { rngFor } from "./rng";

// Small touches that make the city feel lived-in and warm: lit windows that
// breathe, fireflies drifting between the buildings, and a soft glow on the
// ground wherever the pointer rests.

/** Every glowing voxel (windows, lanterns, caps) shares one material: let it breathe slowly. */
function WindowBreath() {
  useFrame((s) => {
    const breath = Math.sin((s.clock.elapsedTime / 14) * Math.PI * 2);
    glowMaterial().color.setScalar(1.72 + breath * 0.17);
  });
  return null;
}

const fireflyVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  varying float vAlpha;
  void main() {
    float t = uTime;
    vec3 p = position + vec3(
      sin(t * 0.21 + aSeed * 6.0) * 1.4,
      sin(t * 0.37 + aSeed * 11.0) * 0.6,
      cos(t * 0.17 + aSeed * 3.0) * 1.4
    );
    // slow, uneven blinking: each firefly glows for a while, then rests
    float blink = sin(t * (0.6 + fract(aSeed * 7.3) * 0.7) + aSeed * 40.0);
    vAlpha = smoothstep(-0.2, 0.9, blink);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.6 + 0.4 * vAlpha);
  }
`;

const fireflyFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.18, 0.0, d);
    float a = (glow * 0.55 + core) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * (1.0 + core), a);
  }
`;

const FIREFLIES = 70;

function Fireflies({ city }: { city: WorldCity }) {
  const color = useWorldTheme().sparkleWarm;
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const geometry = useMemo(() => {
    const homes = city.buildings.filter((b) => b.kind !== "construction");
    const rng = rngFor("fireflies");
    const pos = new Float32Array(FIREFLIES * 3);
    const seed = new Float32Array(FIREFLIES);
    for (let i = 0; i < FIREFLIES; i++) {
      const home = homes.length ? homes[i % homes.length].pos : { x: 0, z: 0 };
      const a = rng() * Math.PI * 2;
      const r = 1.8 + rng() * 2.2;
      pos[i * 3] = home.x + Math.cos(a) * r;
      pos[i * 3 + 1] = 1 + rng() * 3;
      pos[i * 3 + 2] = home.z + Math.sin(a) * r;
      seed[i] = rng();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [city]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 8 }, uColor: { value: new THREE.Color() } }), []);
  useFrame((s) => {
    const m = mat.current;
    if (!m) return;
    m.uniforms.uTime.value = s.clock.elapsedTime;
    // grow a little as the camera zooms in, so they stay visible but never blobby
    m.uniforms.uSize.value = Math.min(18, 5 + camera.zoom * 0.45) * s.gl.getPixelRatio();
    (m.uniforms.uColor.value as THREE.Color).set(color);
  });
  return (
    <points geometry={geometry} frustumCulled={false} raycast={() => null}>
      <shaderMaterial
        ref={mat}
        vertexShader={fireflyVertex}
        fragmentShader={fireflyFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** A soft warm light that follows the pointer across the ground and fades when it leaves. */
function CursorGlow() {
  const color = useWorldTheme().sparkleWarm;
  const light = useRef<THREE.PointLight>(null);
  const inside = useRef(false);
  const gl = useThree((s) => s.gl);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const el = gl.domElement;
    const enter = () => (inside.current = true);
    const leave = () => (inside.current = false);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl]);
  useFrame((s, dt) => {
    const l = light.current;
    if (!l) return;
    s.raycaster.setFromCamera(s.pointer, s.camera);
    const on = inside.current && s.raycaster.ray.intersectPlane(plane, hit) !== null;
    const k = Math.min(1, dt * 8);
    if (on) l.position.lerp(hit.setY(2.2), k);
    l.intensity += ((on ? 7 : 0) - l.intensity) * Math.min(1, dt * 4);
  });
  return <pointLight ref={light} color={color} intensity={0} distance={11} decay={1.6} position={[0, 2.2, 0]} />;
}

export function Cosy({ city }: { city: WorldCity }) {
  return (
    <>
      <WindowBreath />
      <Fireflies city={city} />
      <CursorGlow />
    </>
  );
}
