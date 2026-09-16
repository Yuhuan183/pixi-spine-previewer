import {
  AtlasAttachmentLoader,
  SkeletonBinary,
  SkeletonJson,
  Spine,
  SpineTexture,
  TextureAtlas,
  type SkeletonData,
} from '@esotericsoftware/spine-pixi-v8';
import { ImageSource } from 'pixi.js';

import type { PreviewerBridge } from '@/bridge';

import { isRuntimeCompatible, probeSkeletonVersion, RUNTIME_SPINE_LINE } from './probe';
import { effectiveExt, isImageFile, stem } from './scanner';
import type { ScannedFile, SpineAssetEntry } from './types';

/** Preview-time knobs that can only be honoured by re-parsing the asset. */
export interface LoadOptions {
  /** Passed to the skeleton reader; scales bone lengths and attachment sizes at parse time. */
  skeletonScale: number;
  /** `auto` follows the atlas `pma:` flag, which is what a game runtime does. */
  premultipliedAlpha: 'auto' | 'on' | 'off';
  /** `auto` follows the atlas filter line. */
  textureFilter: 'auto' | 'linear' | 'nearest';
  /** `auto` lets the runtime decide from tint-black slots. */
  darkTint: 'auto' | 'on' | 'off';
}

export const DEFAULT_LOAD_OPTIONS: LoadOptions = {
  skeletonScale: 1,
  premultipliedAlpha: 'auto',
  textureFilter: 'auto',
  darkTint: 'auto',
};

export interface AtlasPageInfo {
  name: string;
  width: number;
  height: number;
  pma: boolean;
  /** Bytes of the image file actually used, `null` when the page could not be resolved. */
  bytes: number | null;
  sourceRelPath: string | null;
}

export interface LoadedAsset {
  spine: Spine;
  skeletonData: SkeletonData;
  atlas: TextureAtlas;
  pages: AtlasPageInfo[];
  /** Version string written by the Spine editor that exported the file. */
  dataVersion: string | null;
  warnings: string[];
  /** Total bytes read for this asset. */
  bytes: number;
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
};

/**
 * Loads one asset entry into a live `Spine` object.
 *
 * Deliberately does not use `Assets`/the packaged spine loaders: those resolve pages by URL
 * relative to the atlas, and the source files here live outside any web root — under Tauri
 * they are arbitrary disk paths, in the browser they are handles. Reading the bytes through
 * the bridge and building the texture sources by hand is the only path that works for both,
 * and it keeps every texture decision (PMA, filter) visible and overridable.
 *
 * Every read goes through `readBytes` so the byte total is exact on every host; the browser
 * bridge reports a size of 0 for File System Access handles until the file is opened.
 */
