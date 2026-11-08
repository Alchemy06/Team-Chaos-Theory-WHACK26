import type { Emotion, WorkKind } from "@/lib/types";
import { EMOTION_COLOR, EMOTION_WALL, WORK_KIND_COLOR, WORLD } from "./palette";
import { rngFor } from "./rng";

// Pure voxel model builders. Each returns a list of unit cubes in local space
// (y = 0 is the ground surface, x/z centred on the footprint). `g` marks
// emissive voxels (windows, beacons) that render unlit and feed the bloom.

export type Voxel = { x: number; y: number; z: number; c: string; g?: boolean };

export type VoxelModel = { voxels: Voxel[]; height: number };

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function mix(a: string, b: string, t: number): string {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((na >> s) & 255) * (1 - t) + ((nb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

function box(
  out: Voxel[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  color: (x: number, y: number, z: number) => string | null,
  hollow = true,
) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1 || y === y1;
        if (hollow && !edge) continue;
        const c = color(x, y, z);
        if (c) out.push({ x, y, z, c });
      }
}

/** A dream tower. height = intensity, lit windows = recency (0..1). */
export function dreamTower(id: string, emotion: Emotion, height: number, recency: number): VoxelModel {
  const rng = rngFor(id);
  const wall = EMOTION_WALL[emotion];
  const accent = EMOTION_COLOR[emotion];
  const v: Voxel[] = [];
  const top = height - 1;

  // Plinth
  box(v, -1, 1, 0, 0, -1, 1, () => shade("#2a2d40", (rng() - 0.5) * 0.2), false);

  for (let y = 1; y <= top; y++) {
    const belt = y % 4 === 0;
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++) {
        const corner = Math.abs(x) === 1 && Math.abs(z) === 1;
        const face = !corner && (Math.abs(x) === 1 || Math.abs(z) === 1);
        if (!corner && !face) {
          if (y === top) v.push({ x, y, z, c: shade(wall, -0.25) });
          continue;
        }
        if (face && !belt && y > 1 && y < top && y % 2 === 0) {
          const lit = rng() < 0.15 + recency * 0.8;
          const warm = rng() > 0.25;
          v.push(
            lit
              ? { x, y, z, c: warm ? WORLD.window : WORLD.windowCool, g: true }
              : { x, y, z, c: WORLD.windowOff },
          );
          continue;
        }
        const base = belt ? shade(accent, -0.35) : corner ? shade(wall, -0.18) : wall;
        v.push({ x, y, z, c: shade(base, (rng() - 0.5) * 0.14) });
      }
  }

  // Roof styles
  const style = Math.floor(rng() * 4);
  const roof = shade(wall, -0.3);
  if (style === 0) {
    // parapet + rooftop light
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) v.push({ x, y: height, z, c: roof });
    v.push({ x: 0, y: height, z: 0, c: accent, g: true });
  } else if (style === 1) {
    // stepped pyramid
    box(v, -1, 1, height, height, -1, 1, () => roof, false);
    v.push({ x: 0, y: height + 1, z: 0, c: shade(roof, 0.1) });
  } else if (style === 2) {
    // spire with glowing tip
    v.push({ x: 0, y: height, z: 0, c: roof });
    v.push({ x: 0, y: height + 1, z: 0, c: roof });
    v.push({ x: 0, y: height + 2, z: 0, c: accent, g: true });
  } else {
    // garden roof
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++)
        if (rng() > 0.35) v.push({ x, y: height, z, c: shade("#2f6b45", (rng() - 0.5) * 0.3) });
  }
  // Every tower carries a glowing cap in its district colour, so each district's skyline reads at a glance.
  const isCap = (q: Voxel) => q.y === top && Math.abs(q.x) === 1 && Math.abs(q.z) === 1;
  const out = v.filter((q) => !isCap(q)); // replace, don't overlap (avoids z-fighting)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) out.push({ x, y: top, z, c: accent, g: true });
  return { voxels: out, height: height + 3 };
}

/** A library building for a book, film, song or game: lower, stone, with a kind motif on each face. */
export function libraryBuilding(id: string, kind: WorkKind, emotion: Emotion, height: number): VoxelModel {
  const rng = rngFor(id);
  const stone = "#3a3e58";
  const accent = WORK_KIND_COLOR[kind];
  const district = EMOTION_COLOR[emotion];
  const v: Voxel[] = [];
  const top = height - 1;
  box(v, -1, 1, 0, 0, -1, 1, () => "#24273a", false);
  for (let y = 1; y <= top; y++)
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++) {
        const shell = Math.abs(x) === 1 || Math.abs(z) === 1 || y === top;
        if (!shell) continue;
        const longFace = (Math.abs(z) === 1 && Math.abs(x) < 1) || (Math.abs(x) === 1 && Math.abs(z) < 1);
        let c = shade(stone, (rng() - 0.5) * 0.12);
        let g = false;
        if (longFace && y > 1 && y < top) {
          if (kind === "book") {
            // book spines: vertical stripes of muted colours
            const spines = ["#c2553f", "#d9a441", "#4f7cc4", "#5e9e6e", "#9b5fc0", accent];
            c = shade(spines[(x + 2 + (z > 0 ? 3 : 0)) % spines.length], -0.15 + (y % 2) * 0.08);
          } else if (kind === "film") {
            if (y === top - 1) {
              c = accent;
              g = rng() > 0.2; // marquee bulbs
            }
          } else if (kind === "song") {
            const bar = 2 + ((x + 7) * 5 + (z > 0 ? 3 : 0)) % Math.max(2, top - 2);
            if (y <= bar) {
              c = mix(accent, district, y / top);
              g = true;
            }
          } else if (kind === "game") {
            if ((x + y) % 2 === 0) c = shade(accent, -0.2);
            else if (y === 2) {
              c = district;
              g = true;
            }
          }
        }
        if (y === top) c = shade(district, -0.45);
        v.push({ x, y, z, c, g: g || undefined });
      }
  // overhanging roof slab and a glowing sign
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) v.push({ x, y: height, z, c: shade(stone, -0.25) });
  v.push({ x: 0, y: height, z: 0, c: district, g: true });
  return { voxels: v, height: height + 1 };
}

