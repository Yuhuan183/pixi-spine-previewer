import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { devFsPlugin } from './scripts/devFsPlugin';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
  dependencies: Record<string, string>;
};

/**
 * Source of the runtime badges. Always read from package.json: a previewer is only
 * trustworthy while it renders with the exact runtime the game project ships, so a
 * hand-written version string on screen would defeat the whole point.
 */
const versions = {
  app: pkg.version,
  pixi: pkg.dependencies['pixi.js'],
  spine: pkg.dependencies['@esotericsoftware/spine-pixi-v8'],
};

export default defineConfig({
  // The desktop shell serves dist/ from a custom protocol root, so asset URLs stay relative.
  base: './',
  plugins: [react(), tailwindcss(), devFsPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSIONS__: JSON.stringify(versions),
  },
  // Tauri owns the production CSP (src-tauri/tauri.conf.json); a second policy in a meta
  // tag would intersect with it and cut the IPC channel.
  server: { port: 5178, strictPort: true },
  build: {
    outDir: 'dist',
    // WebView2 is evergreen Chromium; macOS 13 ships WebKit from Safari 16, so esbuild has
    // to refuse syntax that engine cannot parse instead of shipping a bundle that fails to load.
    target: ['chrome128', 'safari16'],
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
});
