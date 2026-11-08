"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// One large plane under the islands: dark night water with slow, blocky
// ripples (snapped to the voxel grid so it matches the pixel style).

const vertex = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  varying vec2 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 cell = floor(vWorld);
    // calm, dark water: a faint large swell plus thin, broken pixel ripple lines
    float swell = 0.5 + 0.5 * sin(cell.x * 0.12 + uTime * 0.25) * sin(cell.y * 0.1 - uTime * 0.2);
    float line = step(0.93, sin(cell.y * 0.9 + cell.x * 0.15 + uTime * 0.8)) * step(0.45, hash(vec2(floor(cell.x / 3.0), cell.y)));
    float glint = step(0.992, hash(cell + floor(uTime * 0.5)));
    vec3 deep = vec3(0.022, 0.035, 0.09);
    vec3 c = deep * (0.9 + 0.25 * swell) + vec3(0.06, 0.09, 0.18) * line + vec3(0.2, 0.28, 0.5) * glint * 0.3;
    // fade into the night beyond the islands (transparent at the rim, so no edge ever shows)
    float fade = smoothstep(uRadius + 4.0, uRadius + 34.0, length(vWorld));
    gl_FragColor = vec4(c, 1.0 - fade);
  }
`;

export function Water({ radius }: { radius: number }) {
  const ref = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uRadius: { value: radius } }), [radius]);
  useFrame((s) => {
    if (ref.current) ref.current.uniforms.uTime.value = s.clock.elapsedTime;
  });
  const size = radius + 36;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} receiveShadow raycast={() => null}>
      <circleGeometry args={[size, 96]} />
      <shaderMaterial ref={ref} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  );
}