/** A landmark obelisk for a "Yours" symbol, crowned by a beacon. */
export function landmarkTower(symbol: string, height: number, color: string): VoxelModel {
  const rng = rngFor(symbol);
  const stone = "#c9c6e6";
  const v: Voxel[] = [];
  const h = Math.round(height);
  box(v, -1, 1, 0, 2, -1, 1, () => shade("#8d8aad", (rng() - 0.5) * 0.15));
  for (let y = 3; y < h; y++) {
    if (y % 5 === 0) {
      for (const [x, z] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) v.push({ x, y, z, c: color, g: true });
      v.push({ x: 0, y, z: 0, c: stone });
    } else {
      v.push({ x: 0, y, z: 0, c: shade(stone, (rng() - 0.5) * 0.12) });
      if (y < h - 3) for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (y % 2) v.push({ x, y, z, c: shade(stone, -0.2) });
    }
  }
  v.push({ x: 0, y: h, z: 0, c: "#ffffff", g: true });
  v.push({ x: 0, y: h + 1, z: 0, c: color, g: true });
  return { voxels: v, height: h + 2 };
}

/** A construction site in the fog: dashed scaffolding plus a crane. */
export function constructionSite(id: string): VoxelModel {
  const rng = rngFor(id);
  const v: Voxel[] = [];
  const pole = WORLD.scaffold;
  const h = 5 + Math.floor(rng() * 3);
  box(v, -1, 1, 0, 0, -1, 1, (x, _y, z) => ((x + z) % 2 === 0 ? "#3a3326" : "#4a3f2a"), false);
  for (let y = 1; y <= h; y++)
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if ((y + x + z) % 2 === 0 || y === h) v.push({ x, y, z, c: pole, g: y === h });
  for (const y of [2, 4]) for (let x = -1; x <= 1; x++) for (const z of [-1, 1]) if (x === 0) v.push({ x, y, z, c: shade(pole, -0.3) });
  // crane
  for (let y = 1; y <= h + 4; y++) v.push({ x: 2, y, z: 2, c: y % 2 ? "#e0b354" : "#7a5f2a" });
  for (let x = -2; x <= 2; x++) v.push({ x, y: h + 4, z: 2, c: "#e0b354" });
  v.push({ x: -2, y: h + 3, z: 2, c: "#e0b354" });
  v.push({ x: 2, y: h + 5, z: 2, c: "#ff5a4f", g: true });
  return { voxels: v, height: h + 6 };
}

export function tree(seed: string, x0: number, z0: number, tint: string): Voxel[] {
  const rng = rngFor(seed);
  const v: Voxel[] = [];
  const trunk = 1 + Math.floor(rng() * 2);
  for (let y = 0; y < trunk; y++) v.push({ x: x0, y, z: z0, c: "#4a3324" });
  const leaf = mix("#1f5a3a", tint, 0.25);
  const tall = rng() > 0.5;
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++) {
      v.push({ x: x0 + x, y: trunk, z: z0 + z, c: shade(leaf, (rng() - 0.5) * 0.3) });
      if (tall && Math.abs(x) + Math.abs(z) < 2) v.push({ x: x0 + x, y: trunk + 1, z: z0 + z, c: shade(leaf, 0.08) });
    }
  v.push({ x: x0, y: trunk + (tall ? 2 : 1), z: z0, c: shade(leaf, 0.15) });
  return v;
}

export function lamp(x0: number, z0: number): Voxel[] {
  return [
    { x: x0, y: 0, z: z0, c: "#2b2f45" },
    { x: x0, y: 1, z: z0, c: "#2b2f45" },
    { x: x0, y: 2, z: z0, c: WORLD.window, g: true },
  ];
}

/** A plank bridge (deck top at ground level), with rails and a coloured lamp at each end. */
export function bridgeVoxels(b: { angle: number; from: { x: number; z: number }; to: { x: number; z: number }; cells: { x: number; z: number }[] }, color: string): Voxel[] {
  const v: Voxel[] = [];
  const nx = -Math.sin(b.angle);
  const nz = Math.cos(b.angle);
  const along = (c: { x: number; z: number }) => (c.x - b.from.x) * Math.cos(b.angle) + (c.z - b.from.z) * Math.sin(b.angle);
  for (const c of b.cells) {
    const side = (c.x - b.from.x) * nx + (c.z - b.from.z) * nz;
    const t = Math.round(along(c));
    v.push({ x: c.x, y: -1, z: c.z, c: t % 2 ? "#5a4130" : "#6b4d37" }); // planks
    if (Math.abs(side) > 0.9) {
      v.push({ x: c.x, y: 0, z: c.z, c: t % 3 === 0 ? "#3b2a1f" : "#4a3627" }); // rail
    }
  }
  // lamps at both ends, on either side
  for (const end of [b.from, b.to])
    for (const s of [-1.6, 1.6]) {
      const x = Math.round(end.x + nx * s);
      const z = Math.round(end.z + nz * s);
      v.push({ x, y: 0, z, c: "#2b2f45" }, { x, y: 1, z, c: "#2b2f45" }, { x, y: 2, z, c: color, g: true });
    }
  return v;
}
