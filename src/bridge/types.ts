import type { ScannedFile, SourceRoot } from '@/core/types';

/** Commands the desktop menu can send down; the browser bridge never emits any. */
export type HostCommand = 'open' | 'rescan';

export interface ScanResult {
  files: ScannedFile[];
  /** True when the walk hit the file cap and stopped early. */
  truncated: boolean;
  dirCount: number;
}

/**
 * Everything the previewer needs from its host. Three implementations exist — Tauri (real
 * paths, Rust fs), the dev filesystem host (Vite dev server) and the browser (File System
 * Access handles) — and no code above this layer is allowed to know which one is live.
 */
export interface PreviewerBridge {
  readonly kind: 'tauri' | 'dev' | 'browser';
  readonly platform: 'darwin' | 'win32' | 'linux' | 'web';
  /** Directory picking degrades to a `webkitdirectory` input on browsers without the FS Access API. */
  readonly canReopenByPath: boolean;
  pickDirectory(): Promise<SourceRoot | null>;
  reopen(path: string): Promise<SourceRoot | null>;
  scan(root: SourceRoot): Promise<ScanResult>;
  /** The only read primitive; callers decode text themselves so byte accounting stays exact. */
  readBytes(file: ScannedFile): Promise<Uint8Array>;
  recentRoots(): Promise<string[]>;
  /** Root the host wants opened at startup (command-line argument); null when there is none. */
  initialRoot(): Promise<SourceRoot | null>;
  /** Fires when the host's own UI (menu bar, accelerator) issues a command. */
  onHostCommand(handler: (command: HostCommand) => void): () => void;
}

/** Extension allow-list for the directory walk; keeps the payload to spine-shaped files. */
export const SCAN_EXTS = new Set(['atlas', 'skel', 'bin', 'json', 'png', 'webp', 'jpg', 'jpeg', 'avif']);
export const SCAN_SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '__MACOSX']);
export const SCAN_MAX_FILES = 20000;
export const SCAN_MAX_DEPTH = 12;
