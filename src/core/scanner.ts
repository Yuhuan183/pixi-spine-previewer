import type { ScannedFile, SkeletonFormat, SpineAssetEntry } from './types';

export const IMAGE_EXTS = new Set(['png', 'webp', 'jpg', 'jpeg', 'avif']);
const BINARY_SKELETON_EXTS = new Set(['skel', 'bin']);
/** Wrapper extensions some pipelines append; the meaningful extension is the one before them. */
const WRAPPER_EXTS = ['.txt', '.bytes'];

/** `Foo.atlas.txt` -> `atlas`, `Foo.skel` -> `skel`, `Foo.webp` -> `webp`. */
export function effectiveExt(name: string): string {
  const unwrapped = unwrap(name);
  const dot = unwrapped.lastIndexOf('.');

  return dot > 0 ? unwrapped.slice(dot + 1).toLowerCase() : '';
}

/** `Foo.atlas.txt` -> `Foo`. Never touches dots inside the base name. */
export function stem(name: string): string {
  const unwrapped = unwrap(name);
  const dot = unwrapped.lastIndexOf('.');

  return dot > 0 ? unwrapped.slice(0, dot) : unwrapped;
}

function unwrap(name: string): string {
  const lower = name.toLowerCase();
  const wrapper = WRAPPER_EXTS.find((ext) => lower.endsWith(ext));

  return wrapper ? name.slice(0, -wrapper.length) : name;
}

export function isImageFile(file: ScannedFile): boolean {
  return IMAGE_EXTS.has(effectiveExt(file.name));
}

/**
 * Pairs every atlas with a skeleton inside the same directory.
 *
 * A `.json` only counts as a skeleton when an atlas points at it by name, or when the
 * directory holds exactly one atlas and one json — otherwise ordinary config files in an
 * asset folder would show up as broken skeletons. A `.skel` with no atlas is still listed,
 * flagged, because a missing atlas is precisely the kind of packaging slip this tool exists
 * to surface.
 */
export function groupSpineAssets(files: ScannedFile[]): SpineAssetEntry[] {
  const byDir = new Map<string, ScannedFile[]>();

  for (const file of files) {
    const list = byDir.get(file.relDir);

    if (list) list.push(file);
    else byDir.set(file.relDir, [file]);
  }

  const entries: SpineAssetEntry[] = [];

  for (const [relDir, list] of byDir) {
    const atlases = list.filter((f) => effectiveExt(f.name) === 'atlas');
    const images = list.filter(isImageFile);
    const binaries = list.filter((f) => BINARY_SKELETON_EXTS.has(effectiveExt(f.name)));
    const jsons = list.filter((f) => effectiveExt(f.name) === 'json');
    const paired = new Set<string>();

    for (const atlas of atlases) {
      const base = stem(atlas.name);
      const byName = [...binaries, ...jsons].find((f) => stem(f.name) === base);
      const loneBinary = atlases.length === 1 && binaries.length === 1 ? binaries[0]! : null;
      const loneJson = atlases.length === 1 && jsons.length === 1 ? jsons[0]! : null;
      const skeleton = byName ?? loneBinary ?? loneJson ?? null;

      if (skeleton) paired.add(skeleton.path);

      entries.push(
        makeEntry({
          relDir,
          name: base,
          atlas,
          skeleton,
          images,
          issues: skeleton ? [] : ['找不到對應的骨架檔（.skel / .json）'],
        }),
      );
    }

    for (const skeleton of binaries) {
      if (paired.has(skeleton.path)) continue;

      entries.push(
        makeEntry({
          relDir,
          name: stem(skeleton.name),
          atlas: null,
          skeleton,
          images,
          issues: ['找不到對應的 .atlas，無法載入貼圖'],
        }),
      );
    }
  }

  return entries.sort((a, b) => a.relDir.localeCompare(b.relDir) || a.name.localeCompare(b.name));
}

function makeEntry(input: {
  relDir: string;
  name: string;
  atlas: ScannedFile | null;
  skeleton: ScannedFile | null;
  images: ScannedFile[];
  issues: string[];
}): SpineAssetEntry {
  const { relDir, name, atlas, skeleton, images, issues } = input;
  const prefixed = images.filter((f) => stem(f.name).toLowerCase().startsWith(name.toLowerCase()));
  const siblingImages = prefixed.length > 0 ? prefixed : images;
  const format: SkeletonFormat | null = skeleton
    ? effectiveExt(skeleton.name) === 'json'
      ? 'json'
      : 'binary'
    : null;

  return {
    id: (skeleton ?? atlas)!.relPath,
    name,
    relDir,
    skeleton,
    atlas,
    format,
    siblingImages,
    sizeBytes:
      (skeleton?.size ?? 0) + (atlas?.size ?? 0) + siblingImages.reduce((sum, f) => sum + f.size, 0),
    issues,
  };
}
