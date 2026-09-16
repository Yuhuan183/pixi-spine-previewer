import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { SCAN_EXTS, SCAN_MAX_DEPTH, SCAN_MAX_FILES, SCAN_SKIP_DIRS, type ScanResult } from '../src/bridge/types';
import type { ScannedFile } from '../src/core/types';

async function walk(
  root: string,
  dir: string,
  depth: number,
  out: ScannedFile[],
  counters: { dirs: number },
): Promise<boolean> {
  counters.dirs += 1;

  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    if (out.length >= SCAN_MAX_FILES) return true;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (depth >= SCAN_MAX_DEPTH || SCAN_SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

      const truncated = await walk(root, full, depth + 1, out, counters);

      if (truncated) return true;
      continue;
    }

    if (!entry.isFile() || entry.name.startsWith('.')) continue;

    const described = describe(root, full, entry.name);

    if (!described) continue;

    try {
      described.size = (await stat(full)).size;
    } catch {
      continue;
    }

    out.push(described);
  }

  return false;
}

function describe(root: string, full: string, name: string): ScannedFile | null {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const unwrapped = ext === 'txt' || ext === 'bytes' ? name.slice(0, -(ext.length + 1)) : name;
  const realExt = unwrapped.slice(unwrapped.lastIndexOf('.') + 1).toLowerCase();

  if (!SCAN_EXTS.has(realExt)) return null;

  const relPath = path.relative(root, full).split(path.sep).join('/');
  const slash = relPath.lastIndexOf('/');

  return {
    path: full,
    relPath,
    relDir: slash < 0 ? '' : relPath.slice(0, slash),
    name,
    ext,
    size: 0,
  };
}

/** Walks a directory tree and returns only the files a Spine asset can be built from. */
export async function scanDirectory(root: string): Promise<ScanResult> {
  const files: ScannedFile[] = [];
  const counters = { dirs: 0 };
  const truncated = await walk(root, root, 0, files, counters);

  return { files, truncated, dirCount: counters.dirs };
}
