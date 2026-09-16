import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

import type { ScannedFile, SourceRoot } from '@/core/types';

import type { HostCommand, PreviewerBridge, ScanResult } from './types';

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
  };
}
