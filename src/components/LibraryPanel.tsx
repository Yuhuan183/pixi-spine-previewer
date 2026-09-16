import { useMemo } from 'react';

import type { SpineAssetEntry } from '@/core/types';
import { formatBytes } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';

import { IconFolder, IconRefresh, IconSearch, IconWarning } from './icons';
import { Badge, Empty, ToolButton, cx } from './ui';

export function LibraryPanel() {
  const root = useAppStore((state) => state.root);
  const entries = useAppStore((state) => state.entries);
  const filter = useAppStore((state) => state.filter);
  const scanning = useAppStore((state) => state.scanning);
  const scanNote = useAppStore((state) => state.scanNote);
  const selectedId = useAppStore((state) => state.selectedId);
  const recent = useAppStore((state) => state.recent);
  const setFilter = useAppStore((state) => state.setFilter);
  const selectEntry = useAppStore((state) => state.selectEntry);
  const openDirectory = useAppStore((state) => state.openDirectory);
  const reopenRecent = useAppStore((state) => state.reopenRecent);
  const rescan = useAppStore((state) => state.rescan);

  const groups = useMemo(() => groupByDir(entries, filter), [entries, filter]);
  const shown = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex items-center gap-1 border-b border-line-soft px-2 py-2">
        <ToolButton title="選擇來源目錄 (⌘O)" tone="solid" onClick={() => void openDirectory()}>
          <IconFolder />
          目錄
        </ToolButton>
        <ToolButton title="重新掃描 (⌘R)" onClick={() => void rescan()} disabled={!root || scanning}>
          <IconRefresh className={scanning ? 'animate-spin' : undefined} />
        </ToolButton>
        <span className="ml-auto truncate pr-1 text-[11px] text-dim" title={root?.path}>
          {root?.label ?? '未選擇'}
        </span>
      </div>

      <div className="relative border-b border-line-soft px-2 py-2">
        <IconSearch width={13} height={13} className="absolute top-1/2 left-4 -translate-y-1/2 text-dim" />
        <input
          name="library-filter"
          aria-label="篩選名稱或路徑"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="篩選名稱或路徑"
          data-library-search=""
          className="h-7 w-full rounded-md border border-line bg-elevated pr-2 pl-7 text-[12px] text-ink outline-none placeholder:text-dim focus:border-accent/60"
        />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {!root ? (
          <div className="py-8">
            <Empty title="尚未選擇來源目錄" hint="支援 .skel／.json 骨架，貼圖可為 png／webp／jpg" />
            {recent.length > 0 ? (
              <div className="mx-3 mt-3 rounded-md border border-line-soft bg-elevated p-2">
                <p className="mb-1 text-[11px] text-dim">最近開啟</p>
                {recent.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => void reopenRecent(path)}
                    className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-muted hover:bg-raised hover:text-ink"
                    title={path}
                  >
                    {path}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : shown === 0 ? (
          <div className="py-8">
            <Empty
              title={entries.length === 0 ? '這個目錄裡沒有可用的 Spine' : '沒有符合篩選的項目'}
              hint={entries.length === 0 ? '需要成對的 .atlas 與 .skel／.json' : undefined}
            />
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.dir}>
              <p className="sticky top-0 z-10 truncate bg-panel/95 px-3 py-1 text-[10px] tracking-wide text-dim backdrop-blur" title={group.dir}>
                {group.dir || '（根目錄）'}
              </p>
              {group.items.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  selected={entry.id === selectedId}
                  onSelect={() => void selectEntry(entry.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-line-soft px-3 py-1.5 text-[11px] text-dim">
        {scanning ? '掃描中…' : (scanNote ?? `${entries.length} 組資源`)}
        {entries.length > 0 && shown !== entries.length ? ` · 顯示 ${shown}` : null}
      </div>
    </div>
  );
}

function EntryRow({ entry, selected, onSelect }: { entry: SpineAssetEntry; selected: boolean; onSelect: () => void }) {
  const broken = entry.issues.length > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={entry.issues.join('\n') || entry.name}
      className={cx(
        'flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left transition-colors',
        selected ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-elevated',
      )}
    >
      <span className={cx('min-w-0 flex-1 truncate text-[12px]', selected ? 'text-ink' : 'text-muted')}>{entry.name}</span>
      {broken ? <IconWarning width={12} height={12} className="shrink-0 text-active" /> : null}
      <Badge tone={selected ? 'accent' : 'neutral'}>{entry.format === 'json' ? 'json' : 'skel'}</Badge>
      {entry.sizeBytes > 0 ? <span className="shrink-0 font-mono text-[10px] text-dim">{formatBytes(entry.sizeBytes)}</span> : null}
    </button>
  );
}

function groupByDir(entries: SpineAssetEntry[], filter: string): { dir: string; items: SpineAssetEntry[] }[] {
  const tokens = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const matched = entries.filter((entry) => {
    if (tokens.length === 0) return true;

    const haystack = `${entry.relDir}/${entry.name}`.toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
  const groups = new Map<string, SpineAssetEntry[]>();

  for (const entry of matched) {
    const list = groups.get(entry.relDir);

    if (list) list.push(entry);
    else groups.set(entry.relDir, [entry]);
  }

  return [...groups].map(([dir, items]) => ({ dir, items }));
}
