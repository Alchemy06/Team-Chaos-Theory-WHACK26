import type { Emotion, HonestyLabel } from "./types";

export const NIGHT = "#070b18";

export const EMOTION_COLORS: Record<Emotion, string> = {
  anger: "#f0545c",
  apprehension: "#9d7bff",
  sadness: "#3d8bff",
  confusion: "#19c2b0",
  happiness: "#f5b942",
  wonder: "#ec6fe0",
};

export const EMOTION_LABELS: Record<Emotion, string> = {
  anger: "Anger",
  apprehension: "Apprehension",
  sadness: "Sadness",
  confusion: "Confusion",
  happiness: "Happiness",
  wonder: "Wonder",
};

export const LABEL_COLORS: Record<HonestyLabel, string> = {
  yours: "#f5b942",
  common: "#8b93a7",
  too_early: "#5b6275",
  no_baseline: "#5b6275",
};

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Blend colour a towards colour b by t (0 = a, 1 = b).
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
