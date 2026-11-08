// Adapter: turns the backend's deterministic 2D layout (lib/layout.ts) into
// voxel-grid geometry for the 3D world. Pure TypeScript, no React or three.
//
// Island variant: each emotion district is lifted out onto its own island,
// joined to a central island (plaza + landmarks + ring road) by a bridge.
// Links are routed along real paths: straight within an island, and via the
// bridges and the ring road between islands.

import type { City } from "@/lib/layout";
import { DREAM_START, PLAZA_RADIUS } from "@/lib/layout";
import { STRONG_STRENGTH } from "@/lib/link";
import type { Dream, Emotion, SymbolStat, Work } from "@/lib/types";
import { hashString } from "./rng";

/** Grid units in lib/layout.ts -> voxels. */
export const SCALE = 4;
export const PLAZA_R = PLAZA_RADIUS * SCALE;
const WEAK = 0.45; // below this a link is drawn dashed
/** Extra outward push (voxels) so emotion districts sit toward the edge and the centre stays calm. */
export const DISTRICT_PUSH = 12;
const LIBRARY_PUSH = 6;
/** How far each emotion island drifts away from the centre (voxels). */
export const ISLAND_GAP = 16;
/** Central island radius and the ring road (main boulevard) that every bridge joins. */
export const CENTRAL_R = PLAZA_R + 11;
export const RING_R = PLAZA_R + 7;
const SHORE = 5; // land margin around everything on an island

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
export type WRoad = {
  id: string;
  from: string;
  to: string;
  strength: number;
  bright: boolean;
  dotted: boolean;
  cells: Vec2[]; // ground path tiles under this link
  path: Vec2[]; // smooth samples along the routed path (with a small lane offset), used for rendering
};
export type WLandmark = { symbol: string; emotion: Emotion; pos: Vec2; height: number };
export type WBridge = { emotion: Emotion; angle: number; from: Vec2; to: Vec2; cells: Vec2[] };
export type WorldCity = {
  districts: WDistrict[];
  streets: WStreet[];
  buildings: WBuilding[];
  roads: WRoad[];
  boulevard: { symbol: string; cells: Vec2[]; anchors: Vec2[]; buildingIds: string[] } | null;
  landmarks: WLandmark[];
  /** land cell key -> emotion island, or "centre" */
  land: Map<string, Emotion | "centre">;
  bridges: WBridge[];
  pathCells: Set<string>;
  ringCells: Set<string>;
  radius: number;
};

export const cellKey = (x: number, z: number) => `${x},${z}`;
const key = cellKey;
const polar = (r: number, a: number): Vec2 => ({ x: r * Math.cos(a), z: r * Math.sin(a) });
const snap = (gx: number, gy: number, push = 0): Vec2 => {
  const r = Math.hypot(gx, gy);
  const k = r > 0 ? (r * SCALE + push) / r : SCALE;
  return { x: Math.round(gx * k), z: Math.round(gy * k) };
};
const pushFor = (kind: "dream" | "work" | "construction") => (kind === "work" ? LIBRARY_PUSH : DISTRICT_PUSH);
const DREAM_R0 = DREAM_START * SCALE + DISTRICT_PUSH;
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

/** Densify a polyline so a Catmull-Rom spline through it follows the straight stretches closely. */
function densify(points: Vec2[], step = 2): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let j = 0; j < n; j++) out.push({ x: a.x + ((b.x - a.x) * j) / n, z: a.z + ((b.z - a.z) * j) / n });
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Shift interior points sideways so links that share a path read as parallel strands. */
function laneOffset(points: Vec2[], offset: number): Vec2[] {
  if (offset === 0) return points;
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    const a = points[i - 1];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    // taper the offset in near the ends so lines still meet their buildings
    const t = Math.min(1, i / 3, (points.length - 1 - i) / 3);
    return { x: p.x - (dz / len) * offset * t, z: p.z + (dx / len) * offset * t };
  });
}

/** A full circle of points (closed loops can't go through arcPoints, which takes the short way round). */
function circlePoints(r: number, step = 2): Vec2[] {
  const n = Math.max(12, Math.ceil((Math.PI * 2 * r) / step));
  return Array.from({ length: n }, (_, i) => polar(r, (Math.PI * 2 * i) / n));
}

