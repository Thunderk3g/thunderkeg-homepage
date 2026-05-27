"use client";

/**
 * Post-processing stack. SEAM owned by the render/atmosphere agent. Rendered as
 * the LAST child inside <Canvas>. Stub returns null (no effects) so the scene
 * renders normally until the EffectComposer (bloom, vignette, tone-mapping,
 * SMAA) is implemented.
 */
export function PostFX() {
  return null;
}
