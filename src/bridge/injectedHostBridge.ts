import type { ScannedFile, SourceRoot } from '@/core/types';

import type { PreviewerHostApi } from './global';
import type { PreviewerBridge, ScanResult } from './types';

function toRoot(path: string): SourceRoot {
  const label = path.split(/[\\/]/).filter(Boolean).pop() ?? path;

  return { path, label };
}

/**
 * Bridge over a host API injected on `window`. The desktop build does not use it — Tauri
 * has its own bridge — it exists for the dev filesystem host, which stands in for a real
 * host while iterating in a plain browser tab.
 */
export function createInjectedHostBridge(host: PreviewerHostApi): PreviewerBridge {
  return {
    kind: 'dev',
    platform: host.platform,
    canReopenByPath: true,

    async pickDirectory() {
      const path = await host.pickDirectory();

      return path ? toRoot(path) : null;
    },

    async reopen(path: string) {
      const resolved = await host.reopen(path);

      return resolved ? toRoot(resolved) : null;
    },

    scan(root: SourceRoot): Promise<ScanResult> {
      return host.scan(root.path);
    },

    readBytes(file: ScannedFile): Promise<Uint8Array> {
      return host.readFile(file.path);
    },

    recentRoots() {
      return host.recentRoots();
    },

    async initialRoot() {
      const path = await host.initialRoot();

      return path ? toRoot(path) : null;
    },

    onHostCommand(handler) {
      return host.onCommand(handler);
    },
  };
}
