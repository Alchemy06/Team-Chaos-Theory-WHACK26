"use client";

import { useMemo } from "react";
import { computeModel, type CityModel } from "./cityModel";
import { useCityStore } from "./useCityStore";

export function useCity(): CityModel {
  const userDreams = useCityStore((s) => s.userDreams);
  const day = useCityStore((s) => s.timelineDay);
  const insights = useCityStore((s) => s.insights);
  return useMemo(() => computeModel(userDreams, day, insights), [userDreams, day, insights]);
}
