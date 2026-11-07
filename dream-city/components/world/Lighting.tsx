"use client";

export function Lighting({ radius }: { radius: number }) {
  const r = radius + 12;
  return (
    <>
      <hemisphereLight args={["#5b6fc4", "#0a0e1e", 0.85]} />
      <ambientLight intensity={0.18} color="#8090ff" />
      <directionalLight
        position={[-32, 60, 26]}
        intensity={1.5}
        color="#c4ceff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
        shadow-camera-left={-r}
        shadow-camera-right={r}
        shadow-camera-top={r}
        shadow-camera-bottom={-r}
        shadow-camera-near={1}
        shadow-camera-far={180}
      />
      {/* warm fill from the city glow */}
      <directionalLight position={[30, 14, -30]} intensity={0.25} color="#ff9fd0" />
    </>
  );
}