export async function loadSpineAsset(
  entry: SpineAssetEntry,
  allFiles: ScannedFile[],
  bridge: PreviewerBridge,
  options: LoadOptions,
): Promise<LoadedAsset> {
  if (!entry.skeleton) throw new Error('這組資源沒有骨架檔，無法預覽');
  if (!entry.atlas) throw new Error('這組資源沒有 .atlas，無法建立貼圖');

  const warnings: string[] = [];
  const decoder = new TextDecoder();

  // Both files are read before any texture exists, so a failed read never leaves GPU
  // resources behind; only page decoding and skeleton parsing need explicit cleanup.
  const atlasBytes = await bridge.readBytes(entry.atlas);
  const skeletonBytes = await bridge.readBytes(entry.skeleton);
  const format = entry.format ?? 'binary';
  const raw = format === 'json' ? decoder.decode(skeletonBytes) : skeletonBytes;
  let bytesRead = atlasBytes.byteLength + skeletonBytes.byteLength;

  const dataVersion = probeSkeletonVersion(format, raw);

  if (!isRuntimeCompatible(dataVersion)) {
    warnings.push(`骨架資料為 Spine ${dataVersion}，執行期是 ${RUNTIME_SPINE_LINE}，需要重新匯出才能保證正確`);
  }

  const atlas = new TextureAtlas(decoder.decode(atlasBytes));
  const pages: AtlasPageInfo[] = [];

  try {
    await loadPages();
  } catch (error) {
    // Pages already uploaded before the failing one would otherwise stay on the GPU.
    atlas.dispose();
    throw error;
  }

  const attachmentLoader = new AtlasAttachmentLoader(atlas);
  let skeletonData: SkeletonData;

  try {
    if (format === 'json') {
      const parser = new SkeletonJson(attachmentLoader);

      parser.scale = options.skeletonScale;
      skeletonData = parser.readSkeletonData(raw as string);
    } else {
      const parser = new SkeletonBinary(attachmentLoader);

      parser.scale = options.skeletonScale;
      skeletonData = parser.readSkeletonData(raw as Uint8Array);
    }
  } catch (error) {
    atlas.dispose();
    throw new Error(
      dataVersion && !isRuntimeCompatible(dataVersion)
        ? `解析失敗：資料是 Spine ${dataVersion}，本預覽器內建 ${RUNTIME_SPINE_LINE} 執行期`
        : `解析骨架失敗：${(error as Error).message}`,
    );
  }

  const spine = new Spine({
    skeletonData,
    autoUpdate: false,
    darkTint: options.darkTint === 'auto' ? undefined : options.darkTint === 'on',
  });

  return { spine, skeletonData, atlas, pages, dataVersion, warnings, bytes: bytesRead };

  async function loadPages(): Promise<void> {
    for (const page of atlas.pages) {
      const source = resolvePageFile(page.name, entry, allFiles);

      if (!source) {
        warnings.push(`atlas 指到的貼圖找不到：${page.name}`);
        pages.push({ name: page.name, width: page.width, height: page.height, pma: page.pma, bytes: null, sourceRelPath: null });
        continue;
      }

      if (stem(source.name) !== stem(page.name)) {
        warnings.push(`貼圖以檔名比對替代：${page.name} → ${source.relPath}`);
      }

      const pma = options.premultipliedAlpha === 'auto' ? page.pma : options.premultipliedAlpha === 'on';
      const bytes = await bridge.readBytes(source);

      bytesRead += bytes.byteLength;

      const blob = new Blob([bytes as BlobPart], { type: MIME_BY_EXT[effectiveExt(source.name)] ?? 'image/png' });
      // Mirrors pixi's own loader: a premultiplied file must not be premultiplied again on decode.
      const bitmap = await createImageBitmap(blob, pma ? { premultiplyAlpha: 'none' } : {});
      const textureSource = new ImageSource({
        resource: bitmap,
        alphaMode: pma ? 'premultiplied-alpha' : 'premultiply-alpha-on-upload',
        label: source.relPath,
      });

      // setTexture applies the atlas filter/wrap lines, so any override has to come after it.
      page.setTexture(SpineTexture.from(textureSource));

      if (options.textureFilter !== 'auto') {
        textureSource.scaleMode = options.textureFilter;
        textureSource.update();
      }

      pages.push({
        name: page.name,
        width: page.width || bitmap.width,
        height: page.height || bitmap.height,
        pma,
        bytes: bytes.byteLength,
        sourceRelPath: source.relPath,
      });
    }
  }
}

/**
 * Atlas page names are relative to the atlas file, but real projects rename extensions
 * (png in the atlas, webp on disk) and move pages into an `image/` subfolder. Match by
 * exact relative path first, then by file name, then by base name across the whole scan.
 */
function resolvePageFile(pageName: string, entry: SpineAssetEntry, allFiles: ScannedFile[]): ScannedFile | null {
  const normalized = pageName.replaceAll('\\', '/');
  const fileName = normalized.split('/').pop() ?? normalized;
  const wanted = `${entry.relDir ? `${entry.relDir}/` : ''}${normalized}`.toLowerCase();
  const exact = allFiles.find((f) => f.relPath.toLowerCase() === wanted);

  if (exact) return exact;

  const sameName = entry.siblingImages.find((f) => f.name.toLowerCase() === fileName.toLowerCase());

  if (sameName) return sameName;

  const base = stem(fileName).toLowerCase();
  const siblingByBase = entry.siblingImages.find((f) => stem(f.name).toLowerCase() === base);

  if (siblingByBase) return siblingByBase;

  return allFiles.find((f) => isImageFile(f) && stem(f.name).toLowerCase() === base) ?? null;
}
