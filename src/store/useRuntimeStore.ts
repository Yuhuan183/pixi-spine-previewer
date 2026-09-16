import { create } from 'zustand';

import type { StageStats } from '@/core/stage';

/**
 * Per-frame numbers live apart from the app store on purpose: they change 20 times a
 * second and only the HUD and the timeline subscribe, so nothing else re-renders.
 */
export const useRuntimeStore = create<StageStats>(() => ({
  fps: 0,
  zoom: 1,
  tracks: [],
  bounds: null,
  elapsed: 0,
}));

export function publishStats(stats: StageStats): void {
  useRuntimeStore.setState(stats);
}
