import type { SkeletonFormat } from './types';

/** major.minor of the bundled runtime; skeleton data from another line usually fails to parse. */
export const RUNTIME_SPINE_LINE = '4.3';

/**
 * Reads the exporter version out of skeleton data without invoking the runtime parser.
 *
 * Spine runtimes do not validate the version themselves — feeding 3.8 data to the 4.3
 * parser throws somewhere deep inside the format, with an error that says nothing about
 * the real cause. Probing first is what lets the UI say "this file is 3.8, re-export it".
 *
 * Binary layout differs by line: 4.x starts with two int32 hash words followed by a
 * varint-length-prefixed version string, while 3.x opens with the hash as a string. The
 * 4.x offset is tried first and a byte scan covers everything older — which is exactly the
 * case that matters, since an old export is what needs the clear message.
 */
export function probeSkeletonVersion(format: SkeletonFormat, data: Uint8Array | string): string | null {
  try {
    if (format === 'json') {
      const json = typeof data === 'string' ? JSON.parse(data) : null;

      return (json?.skeleton?.spine as string | undefined) ?? null;
    }

    if (typeof data === 'string') return null;

    return readVersionAt(data, 8) ?? scanForVersion(data);
  } catch {
    return null;
  }
}

/** Reads a varint-length-prefixed string at `offset` and keeps it only if it looks like a version. */
function readVersionAt(data: Uint8Array, offset: number): string | null {
  try {
    let cursor = offset;
    let byte = data[cursor++]!;
    let byteCount = byte & 0x7f;

    for (let shift = 7; (byte & 0x80) !== 0 && shift <= 28; shift += 7) {
      byte = data[cursor++]!;
      byteCount |= (byte & 0x7f) << shift;
    }

    // 0 means null, 1 means empty string; otherwise the count includes a trailing slot.
    if (byteCount < 2) return null;

    const text = new TextDecoder().decode(data.subarray(cursor, cursor + byteCount - 1));

    return /^\d+\.\d+/.test(text) ? text : null;
  } catch {
    return null;
  }
}

/**
 * Last resort: Spine writes the version as ASCII near the head of every binary format.
 * Written without a lookbehind on purpose — WebKit only gained those in Safari 16.4, and a
 * regex literal that fails to parse takes the whole bundle down on an older macOS 13 webview.
 */
function scanForVersion(data: Uint8Array): string | null {
  const head = new TextDecoder('latin1').decode(data.subarray(0, 128));

  return /(?:^|[^\d.])(\d+\.\d+(?:\.\d+)?)/.exec(head)?.[1] ?? null;
}

/** True when the data line matches the bundled runtime, e.g. `4.3.17` against `4.3`. */
export function isRuntimeCompatible(version: string | null): boolean {
  if (!version) return true;

  return version.startsWith(`${RUNTIME_SPINE_LINE}.`) || version === RUNTIME_SPINE_LINE;
}