/** Points along the shorter arc between two angles. */
function arcPoints(r: number, from: number, to: number): Vec2[] {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const n = Math.max(2, Math.ceil((Math.abs(d) * r) / 2));
  return Array.from({ length: n + 1 }, (_, i) => polar(r, from + (d * i) / n));
}

export function toWorldCity(
  city: City,
  data: { dreams: Map<string, Dream>; works: Map<string, Work>; recommendations: Map<string, Work>; stats: SymbolStat[] },
): WorldCity {
  const midOf = new Map(city.districts.map((d) => [d.emotion, (d.startAngle + d.endAngle) / 2]));
  // Each emotion's island offset: drift along the district's centre angle.
  const shift = (e: Emotion, p: Vec2): Vec2 => {
    const a = midOf.get(e) ?? 0;
    return { x: Math.round(p.x + Math.cos(a) * ISLAND_GAP), z: Math.round(p.z + Math.sin(a) * ISLAND_GAP) };
  };

  const perDistrict = new Map<Emotion, number>();
  const streets: WStreet[] = city.streets.map((s) => {
    const i = perDistrict.get(s.emotion) ?? 0;
    perDistrict.set(s.emotion, i + 1);
    const end = s.length * SCALE + DISTRICT_PUSH;
    return {
      id: `${s.emotion}/${s.name}`,
      emotion: s.emotion,
      micro: s.name,
      name: streetLabel(s.name, i),
      angle: s.angle,
      cells: lineCells(shift(s.emotion, polar(DREAM_R0 - 3, s.angle)), shift(s.emotion, polar(end, s.angle))),
      labelPos: shift(s.emotion, polar(end + 2, s.angle)),
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
      pos: shift(b.emotion, snap(b.gx, b.gy, pushFor(b.kind))),
      footprint: { w: 3, d: 3 },
      height,
      recency: b.recency,
      order: orderOf.get(b.id) ?? 0,
    };
  });
  const byId = new Map(buildings.map((b) => [b.id, b]));

  const statBy = new Map(data.stats.map((s) => [s.symbol, s]));
  // Landmarks stay on the central island, around the plaza.
  const landmarks: WLandmark[] = city.landmarks.map((l) => ({
    symbol: l.symbol,
    emotion: l.emotion,
    pos: snap(l.gx, l.gy),
    height: 9 + Math.min(7, statBy.get(l.symbol)?.count ?? 3),
  }));

  // ---------- land ----------
  const land = new Map<string, Emotion | "centre">();
  const stamp = (c: Vec2, r: number, owner: Emotion | "centre") => {
    const R = Math.ceil(r);
    for (let x = -R; x <= R; x++)
      for (let z = -R; z <= R; z++) {
        if (x * x + z * z > r * r) continue;
        const k = key(Math.round(c.x) + x, Math.round(c.z) + z);
        if (!land.has(k)) land.set(k, owner);
      }
  };
  // Central island first, so it wins where shores meet.
  stamp({ x: 0, z: 0 }, CENTRAL_R, "centre");
  const jitter = (x: number, z: number) => (hashString(`${x},${z}`) % 100) / 100; // organic shoreline
  const islandAnchors = new Map<Emotion, Vec2[]>();
  const addAnchor = (e: Emotion, p: Vec2) => islandAnchors.set(e, [...(islandAnchors.get(e) ?? []), p]);
  for (const b of buildings) addAnchor(b.emotion, b.pos);
  for (const s of streets) for (const c of s.cells.filter((_, i) => i % 2 === 0)) addAnchor(s.emotion, c);

  // Each island gets a landing on its centre line, facing the central island.
  const landing = new Map<Emotion, Vec2>();
  for (const [e, pts] of islandAnchors) {
    const a = midOf.get(e) ?? 0;
    const inner = Math.min(...pts.map((p) => p.x * Math.cos(a) + p.z * Math.sin(a))); // nearest extent along the centre line
    const l = polar(inner - 2, a);
    landing.set(e, { x: Math.round(l.x), z: Math.round(l.z) });
    addAnchor(e, l);
  }
  for (const [e, pts] of islandAnchors) for (const p of pts) stamp(p, SHORE + jitter(p.x, p.z) * 1.6, e);

  // ---------- bridges ----------
  const bridges: WBridge[] = [...landing.entries()].map(([e, l]) => {
    const a = midOf.get(e) ?? 0;
    const from = polar(CENTRAL_R - 1, a);
    const to = { x: l.x, z: l.z };
    const cells: Vec2[] = [];
    const seen = new Set<string>();
    for (const c of lineCells(from, to))
      for (const off of [-1, 0, 1]) {
        const p = { x: Math.round(c.x - Math.sin(a) * off), z: Math.round(c.z + Math.cos(a) * off) };
        if (!seen.has(key(p.x, p.z)) && !land.has(key(p.x, p.z))) {
          seen.add(key(p.x, p.z));
          cells.push(p);
        }
      }
    return { emotion: e, angle: a, from, to, cells };
  });
  const bridgeOf = new Map(bridges.map((b) => [b.emotion, b]));

  // ---------- ring road (main boulevard) ----------
  const ring = circlePoints(RING_R);
  const ringCells = new Set<string>();
  for (let i = 0; i < ring.length; i++) for (const c of lineCells(ring[i], ring[(i + 1) % ring.length])) ringCells.add(key(c.x, c.z));

  // ---------- routed links ----------
  const pathCells = new Set<string>();
  const emotionOf = (id: string): Emotion | null => byId.get(id)?.emotion ?? null;
  const roads: WRoad[] = [];
  city.roads.forEach((r, i) => {
    const A = byId.get(r.from)?.pos;
    const B = byId.get(r.to)?.pos;
    const ea = emotionOf(r.from);
    const eb = emotionOf(r.to);
    if (!A || !B || !ea || !eb) return;
    let waypoints: Vec2[];
    if (ea === eb) {
      waypoints = [A, B];
    } else {
      const ba = bridgeOf.get(ea)!;
      const bb = bridgeOf.get(eb)!;
      waypoints = [A, ba.to, ba.from, polar(RING_R, ba.angle), ...arcPoints(RING_R, ba.angle, bb.angle).slice(1, -1), polar(RING_R, bb.angle), bb.from, bb.to, B];
    }
    const cells: Vec2[] = [];
    for (let j = 0; j < waypoints.length - 1; j++)
      for (const c of lineCells(waypoints[j], waypoints[j + 1])) {
        const k = key(c.x, c.z);
        if (!land.has(k)) continue; // over water the bridge deck carries the path
        cells.push(c);
        if (!ringCells.has(k)) pathCells.add(k);
      }
    const lane = ((i % 5) - 2) * 0.42;
    roads.push({
      id: `${r.from}->${r.to}`,
      from: r.from,
      to: r.to,
      strength: r.strength,
      bright: r.strength >= STRONG_STRENGTH,
      dotted: r.strength < WEAK,
      cells,
      path: laneOffset(densify(waypoints), lane),
    });
  });
  // Streets are paths too.
  for (const s of streets) for (const c of s.cells) if (land.has(key(c.x, c.z))) pathCells.add(key(c.x, c.z));

  // ---------- districts (labels float over each island) ----------
  const districts: WDistrict[] = city.districts.map((d) => {
    const mid = (d.startAngle + d.endAngle) / 2;
    const pts = islandAnchors.get(d.emotion) ?? [polar(DREAM_R0 + ISLAND_GAP, mid)];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    return { emotion: d.emotion, startAngle: d.startAngle, endAngle: d.endAngle, midAngle: mid, labelPos: { x: cx, z: cz } };
  });

  // ---------- main boulevard: the top recurring symbol names the ring road ----------
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
      const anchors = circlePoints(RING_R, 4);
      boulevard = { symbol: best.symbol, cells: [...ringCells].map((k) => ({ x: +k.split(",")[0], z: +k.split(",")[1] })), anchors, buildingIds: best.ids };
    }
  }

  let radius = CENTRAL_R;
  for (const k of land.keys()) {
    const [x, z] = k.split(",").map(Number);
    radius = Math.max(radius, Math.hypot(x, z));
  }
  return { districts, streets, buildings, roads, boulevard, landmarks, land, bridges, pathCells, ringCells, radius: radius + 1 };
}
