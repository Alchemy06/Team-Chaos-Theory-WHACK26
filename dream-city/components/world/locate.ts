import type { UISelection } from "@/store/useCityStore";
import type { Vec2, WorldCity } from "./cityGeometry";

function island(city: WorldCity, emotion: string) {
  const i = city.islands.find((x) => x.emotion === emotion);
  return i ? { pos: i.center, top: 4, w: i.radius * 2, d: i.radius * 2 } : null;
}

/** World position + top height for a selection or a hover id. */
export function locate(city: WorldCity, target: UISelection | string | null): { pos: Vec2; top: number; w: number; d: number } | null {
  if (!target) return null;
  if (typeof target === "string") {
    if (target === "plaza") return { pos: { x: 0, z: 0 }, top: 6, w: 7, d: 7 };
    if (target.startsWith("landmark:")) return locate(city, { kind: "landmark", id: target.slice(9) });
    if (target.startsWith("island:")) return island(city, target.slice(7));
    const b = city.buildings.find((x) => x.id === target);
    return b ? { pos: b.pos, top: b.height + 3, w: b.footprint.w, d: b.footprint.d } : null;
  }
  if (target.kind === "plaza") return { pos: { x: 0, z: 0 }, top: 6, w: 7, d: 7 };
  if (target.kind === "island") return island(city, target.id);
  if (target.kind === "landmark") {
    const l = city.landmarks.find((x) => x.symbol === target.id);
    return l ? { pos: l.pos, top: l.height + 2, w: 3, d: 3 } : null;
  }
  const b = city.buildings.find((x) => x.id === target.id);
  return b ? { pos: b.pos, top: b.height + 3, w: b.footprint.w, d: b.footprint.d } : null;
}
