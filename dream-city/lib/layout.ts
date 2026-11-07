// lib/layout.ts (deterministic city generator)
// Turns dreams, works and links into a city. Pure and deterministic:
// the same data always produces the same city, with no randomness.
//
// Grid units are abstract. iso() converts grid (gx, gy) + height z to screen pixels.

import type { Dream, Work, Link, Emotion, SymbolStat } from "./types";

// ---------- tuning knobs ----------
export const EMOTIONS: Emotion[] = ["anger", "apprehension", "sadness", "confusion", "happiness", "wonder"];
export const PLAZA_RADIUS = 3;      // empty circle in the middle
const LANDMARK_RADIUS = 3.8; // landmarks ring just outside the plaza
const LIBRARY_RADIUS = 5.2;  // first ring of library buildings (works)
const LIBRARY_RING_GAP = 1.4;
const LIBRARIES_PER_RING = 4;
export const DREAM_START = 8;       // where dream streets begin
const PLOT_SPACING = 1.6;    // distance between plots along a street
const SIDE_OFFSET = 0.5;     // buildings alternate left/right of the street
const FOOTPRINT = 0.4;       // half-width of a building's square base
const DAY = 24 * 60 * 60 * 1000;
// Up to 4 streets per district is tested; more will start to crowd.

export const TILE = 32;
export function iso(gx: number, gy: number, z = 0) {
  return { sx: (gx - gy) * TILE * 0.866, sy: (gx + gy) * TILE * 0.5 - z };
}

// ---------- output types ----------
export type District = { emotion: Emotion; startAngle: number; endAngle: number };
export type Street = { emotion: Emotion; name: string; angle: number; length: number };
export type PlacedBuilding = {
  id: string;
  kind: "dream" | "work" | "construction";
  emotion: Emotion;
  street?: string;
  gx: number;
  gy: number;
  height: number;   // screen pixels
  recency: number;  // 0 (old) to 1 (new): drives window brightness
  depth: number;    // draw in ascending order so near buildings overlap far ones
};
export type PlacedRoad = { from: string; to: string; strength: number; points: [number, number][] };
export type Landmark = { symbol: string; emotion: Emotion; gx: number; gy: number; depth: number };
export type City = {
  districts: District[];
  streets: Street[];
  buildings: PlacedBuilding[];
  roads: PlacedRoad[];
  landmarks: Landmark[];
};

// ---------- helpers ----------
const polar = (angle: number, r: number): [number, number] => [Math.cos(angle) * r, Math.sin(angle) * r];
const slice = (Math.PI * 2) / EMOTIONS.length;
const districtCentre = (e: Emotion) => EMOTIONS.indexOf(e) * slice + slice / 2;

