"use client";

import { Bloom, EffectComposer, Pixelation, Vignette } from "@react-three/postprocessing";

export function Effects({ bloom, pixelation }: { bloom: boolean; pixelation: boolean }) {
  if (!bloom && !pixelation) return null;
  // Separate composers per combination keep the pass list static.
  if (bloom && pixelation)
    return (
      <EffectComposer multisampling={0} key="bp">
        <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.9} luminanceSmoothing={0.2} radius={0.7} />
        <Pixelation granularity={3} />
        <Vignette offset={0.32} darkness={0.72} />
      </EffectComposer>
    );
  if (bloom)
    return (
      <EffectComposer multisampling={0} key="b">
        <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.9} luminanceSmoothing={0.2} radius={0.7} />
        <Vignette offset={0.32} darkness={0.72} />
      </EffectComposer>
    );
  return (
    <EffectComposer multisampling={0} key="p">
      <Pixelation granularity={3} />
      <Vignette offset={0.32} darkness={0.72} />
    </EffectComposer>
  );
}
