import { useCallback, useEffect, useState } from 'react';

import { bridge } from '@/bridge';
import { useLayout } from '@/hooks/useLayout';
import { useRailResize } from '@/hooks/useRailResize';
import { stage } from '@/store/stage';
import { useAppStore } from '@/store/useAppStore';

import { InspectorPanel } from './components/InspectorPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Timeline } from './components/Timeline';
import { TopBar } from './components/TopBar';
import { cx } from './components/ui';
import { UpdateDialog } from './components/UpdateDialog';
import { Viewport } from './components/Viewport';

/** Docked rails get tighter caps on smaller windows so the canvas never loses the stage. */
const MEDIUM_CAPS = { left: 300, right: 330 };

/** Lets the first scan finish before the update check competes for the network. */
const UPDATE_CHECK_DELAY_MS = 3000;

export function App() {
  const { layout, short } = useLayout();
  const [drawer, setDrawer] = useState<'left' | 'right' | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const leftWidth = useAppStore((state) => state.leftWidth);
  const rightWidth = useAppStore((state) => state.rightWidth);
  const setPanelWidth = useAppStore((state) => state.setPanelWidth);

  const docked = layout !== 'compact';
  const left = layout === 'medium' ? Math.min(leftWidth, MEDIUM_CAPS.left) : leftWidth;
  const right = layout === 'medium' ? Math.min(rightWidth, MEDIUM_CAPS.right) : rightWidth;

  const leftRail = useRailResize('left', leftWidth, (width) => setPanelWidth('left', width));
  const rightRail = useRailResize('right', rightWidth, (width) => setPanelWidth('right', width));

  useEffect(() => {
    // StrictMode mounts twice in dev; without the flag the first run would open and scan the
    // start-up directory a second time after its effect was already torn down.
    let cancelled = false;

    void bridge.recentRoots().then((recent) => {
      if (!cancelled) useAppStore.setState({ recent });
    });
    void bridge.initialRoot().then((root) => {
      if (root && !cancelled) void useAppStore.getState().reopenRecent(root.path);
    });

    const stopHostCommands = bridge.onHostCommand((command) => {
      const store = useAppStore.getState();

      if (command === 'check-update') void store.checkForUpdate(true);
      else void (command === 'open' ? store.openDirectory() : store.rescan());
    });

    // Silent on this path: a startup check that fails is a network blip, and the result only
    // ever shows up as the badge in the top bar.
    const updateTimer = bridge.updates
      ? setTimeout(() => void useAppStore.getState().checkForUpdate(false), UPDATE_CHECK_DELAY_MS)
      : null;

    return () => {
      cancelled = true;
      stopHostCommands();
      if (updateTimer) clearTimeout(updateTimer);
    };
  }, []);

  const toggleHelp = useCallback(() => setShortcutsOpen((open) => !open), []);
  const dismiss = useCallback(() => {
    setShortcutsOpen(false);
    setDrawer(null);
    useAppStore.getState().closeUpdateDialog();
  }, []);

  useShortcuts(toggleHelp, dismiss);

  // Derived, not synced: widening the window must not leave a stale overlay behind.
  const activeDrawer = docked ? null : drawer;

  return (
    <div className="flex h-full flex-col">
      <TopBar layout={layout} onToggleDrawer={(side) => setDrawer((current) => (current === side ? null : side))} onShowShortcuts={() => setShortcutsOpen(true)} />

      <div className="relative flex min-h-0 flex-1">
        {docked ? (
          <aside className="relative shrink-0 border-r border-line" style={{ width: left }}>
            <LibraryPanel />
            <div className="rail-handle -right-1" {...leftRail.handleProps} aria-label="調整資源列表寬度" />
          </aside>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">
          <Viewport />
          <Timeline short={short} />
        </main>

        {docked ? (
          <aside className="relative shrink-0 border-l border-line" style={{ width: right }}>
            <div className="rail-handle -left-1" {...rightRail.handleProps} aria-label="調整設定面板寬度" />
            <InspectorPanel />
          </aside>
        ) : null}

        {activeDrawer ? (
          <>
            <div className="absolute inset-0 z-30 bg-black/40" onClick={() => setDrawer(null)} role="presentation" />
            <aside
              className={cx(
                'absolute inset-y-0 z-40 w-80 max-w-[85%] border-line bg-panel shadow-2xl',
                activeDrawer === 'left' ? 'left-0 border-r' : 'right-0 border-l',
              )}
            >
              {activeDrawer === 'left' ? <LibraryPanel /> : <InspectorPanel />}
            </aside>
          </>
        ) : null}
      </div>

      {shortcutsOpen ? <ShortcutsDialog onClose={() => setShortcutsOpen(false)} /> : null}
      <UpdateDialog />
    </div>
  );
}

/**
 * Global shortcuts. Everything is skipped while a text field has focus, except the
 * modifier combinations — those belong to the app no matter where the caret is.
 */
function useShortcuts(toggleHelp: () => void, dismiss: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const store = useAppStore.getState();
      const target = event.target as HTMLElement | null;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable === true;
      const accel = event.metaKey || event.ctrlKey;

      // The desktop menu owns ⌘O / ⌘R through its accelerators; handling them here too
      // would run each command twice.
      if (accel && bridge.kind === 'tauri') return;

      if (accel && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void store.openDirectory();

        return;
      }

      if (accel && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        void store.rescan();

        return;
      }

      if (event.key === 'Escape') {
        if (typing) target?.blur();
        else dismiss();

        return;
      }

      if (typing) return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          store.togglePlaying();
          break;
        case 'r':
        case 'R':
          store.restart();
          break;
        case 'l':
        case 'L':
          store.setLoop(!store.loop);
          break;
        case 'f':
        case 'F':
          stage.fitToContent();
          break;
        case '1':
          stage.resetView();
          break;
        case 'g':
        case 'G':
          store.patchView({ grid: !store.view.grid });
          break;
        case 'b':
        case 'B':
          store.patchView({ bones: !store.view.bones });
          break;
        case 'ArrowLeft':
          event.preventDefault();
          store.stepAnimation(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          store.stepAnimation(1);
          break;
        case '/':
          event.preventDefault();
          document.querySelector<HTMLInputElement>('[data-library-search]')?.focus();
          break;
        case '?':
          toggleHelp();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismiss, toggleHelp]);
}
