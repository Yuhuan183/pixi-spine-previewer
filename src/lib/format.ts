export function formatBytes(bytes: number): string {
  if (!bytes) return '—';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0.00s';

  return `${seconds.toFixed(2)}s`;
}

export function formatFrames(seconds: number, fps: number): string {
  if (!fps) return '—';

  return `${Math.round(seconds * fps)}f`;
}
