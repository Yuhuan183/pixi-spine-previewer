import { createBrowserBridge } from './browserBridge';
import { createInjectedHostBridge } from './injectedHostBridge';
import { createTauriBridge } from './tauriBridge';
import type { PreviewerBridge } from './types';

/**
 * One bridge per page load, picked by whichever host is present: Tauri injects its
 * internals object, the dev filesystem host injects `previewerHost`, and with neither the
 * app is running in a plain browser tab and falls back to File System Access.
 */
export const bridge: PreviewerBridge = '__TAURI_INTERNALS__' in window
  ? createTauriBridge()
  : window.previewerHost
    ? createInjectedHostBridge(window.previewerHost)
    : createBrowserBridge();

export type { PreviewerBridge, ScanResult } from './types';
