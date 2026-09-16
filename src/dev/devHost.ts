import type { PreviewerHostApi } from '@/bridge/global';
import type { ScanResult } from '@/bridge/types';

/**
 * Development-only host backed by the Vite dev server (see the `dev-fs` plugin in
 * vite.config.ts). It exists because both real hosts open a native directory picker,
 * which cannot be scripted — with `?devfs=<absolute path>` the app boots straight onto a
 * real asset tree, so UI work and automated checks do not need a human at the dialog.
 *
 * Never reachable in a production build: the caller is behind `import.meta.env.DEV`.
 */
export async function installDevHost(): Promise<boolean> {
  const root = new URLSearchParams(window.location.search).get('devfs');

  if (!root) return false;

  const host: PreviewerHostApi = {
    platform: 'darwin',

    async pickDirectory() {
      return root;
    },

    async reopen(target: string) {
      return target;
    },

    async scan(target: string): Promise<ScanResult> {
      const response = await fetch(`/__dev-fs/scan?root=${encodeURIComponent(target)}`);

      if (!response.ok) throw new Error(await response.text());

      return response.json() as Promise<ScanResult>;
    },

    async readFile(target: string) {
      const response = await fetch(`/__dev-fs/file?path=${encodeURIComponent(target)}`);

      if (!response.ok) throw new Error(await response.text());

      return new Uint8Array(await response.arrayBuffer());
    },

    async recentRoots() {
      return [root];
    },

    async initialRoot() {
      return root;
    },

    onCommand() {
      return () => {};
    },
  };

  window.previewerHost = host;

  return true;
}
