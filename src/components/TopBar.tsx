import { bridge } from '@/bridge';
import type { Layout } from '@/hooks/useLayout';
import { useAppStore } from '@/store/useAppStore';

import { IconFolder, IconInfo, IconKeyboard, IconLayers, IconRefresh } from './icons';
import { Badge, ToolButton } from './ui';

const isMacDesktop = bridge.kind === 'tauri' && bridge.platform === 'darwin';

export function TopBar({
  layout,
  onToggleDrawer,
  onShowShortcuts,
}: {
  layout: Layout;
  onToggleDrawer: (side: 'left' | 'right') => void;
  onShowShortcuts: () => void;
}) {
  const root = useAppStore((state) => state.root);
  const scanning = useAppStore((state) => state.scanning);
  const openDirectory = useAppStore((state) => state.openDirectory);
  const rescan = useAppStore((state) => state.rescan);
  const compact = layout === 'compact';

  return (
    <header
      className="titlebar-drag flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-3"
      style={isMacDesktop ? { paddingLeft: 78 } : undefined}
      data-tauri-drag-region
    >
      <div className="titlebar-nodrag flex items-center gap-2">
        {compact ? (
          <ToolButton title="資源列表" onClick={() => onToggleDrawer('left')}>
            <IconFolder />
          </ToolButton>
        ) : null}
        <span className="text-[13px] font-semibold tracking-tight text-ink">Spine Previewer</span>
      </div>

      <div className="titlebar-nodrag ml-1 flex items-center gap-1">
        <ToolButton title="選擇來源目錄 (⌘O)" onClick={() => void openDirectory()}>
          <IconFolder />
          {compact ? null : '開啟目錄'}
        </ToolButton>
        <ToolButton title="重新掃描 (⌘R)" onClick={() => void rescan()} disabled={!root || scanning}>
          <IconRefresh className={scanning ? 'animate-spin' : undefined} />
        </ToolButton>
      </div>

      <p className="mx-2 min-w-0 flex-1 truncate text-center font-mono text-[11px] text-dim" title={root?.path}>
        {root?.path ?? '尚未選擇來源目錄'}
      </p>

      <div className="titlebar-nodrag flex items-center gap-1.5">
        <Badge>Pixi {__APP_VERSIONS__.pixi}</Badge>
        <Badge tone="accent">Spine {__APP_VERSIONS__.spine}</Badge>
        {bridge.kind === 'tauri' ? null : <Badge tone="warn">瀏覽器模式</Badge>}
        <ToolButton title="鍵盤快捷鍵 (?)" onClick={onShowShortcuts}>
          <IconKeyboard />
        </ToolButton>
        {compact ? (
          <ToolButton title="設定面板" onClick={() => onToggleDrawer('right')}>
            <IconLayers />
          </ToolButton>
        ) : (
          <a
            href="https://esotericsoftware.com/spine-api-reference"
            target="_blank"
            rel="noreferrer"
            title="Spine API 參考"
            className="inline-flex h-7 items-center rounded-md px-2 text-muted hover:bg-elevated hover:text-ink"
          >
            <IconInfo />
          </a>
        )}
      </div>
    </header>
  );
}
