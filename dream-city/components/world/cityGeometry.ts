// Adapter: turns the backend's deterministic 2D layout (lib/layout.ts) into
// voxel-grid geometry for the 3D world. Pure TypeScript, no React or three.

import type { City } from "@/lib/layout";
import { DREAM_START, PLAZA_RADIUS } from "@/lib/layout";
import { STRONG_STRENGTH } from "@/lib/link";
import type { Dream, Emotion, SymbolStat, Work } from "@/lib/types";

/** Grid units in lib/layout.ts -> voxels. */
export const SCALE = 4;
export const PLAZA_R = PLAZA_RADIUS * SCALE;
const WEAK = 0.45; // below this a road is drawn dotted

export type Vec2 = { x: number; z: number };

export type WDistrict = { emotion: Emotion; startAngle: number; endAngle: number; midAngle: number; labelPos: Vec2 };
export type WStreet = { id: string; emotion: Emotion; micro: string; name: string; angle: number; cells: Vec2[]; labelPos: Vec2 };
export type WBuilding = {
  id: string;
  kind: "dream" | "work" | "construction";
  emotion: Emotion;
  street?: string;
  pos: Vec2;
  footprint: { w: number; d: number };
  height: number; // voxels
  recency: number;
  order: number;
};
export type WRoad = { id: string; from: string; to: string; strength: number; bright: boolean; dotted: boolean; cells: Vec2[] };
export type WLandmark = { symbol: string; emotion: Emotion; pos: Vec2; height: number };
export type WorldCity = {
  districts: WDistrict[];
  streets: WStreet[];
  buildings: WBuilding[];
  roads: WRoad[];
  boulevard: { symbol: string; cells: Vec2[]; buildingIds: string[] } | null;
  landmarks: WLandmark[];
  radius: number;
};

const key = (x: number, z: number) => `${x},${z}`;
const polar = (r: number, a: number): Vec2 => ({ x: r * Math.cos(a), z: r * Math.sin(a) });
const snap = (gx: number, gy: number): Vec2 => ({ x: Math.round(gx * SCALE), z: Math.round(gy * SCALE) });
const SUFFIX = ["Street", "Lane", "Row", "Way"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function streetLabel(micro: string, index: number) {
  return `${cap(micro)} ${SUFFIX[index % SUFFIX.length]}`;
}

export function dreamHeight(intensity: number) {
  return Math.round(3 + intensity * 1.25);
}

function lineCells(a: Vec2, b: Vec2): Vec2[] {
  const out: Vec2[] = [];
  const seen = new Set<string>();
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(a.x + ((b.x - a.x) * i) / n);
    const z = Math.round(a.z + ((b.z - a.z) * i) / n);
    if (!seen.has(key(x, z))) {
      seen.add(key(x, z));
      out.push({ x, z });
    }
  }
  return out;
}

/** Quadratic bezier rasterised to 4-connected voxel cells. */
function curveCells(a: Vec2, ctrl: Vec2, b: Vec2): Vec2[] {
  const n = Math.max(2, Math.ceil((Math.hypot(b.x - a.x, b.z - a.z) + 1) * 2.5));
  const out: Vec2[] = [];
  const seen = new Set<string>();
  let prev: Vec2 | null = null;
  const push = (p: Vec2) => {
    if (!seen.has(key(p.x, p.z))) {
      seen.add(key(p.x, p.z));
      out.push(p);
    }
  };
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const p = {
      x: Math.round(u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x),
      z: Math.round(u * u * a.z + 2 * u * t * ctrl.z + t * t * b.z),
    };
    if (prev && prev.x !== p.x && prev.z !== p.z) push({ x: p.x, z: prev.z });
    push(p);
    prev = p;
  }
  return out;
}

