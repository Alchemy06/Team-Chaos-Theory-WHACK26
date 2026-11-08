import type { Emotion } from "@/lib/types";
import { PLAZA_R, cellKey as key, type WorldCity } from "./cityGeometry";
import { EMOTION_COLOR, EMOTION_GROUND, WORLD } from "./palette";
import { rngFor } from "./rng";
import { lamp, tree, type Voxel } from "./voxel";

// Pure terrain + prop generation from the world city (no React / three).
// Island variant: ground exists only on island land; water fills the rest.

function hexMix(a: string, b: string, t: number) {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((na >> s) & 255) * (1 - t) + ((nb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

function jitter(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `#${((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0")}`;
}

/** The emotion island a cell belongs to (centre and water fall back to the nearest district wedge). */
export function emotionAt(city: WorldCity, x: number, z: number): Emotion {
  const owner = city.land.get(key(x, z));
  if (owner && owner !== "centre") return owner;
  let a = Math.atan2(z, x);
  if (a < 0) a += Math.PI * 2;
  return city.districts.find((d) => a >= d.startAngle && a < d.endAngle)?.emotion ?? city.districts[0].emotion;
}

export type GroundTile = { x: number; z: number; y: number; c: string };

const SAND = "#6b5f45";
const PATH = "#5d6178";
const RING = "#8a7440";

export function buildGround(city: WorldCity): GroundTile[] {
  const rng = rngFor("ground");
  const tiles: GroundTile[] = [];
  for (const [k, owner] of city.land) {
    const [x, z] = k.split(",").map(Number);
    const r = Math.hypot(x, z);
    const shore = !city.land.has(key(x + 1, z)) || !city.land.has(key(x - 1, z)) || !city.land.has(key(x, z + 1)) || !city.land.has(key(x, z - 1));
    let c: string;
    if (owner === "centre" && r <= PLAZA_R + 0.5) {
      c = jitter(Math.round(r) % 2 === 0 ? WORLD.plaza : WORLD.plazaAccent, (rng() - 0.5) * 0.12);
    } else if (city.ringCells.has(k)) {
      c = jitter(RING, (rng() - 0.5) * 0.18); // the gold ring road: main boulevard
    } else if (city.pathCells.has(k)) {
      c = jitter((x + z) % 2 === 0 ? PATH : hexMix(PATH, "#000000", 0.12), (rng() - 0.5) * 0.12); // cobbled path
    } else if (shore) {
      c = jitter(SAND, (rng() - 0.5) * 0.2);
    } else if (owner === "centre") {
      c = jitter(rng() > 0.5 ? WORLD.grass : WORLD.grassAlt, (rng() - 0.5) * 0.18);
    } else {
      const tint = EMOTION_GROUND[owner];
      const base = rng() > 0.5 ? WORLD.grass : WORLD.grassAlt;
      const ground = hexMix(base, tint, 0.88);
      const speck = rng() < 0.035 ? hexMix(ground, EMOTION_COLOR[owner], 0.35) : ground;
      c = jitter(speck, (rng() - 0.5) * 0.18);
    }
    tiles.push({ x, z, y: 0, c });
  }
  return tiles;
}

export function buildProps(city: WorldCity): Voxel[] {
  const blocked = new Set<string>();
  const block = (cx: number, cz: number, hw: number, hd: number) => {
    for (let x = cx - hw; x <= cx + hw; x++) for (let z = cz - hd; z <= cz + hd; z++) blocked.add(key(x, z));
  };
  const footprints = new Set<string>();
  for (const b of city.buildings) {
    block(b.pos.x, b.pos.z, 3, 3);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) footprints.add(key(b.pos.x + x, b.pos.z + z));
  }
  for (const l of city.landmarks) {
    block(l.pos.x, l.pos.z, 3, 3);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) footprints.add(key(l.pos.x + x, l.pos.z + z));
  }
  for (const k of [...city.pathCells, ...city.ringCells]) {
    const [x, z] = k.split(",").map(Number);
    block(x, z, 1, 1);
  }
  for (const b of city.bridges) for (const c of b.cells) block(c.x, c.z, 1, 1);

  const out: Voxel[] = [];
  // Street lamps, offset to one side, only on land and never inside a footprint
  for (const s of city.streets)
    s.cells.forEach((c, i) => {
      if (i < 3 || i % 7 !== 3) return;
      const px = Math.round(c.x - Math.sin(s.angle) * 1.4);
      const pz = Math.round(c.z + Math.cos(s.angle) * 1.4);
      if (footprints.has(key(px, pz)) || !city.land.has(key(px, pz))) return;
      out.push(...lamp(px, pz));
      block(px, pz, 1, 1);
    });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    out.push(...lamp(Math.round(Math.cos(a) * (PLAZA_R - 0.5)), Math.round(Math.sin(a) * (PLAZA_R - 0.5))));
  }

  // A few trees on each island, a little denser near the shores.
  const rng = rngFor("props");
  for (const [k] of city.land) {
    const [x, z] = k.split(",").map(Number);
    if (Math.hypot(x, z) < PLAZA_R + 2) continue;
    const nearShore = !city.land.has(key(x + 2, z)) || !city.land.has(key(x - 2, z)) || !city.land.has(key(x, z + 2)) || !city.land.has(key(x, z - 2));
    if (rng() > (nearShore ? 0.03 : 0.01)) continue;
    if (blocked.has(k)) continue;
    // keep the whole canopy on land
    if (!city.land.has(key(x + 1, z)) || !city.land.has(key(x - 1, z)) || !city.land.has(key(x, z + 1)) || !city.land.has(key(x, z - 1))) continue;
    out.push(...tree(`t${x},${z}`, x, z, EMOTION_GROUND[emotionAt(city, x, z)]));
    block(x, z, 2, 2);
  }
  return out;
}
