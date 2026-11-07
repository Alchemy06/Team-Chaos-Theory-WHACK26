"use client";

// Draws the city as an isometric SVG: districts, streets, roads, buildings, landmarks and fog.
// Pan by dragging, zoom with the wheel or the buttons. Click anything to select it.

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactElement } from "react";
import { DREAM_START, EMOTIONS, PLAZA_RADIUS, iso, prismFaces, type City, type PlacedBuilding } from "@/lib/layout";
import { EMOTION_COLORS, EMOTION_LABELS, NIGHT, mix } from "@/lib/theme";
import type { Selection } from "@/lib/types";

type Props = {
  city: City;
  titles: Record<string, string>;
  centreLabel: string;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
};

type Pt = [number, number];
const P = (gx: number, gy: number, z = 0): Pt => {
  const p = iso(gx, gy, z);
  return [p.sx, p.sy];
};
const pts = (list: Pt[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const polar = (a: number, r: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];

// Deterministic hash, so window patterns and particles never change between renders.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DREAM_HALF = 0.4;
const WORK_HALF = 0.58;
const LANDMARK_HEIGHT = 78;

function windowsFor(b: PlacedBuilding, half: number, color: string): ReactElement[] {
  const out: ReactElement[] = [];
  const rows = Math.max(1, Math.floor((b.height - 8) / 9));
  const glass = mix(color, "#ffffff", 0.55);
  for (let r = 0; r < rows; r++) {
    const z0 = 5 + r * 9;
    const z1 = z0 + 4.5;
    for (let c = 0; c < 2; c++) {
      const u0 = c === 0 ? 0.18 : 0.58;
      const u1 = u0 + 0.24;
      for (const face of ["L", "R"] as const) {
        const lit = hash(`${b.id}-${r}-${c}-${face}`) % 5 !== 0;
        const opacity = lit ? 0.3 + 0.7 * b.recency : 0.07;
        const q: Pt[] =
          face === "L"
            ? [
                P(b.gx - half + u0 * 2 * half, b.gy + half, z0),
                P(b.gx - half + u1 * 2 * half, b.gy + half, z0),
                P(b.gx - half + u1 * 2 * half, b.gy + half, z1),
                P(b.gx - half + u0 * 2 * half, b.gy + half, z1),
              ]
            : [
                P(b.gx + half, b.gy + half - u0 * 2 * half, z0),
                P(b.gx + half, b.gy + half - u1 * 2 * half, z0),
                P(b.gx + half, b.gy + half - u1 * 2 * half, z1),
                P(b.gx + half, b.gy + half - u0 * 2 * half, z1),
              ];
        out.push(<polygon key={`${face}${r}${c}`} points={pts(q)} fill={glass} opacity={opacity} />);
      }
    }
  }
  return out;
}

function Building({ b, active }: { b: PlacedBuilding; active: boolean }) {
  const color = EMOTION_COLORS[b.emotion];
  const edge = active ? "#ffffff" : mix(color, NIGHT, 0.25);
  const edgeWidth = active ? 1.4 : 0.5;

  if (b.kind === "construction") {
    const f = prismFaces(b.gx, b.gy, b.height, DREAM_HALF);
    const style = { fill: "none", stroke: color, strokeWidth: active ? 1.4 : 0.9, strokeDasharray: "3 3" };
    return (
      <g opacity={active ? 1 : 0.8}>
        <polygon points={f.left} {...style} />
        <polygon points={f.right} {...style} />
        <polygon points={f.top} {...style} />
      </g>
    );
  }

  if (b.kind === "work") {
    const f = prismFaces(b.gx, b.gy, b.height, WORK_HALF);
    const band = prismFaces(b.gx, b.gy, b.height * 0.62, WORK_HALF);
    return (
      <g>
        <polygon points={f.left} fill={mix(color, NIGHT, 0.5)} stroke={edge} strokeWidth={edgeWidth} />
        <polygon points={f.right} fill={mix(color, NIGHT, 0.66)} stroke={edge} strokeWidth={edgeWidth} />
        <polygon points={band.top} fill="none" stroke={mix(color, "#ffffff", 0.4)} strokeWidth={0.6} opacity={0.6} />
        <polygon points={f.top} fill={color} stroke={edge} strokeWidth={edgeWidth} filter="url(#glow)" />
      </g>
    );
  }

  const f = prismFaces(b.gx, b.gy, b.height, DREAM_HALF);
  return (
    <g>
      <polygon points={f.left} fill={mix(color, NIGHT, 0.7)} stroke={edge} strokeWidth={edgeWidth} />
      <polygon points={f.right} fill={mix(color, NIGHT, 0.82)} stroke={edge} strokeWidth={edgeWidth} />
      <g filter="url(#glow)">{windowsFor(b, DREAM_HALF, color)}</g>
      <polygon points={f.top} fill={mix(color, NIGHT, 0.38)} stroke={edge} strokeWidth={edgeWidth} />
    </g>
  );
}

export default function CityView({ city, titles, centreLabel, selection, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);
  const moved = useRef(false);

  // Geometry that only changes when the city changes
  const geo = useMemo(() => {
    const radii = [
      DREAM_START + 2,
      ...city.buildings.map((b) => Math.hypot(b.gx, b.gy)),
      ...city.streets.map((s) => s.length),
    ];
    const R = Math.max(...radii) + 1.6;
    const ring = (r: number, a0 = 0, a1 = Math.PI * 2, n = 48): Pt[] =>
      Array.from({ length: n + 1 }, (_, i) => {
        const [x, y] = polar(a0 + ((a1 - a0) * i) / n, r);
        return P(x, y);
      });
    const outer = ring(R + 1.2);
    const xs = outer.map((p) => p[0]);
    const ys = outer.map((p) => p[1]);
    const minX = Math.min(...xs) - 60;
    const maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 130;
    const maxY = Math.max(...ys) + 50;
    const particles = Array.from({ length: 60 }, (_, i) => {
      const h = hash(`p${i}`);
      return {
        x: minX + ((h % 1000) / 1000) * (maxX - minX),
        y: minY + (((h >>> 10) % 1000) / 1000) * (maxY - minY),
        r: 0.6 + ((h >>> 20) % 10) / 10,
        delay: (h % 4000) / 1000,
      };
    });
    return { R, ring, minX, minY, width: maxX - minX, height: maxY - minY, particles };
  }, [city]);

  // Wheel zoom around the cursor (non-passive so the page doesn't scroll)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(ctm.inverse());
      setView((v) => {
        const k = Math.min(4, Math.max(0.6, v.k * Math.exp(-e.deltaY * 0.0015)));
        return { k, x: p.x - (p.x - v.x) * (k / v.k), y: p.y - (p.y - v.y) * (k / v.k) };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) =>
    setView((v) => {
      const cx = geo.minX + geo.width / 2;
      const cy = geo.minY + geo.height / 2;
      const k = Math.min(4, Math.max(0.6, v.k * factor));
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) };
    });

  const pick = (s: Selection) => (e: MouseEvent) => {
    e.stopPropagation();
    if (!moved.current) onSelect(s);
  };

  const activeId = hover ?? selection?.id ?? null;
  const kindById = useMemo(() => new Map(city.buildings.map((b) => [b.id, b.kind])), [city]);
  const ground = city.buildings.filter((b) => b.kind !== "construction");
  const construction = city.buildings.filter((b) => b.kind === "construction");
  const hovered = hover ? city.buildings.find((b) => b.id === hover) : undefined;
  const ringRoad = DREAM_START - 1.2;

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        viewBox={`${geo.minX} ${geo.minY} ${geo.width} ${geo.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Dream city map"
        style={{ cursor: "grab" }}
        onPointerDown={(e) => {
          drag.current = { sx: e.clientX, sy: e.clientY, x: view.x, y: view.y };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) moved.current = true;
          if (!moved.current) return;
          const scale = svgRef.current?.getScreenCTM()?.a ?? 1;
          setView((v) => ({ ...v, x: d.x + (e.clientX - d.sx) / scale, y: d.y + (e.clientY - d.sy) / scale }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
        onClick={() => {
          if (!moved.current) onSelect(null);
        }}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient
            id="fog"
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r={geo.R * 32 * 0.866 * Math.SQRT2 * 1.1}
            gradientTransform={`scale(1 ${0.5 / 0.866})`}
          >
            <stop offset="0.7" stopColor={NIGHT} stopOpacity="0" />
            <stop offset="0.9" stopColor={NIGHT} stopOpacity="0.45" />
            <stop offset="1" stopColor={NIGHT} stopOpacity="0.9" />
          </radialGradient>
        </defs>

        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* Stars and drifting particles */}
          {geo.particles.map((p, i) => (
            <circle key={i} className="twinkle" cx={p.x} cy={p.y} r={p.r} fill="#c9d4ff" style={{ animationDelay: `${p.delay}s` }} />
          ))}

          {/* Districts: one wedge per emotion */}
          {city.districts.map((d) => {
            const color = EMOTION_COLORS[d.emotion];
            const outer = geo.ring(geo.R, d.startAngle, d.endAngle, 16);
            const inner = geo.ring(PLAZA_RADIUS + 0.3, d.startAngle, d.endAngle, 16).reverse();
            return (
              <polygon
                key={d.emotion}
                points={pts([...outer, ...inner])}
                fill={color}
                fillOpacity={0.07}
                stroke={color}
                strokeOpacity={0.28}
                strokeWidth={0.8}
              />
            );
          })}

          {/* Ring road and streets */}
          <polygon points={pts(geo.ring(ringRoad))} fill="none" stroke="#1a2240" strokeWidth={6} />
          {city.streets.map((s) => {
            const [x0, y0] = polar(s.angle, ringRoad);
            const [x1, y1] = polar(s.angle, s.length);
            const a = P(x0, y0);
            const b = P(x1, y1);
            return (
              <g key={`${s.emotion}/${s.name}`}>
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#1a2240" strokeWidth={6} strokeLinecap="round" />
                <line
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  stroke={mix(EMOTION_COLORS[s.emotion], NIGHT, 0.45)}
                  strokeWidth={0.8}
                  strokeDasharray="3 5"
                />
              </g>
            );
          })}

          {/* Plaza */}
          <polygon points={pts(geo.ring(PLAZA_RADIUS))} fill="#121a33" stroke="#2b3763" strokeWidth={1} />
          <text x={0} y={4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#cfd8ff" letterSpacing={2}>
            {centreLabel.toUpperCase()}
          </text>

          {/* Roads between linked buildings */}
          {city.roads.map((r) => {
            const [a, m, b] = r.points.map(([x, y]) => P(x, y, 1.5));
            const isActive = activeId !== null && (r.from === activeId || r.to === activeId);
            const dreamToDream = kindById.get(r.to) === "dream";
            const strong = r.strength >= 0.6;
            return (
              <path
                key={`${r.from}-${r.to}`}
                d={`M${a[0]} ${a[1]} Q${m[0]} ${m[1]} ${b[0]} ${b[1]}`}
                fill="none"
                className={dreamToDream ? undefined : "road-flow"}
                stroke={dreamToDream ? "#8b93a7" : strong ? "#a9e4ff" : "#6fa8d6"}
                strokeWidth={(isActive ? 1.2 : 0.6) + 1.6 * r.strength}
                strokeDasharray={dreamToDream ? "2 4" : undefined}
                opacity={activeId === null ? 0.25 + 0.45 * r.strength : isActive ? 0.95 : 0.08}
                filter={isActive ? "url(#glow)" : undefined}
              />
            );
          })}

          {/* Buildings, far to near */}
          {ground.map((b, i) => (
            <g
              key={b.id}
              className="rise building"
              style={{ animationDelay: `${i * 28}ms` }}
              onPointerEnter={() => setHover(b.id)}
              onPointerLeave={() => setHover((h) => (h === b.id ? null : h))}
              onClick={pick({ kind: b.kind === "work" ? "work" : "dream", id: b.id })}
            >
              <Building b={b} active={activeId === b.id} />
            </g>
          ))}

          {/* Landmarks: symbols that are yours */}
          {city.landmarks.map((l, i) => {
            const color = EMOTION_COLORS[l.emotion];
            const height = LANDMARK_HEIGHT + (i % 2) * 14; // staggered so labels don't collide
            const f = prismFaces(l.gx, l.gy, height, 0.2);
            const top = P(l.gx, l.gy, height + 10);
            const label = P(l.gx, l.gy, height + 22);
            const active = selection?.kind === "landmark" && selection.id === l.symbol;
            return (
              <g key={l.symbol} className="building" onClick={pick({ kind: "landmark", id: l.symbol })}>
                <polygon points={f.left} fill={mix(color, NIGHT, 0.55)} stroke={active ? "#fff" : "none"} />
                <polygon points={f.right} fill={mix(color, NIGHT, 0.7)} stroke={active ? "#fff" : "none"} />
                <polygon points={f.top} fill={color} />
                <circle className="pulse" cx={top[0]} cy={top[1]} r={4} fill={color} filter="url(#glow)" />
                <text x={label[0]} y={label[1]} textAnchor="middle" fontSize={9} fontWeight={600} fill={mix(color, "#ffffff", 0.5)}>
                  {l.symbol}
                </text>
              </g>
            );
          })}

          {/* Fog over the outskirts */}
          <rect x={geo.minX - 400} y={geo.minY - 400} width={geo.width + 800} height={geo.height + 800} fill="url(#fog)" pointerEvents="none" />

          {/* Construction sites: unexplored territory in the fog */}
          {construction.map((b) => (
            <g
              key={b.id}
              className="building"
              onPointerEnter={() => setHover(b.id)}
              onPointerLeave={() => setHover((h) => (h === b.id ? null : h))}
              onClick={pick({ kind: "construction", id: b.id })}
            >
              <Building b={b} active={activeId === b.id} />
            </g>
          ))}

          {/* District and street labels */}
          {city.districts.map((d) => {
            const [x, y] = polar((d.startAngle + d.endAngle) / 2, geo.R + 0.9);
            const p = P(x, y);
            return (
              <text
                key={d.emotion}
                x={p[0]}
                y={p[1]}
                textAnchor="middle"
                fontSize={15}
                fontWeight={700}
                letterSpacing={4}
                fill={EMOTION_COLORS[d.emotion]}
                opacity={0.85}
                pointerEvents="none"
              >
                {EMOTION_LABELS[d.emotion].toUpperCase()}
              </text>
            );
          })}
          {city.streets.map((s) => {
            const [x, y] = polar(s.angle, s.length + 0.7);
            const p = P(x, y);
            return (
              <text
                key={`${s.emotion}/${s.name}-label`}
                x={p[0]}
                y={p[1] + 3}
                textAnchor="middle"
                fontSize={7.5}
                fill={mix(EMOTION_COLORS[s.emotion], "#ffffff", 0.35)}
                opacity={0.75}
                pointerEvents="none"
              >
                {s.name.charAt(0).toUpperCase() + s.name.slice(1)} St
              </text>
            );
          })}

          {/* Hover label */}
          {hovered && titles[hovered.id] && (() => {
            const p = P(hovered.gx, hovered.gy, hovered.height + 14);
            const text = titles[hovered.id];
            const w = Math.min(260, 12 + text.length * 5.2);
            return (
              <g pointerEvents="none">
                <rect x={p[0] - w / 2} y={p[1] - 13} width={w} height={18} rx={5} fill="#0c1226" stroke="#33406e" />
                <text x={p[0]} y={p[1] - 1} textAnchor="middle" fontSize={9} fill="#e6ebff">
                  {text.length > 48 ? `${text.slice(0, 47)}…` : text}
                </text>
              </g>
            );
          })()}
        </g>
      </svg>

      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        {[
          { label: "+", on: () => zoomBy(1.25) },
          { label: "−", on: () => zoomBy(0.8) },
          { label: "⟲", on: () => setView({ x: 0, y: 0, k: 1 }) },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={btn.on}
            className="h-8 w-8 rounded-md border border-white/15 bg-[#0c1226]/80 text-slate-200 hover:bg-[#18213f]"
            aria-label={btn.label === "+" ? "Zoom in" : btn.label === "−" ? "Zoom out" : "Reset view"}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-2 text-xs">
        {EMOTIONS.map((e) => (
          <span key={e} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0c1226]/80 px-2.5 py-1 text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ background: EMOTION_COLORS[e] }} />
            {EMOTION_LABELS[e]}
          </span>
        ))}
      </div>
    </div>
  );
}
