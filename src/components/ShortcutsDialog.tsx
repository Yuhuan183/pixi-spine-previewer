import { IconClose } from './icons';

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: '⌘/Ctrl + O', description: '選擇來源目錄' },
  { keys: '⌘/Ctrl + R', description: '重新掃描目錄' },
  { keys: 'Space', description: '播放／暫停' },
  { keys: 'R', description: '從頭播放' },
  { keys: 'L', description: '切換循環' },
  { keys: '← / →', description: '上一個／下一個動畫' },
  { keys: 'F', description: '置中並填滿' },
  { keys: '1', description: '回到 100% 縮放' },
  { keys: 'G', description: '切換格線' },
  { keys: 'B', description: '切換骨骼繪製' },
  { keys: '/', description: '跳到篩選框' },
  { keys: '?', description: '開啟這份說明' },
  { keys: '滾輪 / 拖曳 / 雙擊', description: '縮放、平移、置中' },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg border border-line bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="鍵盤快捷鍵"
      >
        <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 className="text-[13px] font-semibold text-ink">鍵盤快捷鍵</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-dim hover:bg-elevated hover:text-ink" aria-label="關閉">
            <IconClose />
          </button>
        </header>
        <div className="px-4 py-3">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between border-b border-line-soft py-1.5 last:border-b-0">
              <span className="text-[12px] text-muted">{shortcut.description}</span>
              <kbd className="rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-ink">{shortcut.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
