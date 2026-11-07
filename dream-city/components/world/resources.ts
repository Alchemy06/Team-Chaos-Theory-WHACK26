import * as THREE from "three";

// Shared GPU resources for every voxel mesh. Created lazily on the client.

let boxGeo: THREE.BoxGeometry | null = null;
let tileGeo: THREE.BoxGeometry | null = null;
let noiseTex: THREE.DataTexture | null = null;
let glowMat: THREE.MeshBasicMaterial | null = null;

export function voxelGeometry() {
  return (boxGeo ??= new THREE.BoxGeometry(1, 1, 1));
}

export function roadTileGeometry() {
  return (tileGeo ??= new THREE.BoxGeometry(0.92, 0.14, 0.92));
}

/** 8x8 grain texture, nearest-filtered, for the Minecraft-like block surface. */
export function noiseTexture() {
  if (noiseTex) return noiseTex;
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  let seed = 1337;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    const edge = i % size === 0 || Math.floor(i / size) === 0;
    const v = Math.round((edge ? 196 : 222) + rand() * 33);
    data.set([v, v, v, 255], i * 4);
  }
  noiseTex = new THREE.DataTexture(data, size, size);
  noiseTex.magFilter = THREE.NearestFilter;
  noiseTex.minFilter = THREE.NearestFilter;
  noiseTex.colorSpace = THREE.SRGBColorSpace;
  noiseTex.needsUpdate = true;
  return noiseTex;
}

export function createSolidMaterial() {
  return new THREE.MeshStandardMaterial({
    map: noiseTexture(),
    roughness: 0.92,
    metalness: 0,
    emissive: new THREE.Color("#000000"),
  });
}

/** Unlit, HDR-bright material for windows, beacons and signs (feeds bloom). */
export function glowMaterial() {
  if (glowMat) return glowMat;
  glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.75, 1.75, 1.75), toneMapped: false });
  return glowMat;
}
