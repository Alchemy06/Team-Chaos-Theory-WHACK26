import { EMOTION_COLORS } from "@/lib/theme";
import type { Emotion, WorkKind } from "@/lib/types";

// 3D palette. Emotion hues come from lib/theme so the world, the HUD and the
// rest of the app always agree; the tints below are darker voxel variants.
export const EMOTION_COLOR: Record<Emotion, string> = EMOTION_COLORS;

export const EMOTION_GROUND: Record<Emotion, string> = {
  anger: "#3a1d24",
  apprehension: "#271d42",
  sadness: "#16264a",
  confusion: "#123634",
  happiness: "#3a2f18",
  wonder: "#3a1a3a",
};

export const EMOTION_WALL: Record<Emotion, string> = {
  anger: "#6b2d32",
  apprehension: "#3f3270",
  sadness: "#24407a",
  confusion: "#1e5a56",
  happiness: "#6e5a2c",
  wonder: "#5e2c5e",
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
