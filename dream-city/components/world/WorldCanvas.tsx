"use client";

import { Canvas } from "@react-three/fiber";
import { useCity } from "@/store/useCity";
import { useCityStore } from "@/store/useCityStore";
import { Ambience } from "./Ambience";
import { ConstructionSite, DreamBuilding, LibraryBuilding } from "./Buildings";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { CameraPublisher, LabelLayer } from "./Labels";
import { Landmark } from "./Landmarks";
import { Lighting } from "./Lighting";
import { LinkLayer } from "./LinkLayer";
import { Plaza } from "./Plaza";
import { SelectionMarker } from "./SelectionMarker";
import { Terrain } from "./Terrain";
import { CloudBase } from "./CloudBase";
import { Bridges } from "./Bridges";
import { markWorldMounted } from "./useRise";

function CityScene() {
  const model = useCity();
  const city = model.world;

  return (
    <>
      <Lighting radius={city.radius} />
      <CloudBase radius={city.radius} />
      <Terrain city={city} />
      <Bridges bridges={city.bridges} />
      <Plaza />
      {city.buildings.map((b) => {
        if (!model.visible.has(b.id)) return null;
        if (b.kind === "dream") {
          const dream = model.dreamById.get(b.id);
          return dream ? <DreamBuilding key={b.id} b={b} dream={dream} /> : null;
        }
        if (b.kind === "work") {
          const work = model.workById.get(b.id);
          return work ? <LibraryBuilding key={b.id} b={b} work={work} /> : null;
        }
        return <ConstructionSite key={b.id} b={b} />;
      })}
      {city.landmarks.map((l, i) => (
        <Landmark key={l.symbol} l={l} index={i} />
      ))}
      <SelectionMarker city={city} />
      <CameraPublisher />
      <Ambience radius={city.radius} />
      <CameraRig layout={city} />
    </>
  );
}

function PostFX() {
  const bloom = useCityStore((s) => s.settings.bloom);
  const pixelation = useCityStore((s) => s.settings.pixelation);
  return <Effects bloom={bloom} pixelation={pixelation} />;
}

// Start the intro clock as soon as this client chunk loads.
markWorldMounted();

export default function WorldCanvas() {
  const select = useCityStore((s) => s.select);
  return (
    <>
      <Canvas
        className="!absolute inset-0"
        shadows="percentage"
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        onPointerMissed={() => select(null)}
      >
        {/* Opaque background so the post-processing chain composites correctly */}
        <color attach="background" args={["#070b18"]} />
        <CityScene />
        <PostFX />
      </Canvas>
      <LinkLayer />
      <LabelLayer />
    </>
  );
}
