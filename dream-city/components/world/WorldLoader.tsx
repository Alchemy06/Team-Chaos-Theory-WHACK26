"use client";

import dynamic from "next/dynamic";

// The WebGL world is client-only: no server rendering of three.js.
const WorldCanvas = dynamic(() => import("./WorldCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center">
      <div className="pixel-loader">
        <span />
        <span />
        <span />
      </div>
    </div>
  ),
});

export function WorldLoader() {
  return (
    <div className="absolute inset-0" aria-label="Interactive 3D voxel map of your dream city">
      <WorldCanvas />
    </div>
  );
}
