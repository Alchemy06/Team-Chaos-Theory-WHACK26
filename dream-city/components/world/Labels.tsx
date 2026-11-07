"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EMOTION_LABELS } from "@/lib/theme";
import { useCity } from "@/store/useCity";
import { useCityStore } from "@/store/useCityStore";
import { cameraBus } from "./cameraBus";
import type { WorldCity } from "./cityGeometry";
import { locate } from "./locate";
import { EMOTION_COLOR } from "./palette";

/** Inside the Canvas: publishes the camera for the DOM label layer and a zoom band for CSS. */
export function CameraPublisher() {
  const last = useRef("");
  useFrame(({ camera, size }) => {
    cameraBus.camera = camera;
    cameraBus.width = size.width;
    cameraBus.height = size.height;
    const z = (camera as THREE.OrthographicCamera).zoom;
    const mode = z > 13 ? "near" : z > 7 ? "mid" : "far";
    if (mode !== last.current) {
      last.current = mode;
      document.documentElement.dataset.zoom = mode;
    }
  });
  return null;
}

type Anchor = { key: string; x: number; y: number; z: number; className: string; text: string; color?: string };

function anchorsFor(city: WorldCity, recTitle: (id: string) => string): Anchor[] {
  const out: Anchor[] = [];
  for (const d of city.districts)
    out.push({ key: `d:${d.emotion}`, x: d.labelPos.x, y: 14, z: d.labelPos.z, className: "district-label", text: EMOTION_LABELS[d.emotion], color: EMOTION_COLOR[d.emotion] });
  for (const s of city.streets) out.push({ key: `s:${s.id}`, x: s.labelPos.x, y: 0.5, z: s.labelPos.z, className: "street-label", text: s.name });
  if (city.boulevard?.cells.length) {
    const c = city.boulevard.cells[Math.floor(city.boulevard.cells.length / 3)];
    const sym = city.boulevard.symbol;
    out.push({ key: "boulevard", x: c.x, y: 0.8, z: c.z, className: "boulevard-label", text: `${sym.charAt(0).toUpperCase() + sym.slice(1)} Boulevard` });
  }
  for (const l of city.landmarks) out.push({ key: `l:${l.symbol}`, x: l.pos.x, y: l.height + 3, z: l.pos.z, className: "landmark-label", text: `★ ${l.symbol}` });
  for (const b of city.buildings)
    if (b.kind === "construction") out.push({ key: `c:${b.id}`, x: b.pos.x, y: 13, z: b.pos.z, className: "site-label", text: `? ${recTitle(b.id)}` });
  return out;
}

const v = new THREE.Vector3();
function project(x: number, y: number, z: number) {
  const cam = cameraBus.camera;
  if (!cam) return null;
  v.set(x, y, z).project(cam);
  if (v.z > 1 || v.z < -1) return null;
  return { sx: (v.x * 0.5 + 0.5) * cameraBus.width, sy: (-v.y * 0.5 + 0.5) * cameraBus.height };
}

function HoverTagContent({ id }: { id: string }) {
  const city = useCity();
  let title = "";
  let sub = "";
  if (id === "plaza") {
    title = "The Plaza";
    sub = "City-wide insights";
  } else if (id.startsWith("landmark:")) {
    title = `★ ${id.slice(9)}`;
    sub = "Landmark · recurring symbol";
  } else if (city.dreamById.has(id)) {
    const d = city.dreamById.get(id)!;
    title = d.summary;
    sub = `${EMOTION_LABELS[d.primaryEmotion]} · ${d.microEmotion}`;
  } else if (city.workById.has(id)) {
    const w = city.workById.get(id)!;
    title = w.title;
    sub = `Library · ${w.kind}`;
  } else if (city.recById.has(id)) {
    title = city.recById.get(id)!.title;
    sub = "Construction site · unexplored";
  }
  return (
    <div className="hover-tag">
      <div className="hover-tag-title">{title.length > 60 ? title.slice(0, 57) + "…" : title}</div>
      <div className="hover-tag-sub">{sub}</div>
    </div>
  );
}

/** DOM overlay: world labels + hover tag, re-positioned every animation frame (no React root per label). */
export function LabelLayer() {
  const model = useCity();
  const city = model.world;
  const show = useCityStore((s) => s.settings.labels);
  const hoverId = useCityStore((s) => s.hoverId);
  const selection = useCityStore((s) => s.selection);
  const anchors = useMemo(() => anchorsFor(city, (id) => model.recById.get(id)?.title ?? ""), [city, model.recById]);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const hoverRef = useRef<HTMLDivElement>(null);
  const hoverHit = hoverId && !(selection && "id" in selection && selection.id === hoverId) ? locate(city, hoverId) : null;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const a of anchors) {
        const el = refs.current.get(a.key);
        if (!el) continue;
        const p = project(a.x, a.y, a.z);
        if (!p) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.visibility = "visible";
        el.style.transform = `translate(${Math.round(p.sx)}px, ${Math.round(p.sy)}px) translate(-50%, -50%)`;
      }
      if (hoverRef.current && hoverHit) {
        const p = project(hoverHit.pos.x, hoverHit.top + 1.5, hoverHit.pos.z);
        if (p) hoverRef.current.style.transform = `translate(${Math.round(p.sx)}px, ${Math.round(p.sy)}px) translate(-50%, -100%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anchors, hoverHit]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
      {show &&
        anchors.map((a) => (
          <div
            key={a.key}
            ref={(el) => {
              if (el) refs.current.set(a.key, el);
              else refs.current.delete(a.key);
            }}
            className={`world-label ${a.className} absolute left-0 top-0`}
            style={{ color: a.color, visibility: "hidden" }}
          >
            {a.text}
          </div>
        ))}
      {hoverId && hoverHit && (
        <div ref={hoverRef} className="absolute left-0 top-0">
          <HoverTagContent id={hoverId} />
        </div>
      )}
    </div>
  );
}
