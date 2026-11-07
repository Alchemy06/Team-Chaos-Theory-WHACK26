import { EMOTION_COLORS } from "@/lib/theme";
import type { Emotion, WorkKind } from "@/lib/types";

// 3D palette. Emotion hues come from lib/theme so the world, the HUD and the
// rest of the app always agree; the tints below are darker voxel variants.
export const EMOTION_COLOR: Record<Emotion, string> = EMOTION_COLORS;

export const EMOTION_GROUND: Record<Emotion, string> = {
  anger: "#4a1e26",
  apprehension: "#2f2252",
  sadness: "#172c5a",
  confusion: "#123f3b",
  happiness: "#4a3a17",
  wonder: "#4a1c47",
};

export const EMOTION_WALL: Record<Emotion, string> = {
  anger: "#7d2e35",
  apprehension: "#46348a",
  sadness: "#244a94",
  confusion: "#1b6b64",
  happiness: "#80652a",
  wonder: "#73306f",
};

export const WORK_KIND_COLOR: Record<WorkKind, string> = {
  book: "#e9d7a6",
  film: "#c9d3e6",
  song: "#b8f0d8",
  game: "#f6b7a0",
};

export const WORLD = {
  plaza: "#4a4f6a",
  plazaAccent: "#7d84a8",
  street: "#2f3450",
  grass: "#132018",
  grassAlt: "#17291d",
  wild: "#0c1424",
  boulevard: "#ffd27a",
  window: "#ffd98a",
  windowCool: "#9fd0ff",
  windowOff: "#1a1f33",
  scaffold: "#ff9d3b",
};
