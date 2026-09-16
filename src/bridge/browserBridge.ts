import type { ScannedFile, SourceRoot } from '@/core/types';

import {
  SCAN_EXTS,
  SCAN_MAX_DEPTH,
  SCAN_MAX_FILES,
  SCAN_SKIP_DIRS,
  type PreviewerBridge,
  type ScanResult,
} from './types';

/**
 * Browser bridge. Files are kept as live handles rather than being read up front, so a
 * 2 GB asset folder costs nothing until a skeleton is actually opened.
 *
 * Two acquisition paths: the File System Access API when available (rescan works), and a
 * `webkitdirectory` input otherwise (one-shot snapshot, no rescan).
 */
export function createBrowserBridge(): PreviewerBridge {
  let directoryHandle: FileSystemDirectoryHandle | null = null;
  let snapshot: Map<string, File> | null = null;
  const fileHandles = new Map<string, FileSystemFileHandle>();

  async function walk(
    dir: FileSystemDirectoryHandle,
    relDir: string,
    depth: number,
    out: ScannedFile[],
    counters: { dirs: number },
  ): Promise<boolean> {
    counters.dirs += 1;

    for await (const [name, handle] of dir.entries()) {
      if (out.length >= SCAN_MAX_FILES) return true;

      if (handle.kind === 'directory') {
        if (depth >= SCAN_MAX_DEPTH || SCAN_SKIP_DIRS.has(name) || name.startsWith('.')) continue;

        const truncated = await walk(handle, relDir ? `${relDir}/${name}` : name, depth + 1, out, counters);

        if (truncated) return true;
        continue;
      }

      const scanned = describe(name, relDir, 0);

      if (!scanned) continue;

      fileHandles.set(scanned.path, handle);
      out.push(scanned);
    }

    return false;
  }

  async function pickViaInput(): Promise<SourceRoot | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');

      input.type = 'file';
      input.multiple = true;
      input.webkitdirectory = true;
      input.style.display = 'none';
      input.addEventListener(
        'change',
        () => {
          const files = [...(input.files ?? [])];

          input.remove();

          if (files.length === 0) {
            resolve(null);

            return;
          }

          snapshot = new Map();
          directoryHandle = null;

          const rootName = files[0]!.webkitRelativePath.split('/')[0] ?? 'selected';

          for (const file of files) {
            // webkitRelativePath always starts with the picked directory's own name.
            const relPath = file.webkitRelativePath.split('/').slice(1).join('/');

            snapshot.set(relPath, file);
          }

          resolve({ path: rootName, label: rootName });
        },
        { once: true },
      );
      document.body.append(input);
      input.click();
    });
  }

  return {
    kind: 'browser',
    platform: 'web',
    canReopenByPath: false,

    async pickDirectory() {
      if (!window.showDirectoryPicker) return pickViaInput();

      try {
        const handle = await window.showDirectoryPicker({ id: 'spine-source', mode: 'read' });

        directoryHandle = handle;
        snapshot = null;
        fileHandles.clear();

        return { path: handle.name, label: handle.name };
      } catch (error) {
        // AbortError is the user closing the picker; anything else is worth surfacing.
        if (error instanceof DOMException && error.name === 'AbortError') return null;
        throw error;
      }
    },

    async reopen() {
      return null;
    },

    async scan(): Promise<ScanResult> {
      if (directoryHandle) {
        const files: ScannedFile[] = [];
        const counters = { dirs: 0 };

        fileHandles.clear();
        const truncated = await walk(directoryHandle, '', 0, files, counters);

        return { files, truncated, dirCount: counters.dirs };
      }

      if (snapshot) {
        const files: ScannedFile[] = [];
        const dirs = new Set<string>();

        for (const [relPath, file] of snapshot) {
          const slash = relPath.lastIndexOf('/');
          const relDir = slash < 0 ? '' : relPath.slice(0, slash);
          const scanned = describe(relPath.slice(slash + 1), relDir, file.size);

          if (!scanned) continue;

          dirs.add(relDir);
          files.push(scanned);
        }

        return { files, truncated: false, dirCount: dirs.size };
      }

      return { files: [], truncated: false, dirCount: 0 };
    },

    async readBytes(file: ScannedFile) {
      const blob = await resolveFile(file);

      return new Uint8Array(await blob.arrayBuffer());
    },

    async recentRoots() {
      return [];
    },

    async initialRoot() {
      return null;
    },

    onHostCommand() {
      return () => {};
    },
  };

  async function resolveFile(file: ScannedFile): Promise<File> {
    const handle = fileHandles.get(file.path);

    if (handle) return handle.getFile();

    const fromSnapshot = snapshot?.get(file.path);

    if (fromSnapshot) return fromSnapshot;

    throw new Error(`檔案已失效，請重新選擇目錄：${file.relPath}`);
  }
}

function describe(name: string, relDir: string, size: number): ScannedFile | null {
  if (name.startsWith('.')) return null;

  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const unwrapped = ext === 'txt' || ext === 'bytes' ? name.slice(0, -(ext.length + 1)) : name;
  const realExt = unwrapped.slice(unwrapped.lastIndexOf('.') + 1).toLowerCase();

  if (!SCAN_EXTS.has(realExt)) return null;

  const relPath = relDir ? `${relDir}/${name}` : name;

  return { path: relPath, relPath, relDir, name, ext, size };
}