// ---------- main ----------
export function layoutCity(
  dreams: Dream[],
  works: Work[],
  links: Link[],
  microByEmotion: Record<Emotion, string[]>,
  opts: { now?: number; symbolStats?: SymbolStat[]; recommendations?: Work[] } = {}
): City {
  const now = opts.now ?? Date.now();

  // 1. Districts: one equal wedge per emotion
  const districts: District[] = EMOTIONS.map((emotion, i) => ({
    emotion,
    startAngle: i * slice,
    endAngle: (i + 1) * slice,
  }));

  // 2. Streets: one spoke per micro-emotion, evenly spaced inside its wedge
  const streetAngle = new Map<string, number>();
  const streets: Street[] = [];
  for (const d of districts) {
    const micros = microByEmotion[d.emotion] ?? [];
    micros.forEach((name, j) => {
      const angle = d.startAngle + ((j + 1) * slice) / (micros.length + 1);
      streetAngle.set(`${d.emotion}/${name}`, angle);
      streets.push({ emotion: d.emotion, name, angle, length: DREAM_START });
    });
  }

  const buildings: PlacedBuilding[] = [];
  const place = (b: Omit<PlacedBuilding, "depth">) => buildings.push({ ...b, depth: b.gx + b.gy });

  // 3. Dream buildings: oldest nearest the centre, alternating sides of the street
  const byStreet = new Map<string, Dream[]>();
  for (const dr of dreams) {
    const micros = microByEmotion[dr.primaryEmotion] ?? [];
    const micro = micros.includes(dr.microEmotion) ? dr.microEmotion : micros[0];
    const key = `${dr.primaryEmotion}/${micro}`;
    byStreet.set(key, [...(byStreet.get(key) ?? []), dr]);
  }
  for (const [key, list] of byStreet) {
    const angle = streetAngle.get(key);
    if (angle === undefined) continue;
    const [emotion, street] = key.split("/") as [Emotion, string];
    // Districts with more streets have narrower gaps, so buildings hug their street more closely
    const streetsHere = (microByEmotion[emotion] ?? []).length;
    const gapAtStart = DREAM_START * (slice / (streetsHere + 1));
    const sideOffset = Math.min(SIDE_OFFSET, gapAtStart * 0.2);
    list.sort((a, b) => a.date.localeCompare(b.date));
    list.forEach((dr, i) => {
      // Alternate sides and step half a plot each time, so neighbours are staggered, never side by side
      const dist = DREAM_START + i * (PLOT_SPACING / 2);
      const side = i % 2 === 0 ? 1 : -1;
      const [x, y] = polar(angle, dist);
      const [px, py] = polar(angle + Math.PI / 2, sideOffset * side); // perpendicular nudge
      const ageDays = (now - Date.parse(dr.date)) / DAY;
      place({
        id: dr.id,
        kind: "dream",
        emotion,
        street,
        gx: x + px,
        gy: y + py,
        height: 10 + dr.intensity * 6,
        recency: Math.max(0, Math.min(1, 1 - ageDays / 30)),
      });
      const s = streets.find((st) => st.emotion === emotion && st.name === street);
      if (s) s.length = Math.max(s.length, dist + PLOT_SPACING);
    });
  }

  // 4. Library buildings (works): rings around the plaza, inside their district's wedge
  const placeOnRing = (items: Work[], baseRadius: number, kind: "work" | "construction") => {
    for (const e of EMOTIONS) {
      const mine = items.filter((w) => w.primaryEmotion === e);
      mine.forEach((w, i) => {
        const ring = Math.floor(i / LIBRARIES_PER_RING);
        const posInRing = i % LIBRARIES_PER_RING;
        const countInRing = Math.min(LIBRARIES_PER_RING, mine.length - ring * LIBRARIES_PER_RING);
        const angle = EMOTIONS.indexOf(e) * slice + ((posInRing + 1) * slice) / (countInRing + 1);
        const [gx, gy] = polar(angle, baseRadius + ring * LIBRARY_RING_GAP);
        place({ id: w.id, kind, emotion: e, gx, gy, height: kind === "work" ? 28 : 18, recency: kind === "work" ? 0.6 : 0 });
      });
    }
  };
  placeOnRing(works, LIBRARY_RADIUS, "work");

  // 5. Construction sites (recommendations): just beyond the furthest plot
  const furthest = Math.max(DREAM_START, ...buildings.map((b) => Math.hypot(b.gx, b.gy)));
  if (opts.recommendations?.length) placeOnRing(opts.recommendations, furthest + 2, "construction");

  // 6. Roads: a gentle curve between linked buildings, bowed towards the centre
  const pos = new Map(buildings.map((b) => [b.id, b]));
  const roads: PlacedRoad[] = links
    .filter((l) => pos.has(l.from) && pos.has(l.to))
    .map((l) => {
      const a = pos.get(l.from)!;
      const b = pos.get(l.to)!;
      const mid: [number, number] = [((a.gx + b.gx) / 2) * 0.85, ((a.gy + b.gy) / 2) * 0.85];
      return { from: l.from, to: l.to, strength: l.strength, points: [[a.gx, a.gy], mid, [b.gx, b.gy]] };
    });

  // 7. Landmarks: one per "yours" symbol, in the district where it appears most
  const landmarks: Landmark[] = [];
  const perDistrict = new Map<Emotion, number>();
  for (const stat of opts.symbolStats ?? []) {
    if (stat.label !== "yours") continue;
    const counts = new Map<Emotion, number>();
    for (const dr of dreams) if (dr.symbols.includes(stat.symbol)) counts.set(dr.primaryEmotion, (counts.get(dr.primaryEmotion) ?? 0) + 1);
    const home = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "wonder";
    const n = perDistrict.get(home) ?? 0;
    perDistrict.set(home, n + 1);
    // Spread towers within the district: alternate sides of its centre line and two radii
    const angle = districtCentre(home) + (n % 2 === 0 ? 1 : -1) * Math.ceil(n / 2) * 0.3;
    const [gx, gy] = polar(angle, LANDMARK_RADIUS + (n % 2) * 0.8);
    landmarks.push({ symbol: stat.symbol, emotion: home, gx, gy, depth: gx + gy });
  }

  buildings.sort((a, b) => a.depth - b.depth);
  return { districts, streets, buildings, roads, landmarks };
}

// ---------- rendering helper: the three visible faces of a building ----------
// Returns SVG polygon point strings. Fill top lightest, left mid, right darkest.
export function prismFaces(gx: number, gy: number, height: number, half = FOOTPRINT) {
  const pt = (x: number, y: number, z: number) => {
    const p = iso(x, y, z);
    return `${p.sx},${p.sy}`;
  };
  const [x0, x1, y0, y1] = [gx - half, gx + half, gy - half, gy + half];
  return {
    top: [pt(x0, y0, height), pt(x1, y0, height), pt(x1, y1, height), pt(x0, y1, height)].join(" "),
    left: [pt(x0, y1, 0), pt(x1, y1, 0), pt(x1, y1, height), pt(x0, y1, height)].join(" "),
    right: [pt(x1, y1, 0), pt(x1, y0, 0), pt(x1, y0, height), pt(x1, y1, height)].join(" "),
  };
}
