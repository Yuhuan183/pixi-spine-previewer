import { formatBytes } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';

import { IconClose, IconDownload } from './icons';
import { Badge } from './ui';

/**
 * The only place an update can be started from. It reports every outcome of a manual check,
 * including "already current" and failures, because a check that answers nothing reads as a
 * broken button.
 */
export function UpdateDialog() {
  const update = useAppStore((state) => state.update);
  const checkForUpdate = useAppStore((state) => state.checkForUpdate);
  const installUpdate = useAppStore((state) => state.installUpdate);
  const closeUpdateDialog = useAppStore((state) => state.closeUpdateDialog);

  if (!update.dialogOpen) return null;

  // Closing mid-download would strand the install with no way back to it.
  const busy = update.status === 'downloading';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={busy ? undefined : closeUpdateDialog}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg border border-line bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="軟體更新"
        aria-busy={busy}
      >
        <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 className="text-[13px] font-semibold text-ink">軟體更新</h2>
          <button
            type="button"
            onClick={closeUpdateDialog}
            disabled={busy}
            className="rounded p-1 text-dim hover:bg-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="關閉"
          >
            <IconClose />
          </button>
        </header>

        <div className="px-4 py-4">
          {update.status === 'checking' ? (
            <p className="flex items-center gap-2 text-[12px] text-muted">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              檢查更新中…
            </p>
          ) : null}

          {update.status === 'current' ? (
            <p className="text-[12px] text-muted">
              目前是最新版本 <span className="font-mono text-ink">{__APP_VERSIONS__.app}</span>。
            </p>
          ) : null}

          {update.status === 'error' ? (
            <div>
              <p className="text-[12px] text-danger">檢查或安裝失敗</p>
              <p className="mt-1 text-[12px] leading-relaxed break-all text-muted">{update.error}</p>
            </div>
          ) : null}

          {update.info && (update.status === 'available' || update.status === 'downloading') ? (
            <div>
              <div className="flex items-center gap-2">
                <Badge>{update.info.currentVersion}</Badge>
                <span className="text-dim">→</span>
                <Badge tone="accent">{update.info.version}</Badge>
                {update.info.date ? <span className="text-[11px] text-dim">{update.info.date.slice(0, 10)}</span> : null}
              </div>

              {update.info.notes ? (
                <pre className="mt-3 max-h-40 overflow-y-auto rounded-md border border-line-soft bg-elevated px-2.5 py-2 text-[11px] leading-relaxed whitespace-pre-wrap text-muted">
                  {update.info.notes}
                </pre>
              ) : null}

              {update.status === 'downloading' ? <Progress downloaded={update.downloaded} total={update.total} /> : null}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line-soft px-4 py-3">
          {update.status === 'available' ? (
            <>
              <button
                type="button"
                onClick={closeUpdateDialog}
                className="rounded-md px-3 py-1.5 text-[12px] text-muted hover:bg-elevated hover:text-ink"
              >
                稍後
              </button>
              <button
                type="button"
                onClick={() => void installUpdate()}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 px-3 py-1.5 text-[12px] text-accent hover:bg-accent/25"
              >
                <IconDownload width={14} height={14} />
                下載並安裝
              </button>
            </>
          ) : null}

          {update.status === 'error' ? (
            <button
              type="button"
              onClick={() => void checkForUpdate(true)}
              className="rounded-md border border-line bg-elevated px-3 py-1.5 text-[12px] text-muted hover:text-ink"
            >
              重試
            </button>
          ) : null}

          {update.status === 'current' ? (
            <button
              type="button"
              onClick={closeUpdateDialog}
              className="rounded-md border border-line bg-elevated px-3 py-1.5 text-[12px] text-muted hover:text-ink"
            >
              關閉
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

/** Falls back to a marquee while the server withholds a content length. */
function Progress({ downloaded, total }: { downloaded: number; total: number | null }) {
  const ratio = total && total > 0 ? Math.min(1, downloaded / total) : null;

  return (
    <div className="mt-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-raised">
        <div
          className={ratio === null ? 'h-full w-1/3 animate-pulse bg-accent/70' : 'h-full bg-accent/70 transition-[width] duration-150'}
          style={ratio === null ? undefined : { width: `${ratio * 100}%` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-dim tabular-nums">
        {formatBytes(downloaded)}
        {total ? ` / ${formatBytes(total)}` : ''}
        {ratio !== null ? ` · ${Math.round(ratio * 100)}%` : ''}
      </p>
      <p className="mt-1 text-[11px] text-dim">安裝完成後會自動重新啟動，請不要關閉視窗。</p>
    </div>
  );
}
