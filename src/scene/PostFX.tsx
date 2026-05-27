"use client";

import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  ToneMapping,
  BrightnessContrast,
  HueSaturation,
} from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";

/**
 * Post-processing stack. SEAM owned by the render/atmosphere agent. Rendered as
 * the LAST child inside <Canvas>.
 *
 * Subtle & painterly — Studio Ghibli, not a sci-fi bloom-bomb. Soft bloom on
 * highlights, a warm whisper of a vignette, a gentle saturation/warmth lift,
 * clean SMAA edges, and ACES filmic tone-mapping last for that filmic warmth.
 *
 * `multisampling={0}` because we use SMAA (MSAA + SMAA conflict).
 */
export function PostFX() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {/* Gentle bloom — only genuinely bright things (sun, lanterns, water
          glints) glow. mipmapBlur is the cheap, soft-falloff path. */}
      <Bloom
        mipmapBlur
        luminanceThreshold={0.9}
        luminanceSmoothing={0.3}
        intensity={0.55}
        radius={0.7}
      />

      {/* A touch more life: very subtle saturation + warmth lift. */}
      <HueSaturation hue={0.0} saturation={0.08} />
      <BrightnessContrast brightness={0.02} contrast={0.04} />

      {/* Soft warm-ish vignette to draw the eye inward. eskil=false = the soft,
          natural falloff. Low darkness so it never reads as a dark frame. */}
      <Vignette
        offset={0.32}
        darkness={0.3}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* Clean anti-aliased edges. */}
      <SMAA />

      {/* ACES filmic tone-mapping LAST. Slight exposure boost (>1 middleGrey)
          for that golden, warm rolloff in the highlights. */}
      <ToneMapping
        mode={ToneMappingMode.ACES_FILMIC}
        middleGrey={0.65}
        averageLuminance={1.0}
      />
    </EffectComposer>
  );
}
