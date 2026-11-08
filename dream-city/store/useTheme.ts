"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_THEME, THEMES, themeById, type ThemeId, type WorldTheme } from "@/lib/themes";

type ThemeState = { themeId: ThemeId; setTheme: (id: ThemeId) => void };

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME,
      setTheme: (themeId) => set({ themeId }),
    }),
    {
      name: "dream-city-theme",
      storage: createJSONStorage(() => localStorage),
      // ignore saved ids for themes that no longer exist
      merge: (persisted, current) => {
        const id = (persisted as Partial<ThemeState> | undefined)?.themeId;
        return { ...current, themeId: THEMES.some((t) => t.id === id) ? (id as ThemeId) : current.themeId };
      },
    },
  ),
);

/** The 3D scene colours for the active theme. */
export function useWorldTheme(): WorldTheme {
  return themeById(useThemeStore((s) => s.themeId)).world;
}

/** Mirrors the active theme onto <html data-theme>, which switches the HUD's CSS tokens. */
export function ThemeApplier() {
  const themeId = useThemeStore((s) => s.themeId);
  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeById(themeId).world.background);
  }, [themeId]);
  return null;
}
