import type { LoadedAsset } from '@/core/loadSpine';
import { PreviewStage } from '@/core/stage';

/**
 * One stage for the whole app. Panels reach it directly instead of threading a ref through
 * React, because every control here is imperative by nature — a slider moves a camera, it
 * does not describe one.
 */
export const stage = new PreviewStage();

let current: LoadedAsset | null = null;

/** Swaps the previewed asset and releases the textures the previous one held. */
export function mountAsset(loaded: LoadedAsset | null): void {
  // Order matters: the Spine object must go before its atlas textures are disposed.
  stage.setSpine(loaded?.spine ?? null);
  current?.atlas.dispose();
  current = loaded;
}

export function currentAsset(): LoadedAsset | null {
  return current;
}
