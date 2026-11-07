import type * as THREE from "three";

// Shared between the R3F scene (writer) and the DOM label layer (reader), so
// labels are plain DOM nodes instead of one React root per label.
export const cameraBus: { camera: THREE.Camera | null; width: number; height: number } = {
  camera: null,
  width: 1,
  height: 1,
};

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __cameraBus: typeof cameraBus }).__cameraBus = cameraBus;
}
