import type { Emotion } from "@/lib/types";
import { DISTRICT_PUSH, PLAZA_R, SCALE, type WorldCity } from "./cityGeometry";
import { DREAM_START } from "@/lib/layout";
import { EMOTION_COLOR, EMOTION_GROUND, WORLD } from "./palette";
import { rngFor } from "./rng";
import { lamp, tree, type Voxel } from "./voxel";

// Pure terrain + prop generation from the world city (no React / three).

const key = (x: number, z: number) => `${x},${z}`;

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

export function emotionAt(city: WorldCity, x: number, z: number): Emotion {
  let a = Math.atan2(z, x);
  if (a < 0) a += Math.PI * 2;
  return city.districts.find((d) => a >= d.startAngle && a < d.endAngle)?.emotion ?? city.districts[0].emotion;
}

/** Distance (radians-scaled) from the nearest district boundary, for border rows. */
function nearBoundary(city: WorldCity, x: number, z: number) {
  const r = Math.hypot(x, z);
  let a = Math.atan2(z, x);
  if (a < 0) a += Math.PI * 2;
  let best = Infinity;
  for (const d of city.districts) {
    let diff = Math.abs(a - d.startAngle);
    diff = Math.min(diff, Math.PI * 2 - diff);
    best = Math.min(best, diff * r);
  }
  return best;
}

export type GroundTile = { x: number; z: number; y: number; c: string };

export function buildGround(city: WorldCity): GroundTile[] {
  const rng = rngFor("ground");
  const streetCells = new Set<string>();
  for (const s of city.streets) for (const c of s.cells) streetCells.add(key(c.x, c.z));
  const built = city.radius - 4;
  const borderStart = DREAM_START * SCALE + DISTRICT_PUSH - 8; // district seams begin outside the library ring
  const R = Math.ceil(city.radius + 16);
  const tiles: GroundTile[] = [];
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const r = Math.hypot(x, z);
      if (r > R - (rng() * 3 + (Math.sin(Math.atan2(z, x) * 7) + 1) * 1.5)) continue; // ragged island edge
      let c: string;
      let y = 0;
      if (r <= PLAZA_R + 0.5) {
        c = jitter(Math.round(r) % 2 === 0 ? WORLD.plaza : WORLD.plazaAccent, (rng() - 0.5) * 0.12);
      } else if (streetCells.has(key(x, z))) {
        c = jitter(WORLD.street, (rng() - 0.5) * 0.15);
      } else if (r > borderStart && r < built + 2 && nearBoundary(city, x, z) < 0.6) {
        // a dark cobbled seam between districts, so each reads as its own zone
        c = jitter("#0b0f1f", (rng() - 0.5) * 0.2);
      } else {
        const emotion = emotionAt(city, x, z);
        const tint = EMOTION_GROUND[emotion];
        const base = rng() > 0.5 ? WORLD.grass : WORLD.grassAlt;
        const fade = Math.max(0, Math.min(1, (r - built) / 14));
        const inDistrict = r > borderStart;
        // stronger emotion tint inside the districts; the occasional speckle uses the district's own colour
        const ground = hexMix(base, tint, inDistrict ? 0.88 : 0.55);
        const speck = inDistrict && rng() < 0.035 ? hexMix(ground, EMOTION_COLOR[emotion], 0.35) : ground;
        c = jitter(hexMix(speck, WORLD.wild, fade * 0.85), (rng() - 0.5) * 0.18);
        if (r > built + 4) {
          // gentle voxel hills out in the unexplored wild
          const h = Math.sin(x * 0.35) * Math.cos(z * 0.31) + Math.sin((x + z) * 0.17);
          if (h > 0.9) y = 1;
          if (h > 1.45) y = 2;
        }
      }
      tiles.push({ x, z, y, c });
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
  for (const s of city.streets) for (const c of s.cells) block(c.x, c.z, 1, 1);
  for (const r of city.roads) for (const c of r.cells) block(c.x, c.z, 1, 1);
  if (city.boulevard) for (const c of city.boulevard.cells) block(c.x, c.z, 1, 1);

  const out: Voxel[] = [];
  // Street lamps, offset to one side, never inside a footprint
  for (const s of city.streets)
    s.cells.forEach((c, i) => {
      if (i < 8 || i % 7 !== 3) return; // sparse, and none where streets converge near the plaza
      const px = Math.round(c.x - Math.sin(s.angle) * 1.4);
      const pz = Math.round(c.z + Math.cos(s.angle) * 1.4);
      if (footprints.has(key(px, pz))) return;
      out.push(...lamp(px, pz));
      block(px, pz, 1, 1);
    });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    out.push(...lamp(Math.round(Math.cos(a) * (PLAZA_R - 0.5)), Math.round(Math.sin(a) * (PLAZA_R - 0.5))));
  }

  const rng = rngFor("props");
  const R = Math.ceil(city.radius + 10);
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const r = Math.hypot(x, z);
      if (r < PLAZA_R + 3 || r > R - 2) continue;
      if (rng() > (r > city.radius - 2 ? 0.022 : 0.008)) continue; // sparse: a few trees in the city, a light forest at the edge
      if (blocked.has(key(x, z))) continue;
      out.push(...tree(`t${x},${z}`, x, z, EMOTION_GROUND[emotionAt(city, x, z)]));
      block(x, z, 2, 2);
    }
  return out;
}
