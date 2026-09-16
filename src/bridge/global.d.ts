import type { ScannedFile } from '@/core/types';
import type { HostCommand, ScanResult } from './types';

/** Host API injected on `window` by src/dev/devHost.ts. */
export interface PreviewerHostApi {
  platform: 'darwin' | 'win32' | 'linux';
  pickDirectory(): Promise<string | null>;
  reopen(path: string): Promise<string | null>;
  scan(rootPath: string): Promise<ScanResult>;
  readFile(path: string): Promise<Uint8Array>;
  recentRoots(): Promise<string[]>;
  /** Directory passed on the command line, if any. */
  initialRoot(): Promise<string | null>;
  onCommand(handler: (command: HostCommand) => void): () => void;
}

declare global {
  interface Window {
    previewerHost?: PreviewerHostApi;
    showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
}

export type { ScannedFile };
