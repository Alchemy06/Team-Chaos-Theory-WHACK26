// Colour themes. Each theme sets the HUD's CSS tokens (see app/globals.css,
// where every theme also has a [data-theme] block) and the 3D scene's sky,
// lights, cloud sea and sparkles. Emotion colours stay the same in every
// theme, because they carry meaning on the map.

export type ThemeId = "midnight" | "dusk" | "aurora" | "dawn";

export type WorldTheme = {
  background: string;
  hemiSky: string;
  hemiGround: string;
  ambient: string;
  sun: string;
  fill: string;
  /** Cloud sea: shaded troughs and lit puffs. */
  seaShadow: string;
  seaLit: string;
  /** Voxel cloud rim (lower and upper puffs) and the cloud's underside. */
  cloudRim: string;
  cloudTop: string;
  cloudBelly: string;
  fog: string;
  sparkle: string;
  sparkleWarm: string;
};

export type Theme = {
  id: ThemeId;
  name: string;
  blurb: string;
  /** Swatches for the theme picker. */
  swatch: [string, string, string];
  world: WorldTheme;
};

export const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    blurb: "Deep blue night, gold lamplight",
    swatch: ["#070b1e", "#4a58a8", "#ffd27a"],
    world: {
      background: "#070b18",
      hemiSky: "#5b6fc4",
      hemiGround: "#0a0e1e",
      ambient: "#8090ff",
      sun: "#c4ceff",
      fill: "#ff9fd0",
      seaShadow: "#1f2142",
      seaLit: "#5c6194",
      cloudRim: "#7c84b8",
      cloudTop: "#a3a9d6",
      cloudBelly: "#5d6496",
      fog: "#7d8fd0",
      sparkle: "#d6dcff",
      sparkleWarm: "#ffd98a",
    },
  },
  {
    id: "dusk",
    name: "Lavender Dusk",
    blurb: "Violet twilight, rose clouds, peach glow",
    swatch: ["#1a0d2e", "#7a52a8", "#ffc69a"],
    world: {
      background: "#1a0d2e",
      hemiSky: "#a070d0",
      hemiGround: "#1a0a24",
      ambient: "#c890ff",
      sun: "#ffd6f0",
      fill: "#ff9a8a",
      seaShadow: "#33204f",
      seaLit: "#8a68ad",
      cloudRim: "#a383c4",
      cloudTop: "#d6b8ea",
      cloudBelly: "#7a5a9e",
      fog: "#c49ae0",
      sparkle: "#ffe0f6",
      sparkleWarm: "#ffc69a",
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    blurb: "Northern lights over a teal night",
    swatch: ["#04141b", "#2a8a8a", "#9dffcf"],
    world: {
      background: "#04141b",
      hemiSky: "#3fa8a0",
      hemiGround: "#04100f",
      ambient: "#70ffd8",
      sun: "#c8fff0",
      fill: "#8a9cff",
      seaShadow: "#0f2d33",
      seaLit: "#3f7a80",
      cloudRim: "#5b8f96",
      cloudTop: "#8fc4c4",
      cloudBelly: "#3d6e78",
      fog: "#6fd8c0",
      sparkle: "#c8fff0",
      sparkleWarm: "#9dffcf",
    },
  },
  {
    id: "dawn",
    name: "Rose Dawn",
    blurb: "Half-awake sunrise in pink and amber",
    swatch: ["#2a111c", "#a05566", "#ffd08a"],
    world: {
      background: "#2a111c",
      hemiSky: "#e08aa0",
      hemiGround: "#20080f",
      ambient: "#ffa8b8",
      sun: "#ffe0c8",
      fill: "#ffb070",
      seaShadow: "#3f1d2a",
      seaLit: "#a66a7a",
      cloudRim: "#c48a96",
      cloudTop: "#f0c4c4",
      cloudBelly: "#9a5f72",
      fog: "#f0a8b0",
      sparkle: "#fff0e0",
      sparkleWarm: "#ffd08a",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "midnight";

export const themeById = (id: ThemeId): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];