export function toWorldCity(
  city: City,
  data: { dreams: Map<string, Dream>; works: Map<string, Work>; recommendations: Map<string, Work>; stats: SymbolStat[] },
): WorldCity {
  const districts: WDistrict[] = city.districts.map((d) => {
    const mid = (d.startAngle + d.endAngle) / 2;
    return { emotion: d.emotion, startAngle: d.startAngle, endAngle: d.endAngle, midAngle: mid, labelPos: polar((DREAM_START - 1) * SCALE, mid) };
  });

  const perDistrict = new Map<Emotion, number>();
  const streets: WStreet[] = city.streets.map((s) => {
    const i = perDistrict.get(s.emotion) ?? 0;
    perDistrict.set(s.emotion, i + 1);
    const end = s.length * SCALE;
    return {
      id: `${s.emotion}/${s.name}`,
      emotion: s.emotion,
      micro: s.name,
      name: streetLabel(s.name, i),
      angle: s.angle,
      cells: lineCells(polar(PLAZA_R + 1, s.angle), polar(end, s.angle)),
      labelPos: polar(end + 2, s.angle),
    };
  });

  // Chronological order drives the intro "city assembles" stagger.
  const dated = city.buildings
    .map((b) => ({ b, date: data.dreams.get(b.id)?.date ?? data.works.get(b.id)?.consumedOn ?? "9999" }))
    .sort((p, q) => p.date.localeCompare(q.date) || p.b.id.localeCompare(q.b.id));
  const orderOf = new Map(dated.map((x, i) => [x.b.id, i]));

  const buildings: WBuilding[] = city.buildings.map((b) => {
    const dream = data.dreams.get(b.id);
    const height = b.kind === "dream" ? dreamHeight(dream?.intensity ?? 5) : b.kind === "work" ? 5 + Math.round(((data.works.get(b.id)?.rating ?? 3) - 1) / 2) : 6;
    return {
      id: b.id,
      kind: b.kind,
      emotion: b.emotion,
      street: b.street ? `${b.emotion}/${b.street}` : undefined,
      pos: snap(b.gx, b.gy),
      footprint: { w: 3, d: 3 },
      height,
      recency: b.recency,
      order: orderOf.get(b.id) ?? 0,
    };
  });
  const byId = new Map(buildings.map((b) => [b.id, b]));

  const roads: WRoad[] = city.roads.map((r) => {
    const [a, mid, b] = r.points;
    const A = byId.get(r.from)?.pos ?? snap(a[0], a[1]);
    const B = byId.get(r.to)?.pos ?? snap(b[0], b[1]);
    return {
      id: `${r.from}->${r.to}`,
      from: r.from,
      to: r.to,
      strength: r.strength,
      bright: r.strength >= STRONG_STRENGTH,
      dotted: r.strength < WEAK,
      cells: curveCells(A, { x: mid[0] * SCALE, z: mid[1] * SCALE }, B),
    };
  });

  const statBy = new Map(data.stats.map((s) => [s.symbol, s]));
  const landmarks: WLandmark[] = city.landmarks.map((l) => ({
    symbol: l.symbol,
    emotion: l.emotion,
    pos: snap(l.gx, l.gy),
    height: 14 + Math.min(10, (statBy.get(l.symbol)?.count ?? 3) * 1.5),
  }));

  // Main boulevard: the symbol linking the most buildings across districts
  // (presentation only, derived from the same data as the roads).
  let boulevard: WorldCity["boulevard"] = null;
  {
    let best: { symbol: string; ids: string[]; score: number } | null = null;
    for (const s of data.stats) {
      if (s.label === "too_early") continue;
      const ids = buildings
        .filter((b) => (b.kind === "dream" ? data.dreams.get(b.id)?.symbols : b.kind === "work" ? data.works.get(b.id)?.symbols : undefined)?.includes(s.symbol))
        .map((b) => b.id);
      if (ids.length < 3) continue;
      const dreamsN = ids.filter((id) => byId.get(id)!.kind === "dream").length;
      const spread = new Set(ids.map((id) => byId.get(id)!.emotion)).size;
      const score = dreamsN * 3 + (ids.length - dreamsN) + spread * 2;
      if (!best || score > best.score || (score === best.score && s.symbol < best.symbol)) best = { symbol: s.symbol, ids, score };
    }
    if (best) {
      const pts = best.ids.map((id) => byId.get(id)!.pos).sort((p, q) => Math.atan2(p.z, p.x) - Math.atan2(q.z, q.x));
      const cells: Vec2[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const ctrl = { x: ((a.x + b.x) / 2) * 0.55, z: ((a.z + b.z) / 2) * 0.55 };
        for (const c of curveCells(a, ctrl, b))
          for (const d of [c, { x: c.x + 1, z: c.z }]) {
            if (Math.hypot(d.x, d.z) <= PLAZA_R + 0.5 || seen.has(key(d.x, d.z))) continue;
            seen.add(key(d.x, d.z));
            cells.push(d);
          }
      }
      boulevard = { symbol: best.symbol, cells, buildingIds: best.ids };
    }
  }

  const radius = Math.max(PLAZA_R + 10, ...buildings.map((b) => Math.hypot(b.pos.x, b.pos.z) + 3));
  return { districts, streets, buildings, roads, boulevard, landmarks, radius };
}
