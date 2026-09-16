/** Skeleton payload encoding. `.skel` is binary, `.json` is text. */
export type SkeletonFormat = 'binary' | 'json';

/** One file found while scanning a source directory. */
export interface ScannedFile {
  /**
   * Opaque handle the active bridge can read back:
   * an absolute path under Tauri and the dev host, a directory-relative key in the browser.
   */
  path: string;
  /** Path relative to the scanned root, used for display and grouping. */
  relPath: string;
  /** Directory part of `relPath`; empty string for the root itself. */
  relDir: string;
  /** File name including extension. */
  name: string;
  /** Lower-case extension without the dot. */
  ext: string;
  size: number;
}

/** A skeleton + atlas pair discovered by the scanner. */
export interface SpineAssetEntry {
  /** Stable across rescans: the relative path of the skeleton, or of the atlas when unpaired. */
  id: string;
  /** Base name shared by the files, e.g. `Gift_All`. */
  name: string;
  relDir: string;
  skeleton: ScannedFile | null;
  atlas: ScannedFile | null;
  format: SkeletonFormat | null;
  /** Image files sitting in the same directory; the loader resolves atlas pages against these first. */
  siblingImages: ScannedFile[];
  /** Sum of skeleton + atlas + sibling image sizes, for the list badge. */
  sizeBytes: number;
  /** Non-fatal findings, e.g. a skeleton with no atlas next to it. */
  issues: string[];
}

/** Where the current file listing came from. */
export interface SourceRoot {
  /** Absolute path (Tauri, dev host) or directory name (browser). */
  path: string;
  /** Short label for the title bar. */
  label: string;
}
