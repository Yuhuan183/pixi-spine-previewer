import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { check as checkEndpoint, type Update } from '@tauri-apps/plugin-updater';

import type { ScannedFile, SourceRoot } from '@/core/types';

import type { HostCommand, PreviewerBridge, ScanResult, UpdateChannel, UpdateProgress } from './types';

function toRoot(path: string): SourceRoot {
  const label = path.split(/[\\/]/).filter(Boolean).pop() ?? path;

  return { path, label };
}

/**
 * Desktop bridge for the Tauri shell. The Rust side owns the filesystem and keeps the set
 * of directories this session may read; the webview only ever passes paths it was given.
 */
export function createTauriBridge(): PreviewerBridge {
  return {
    kind: 'tauri',
    // The window chrome differs per platform, and that is all the app needs to know.
    platform: navigator.userAgent.includes('Mac') ? 'darwin' : navigator.userAgent.includes('Windows') ? 'win32' : 'linux',
    canReopenByPath: true,

    async pickDirectory() {
      const selected = await open({ directory: true, multiple: false, title: '選擇 Spine 來源目錄' });

      if (typeof selected !== 'string') return null;

      return toRoot(await invoke<string>('authorize_root', { path: selected }));
    },

    async reopen(path: string) {
      try {
        return toRoot(await invoke<string>('authorize_root', { path }));
      } catch {
        return null;
      }
    },

    scan(root: SourceRoot): Promise<ScanResult> {
      return invoke<ScanResult>('scan_directory', { root: root.path });
    },

    async readBytes(file: ScannedFile) {
      return new Uint8Array(await invoke<ArrayBuffer>('read_file', { path: file.path }));
    },

    recentRoots() {
      return invoke<string[]>('recent_roots');
    },

    async initialRoot() {
      const path = await invoke<string | null>('initial_root');

      return path ? toRoot(path) : null;
    },

    onHostCommand(handler) {
      const unlisten = listen<HostCommand>('previewer:command', (event) => handler(event.payload));

      return () => void unlisten.then((stop) => stop());
    },

    updates: createUpdateChannel(),
  };
}

/**
 * Wraps the updater plugin so the rest of the app never holds a plugin handle.
 *
 * `check()` returns a resource that owns the downloaded bytes, so it has to be kept between
 * the prompt and the install and released when it is superseded — leaking it would pin the
 * download on disk for the life of the process.
 */
function createUpdateChannel(): UpdateChannel {
  let pending: Update | null = null;

  async function discard(): Promise<void> {
    const previous = pending;

    pending = null;
    // Closing is best effort: a stale handle must not turn into a visible failure.
    if (previous) await previous.close().catch(() => undefined);
  }

  return {
    async check() {
      await discard();

      const update = await checkEndpoint();

      if (!update) return null;

      pending = update;

      return {
        version: update.version,
        currentVersion: update.currentVersion,
        notes: update.body?.trim() || null,
        date: update.date ?? null,
      };
    },

    async installAndRelaunch(onProgress: (progress: UpdateProgress) => void) {
      const update = pending;

      if (!update) throw new Error('沒有待安裝的更新，請先檢查更新');

      let downloaded = 0;
      let total: number | null = null;

      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength ?? null;
        else if (event.event === 'Progress') downloaded += event.data.chunkLength;
        else downloaded = total ?? downloaded;

        onProgress({ downloaded, total });
      });

      await discard();
      // Windows exits from its own installer before reaching this line; macOS does not.
      await relaunch();
    },
  };
}
