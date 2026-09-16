import { useEffect, useRef } from 'react';

import { stage } from '@/store/stage';
import { useAppStore } from '@/store/useAppStore';
import { publishStats, useRuntimeStore } from '@/store/useRuntimeStore';

import { IconCamera, IconFit, IconGrid, IconOneToOne, IconWarning, IconZoomIn, IconZoomOut } from './icons';
import { Badge, Empty, ToolButton } from './ui';

const WHEEL_ZOOM_RATE = 0.0016;

export function Viewport() {
  const hostRef = useRef<HTMLDivElement>(null);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const warnings = useAppStore((state) => state.warnings);
  const hasRoot = useAppStore((state) => state.root !== null);
  const selectedId = useAppStore((state) => state.selectedId);
  const grid = useAppStore((state) => state.view.grid);
  const patchView = useAppStore((state) => state.patchView);
  const openDirectory = useAppStore((state) => state.openDirectory);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) return;

    void stage.init(host).then(() => {
      // A stale init resolves after its generation moved on; the stage discards it itself.
      if (!stage.ready) return;

      stage.onStats = publishStats;
      stage.onSpineEvent = (line) => useAppStore.getState().pushEvent(line);
      stage.setView(useAppStore.getState().view);
      stage.setTransform(useAppStore.getState().transform);
    });

    return () => {
      stage.onStats = null;
      stage.onSpineEvent = null;
      stage.destroy();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) return;

    // Non-passive: the page must not scroll or pinch-zoom while the camera is being driven.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const rect = host.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_RATE * (event.ctrlKey ? 3 : 1));

      stage.setZoom(stage.getZoom() * factor, anchor);
    };

    host.addEventListener('wheel', onWheel, { passive: false });

    return () => host.removeEventListener('wheel', onWheel);
  }, []);

  const dragging = useRef<{ id: number; x: number; y: number } | null>(null);

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden bg-app">
      <div
        ref={hostRef}
        className="absolute inset-0 touch-none"
        onDoubleClick={() => stage.fitToContent()}
        onPointerDown={(event) => {
          if (event.button !== 0 && event.button !== 1) return;

          // Middle button would otherwise start the browser's autoscroll on Windows.
          event.preventDefault();
          dragging.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragging.current;

          if (!drag || drag.id !== event.pointerId) return;

          stage.panBy(event.clientX - drag.x, event.clientY - drag.y);
          drag.x = event.clientX;
          drag.y = event.clientY;
        }}
        onPointerUp={(event) => {
          if (dragging.current?.id === event.pointerId) dragging.current = null;
        }}
        onPointerCancel={(event) => {
          if (dragging.current?.id === event.pointerId) dragging.current = null;
        }}
      />

      <Hud />

      {warnings.length > 0 ? (
        <div className="pointer-events-none absolute top-3 right-3 flex max-w-96 flex-col items-end gap-1">
          {warnings.map((warning) => (
            <div
              key={warning}
              className="pointer-events-auto flex items-start gap-2 rounded-md border border-active/40 bg-[#1f1a0d]/95 px-2.5 py-1.5 text-[11px] text-active shadow-lg"
            >
              <IconWarning width={13} height={13} className="mt-px shrink-0" />
              <span className="leading-snug">{warning}</span>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className="pointer-events-auto flex max-w-lg items-start gap-2.5 rounded-lg border border-danger/40 bg-[#1b1216]/95 px-4 py-3 shadow-2xl">
            <IconWarning width={16} height={16} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <p className="text-[13px] text-danger">載入失敗</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {!selectedId && !loading && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">
            <Empty
              title={hasRoot ? '左側選一組 Spine 開始預覽' : '尚未選擇來源目錄'}
              hint={
                hasRoot
                  ? '滾輪縮放、拖曳平移、雙擊置中；快捷鍵按 ? 查看'
                  : '選一個含有 .atlas 與 .skel／.json 的資料夾，會自動配對整個目錄樹'
              }
              action={
                hasRoot ? null : (
                  <button
                    type="button"
                    onClick={() => void openDirectory()}
                    className="mt-1 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-[12px] text-accent hover:bg-accent/20"
                  >
                    選擇目錄
                  </button>
                )
              }
            />
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-app/60 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-[12px] text-muted">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            載入中…
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-line bg-panel/95 px-1 py-1 shadow-xl backdrop-blur">
        <ToolButton title="縮小" onClick={() => stage.setZoom(stage.getZoom() / 1.25)}>
          <IconZoomOut />
        </ToolButton>
        <ToolButton title="放大" onClick={() => stage.setZoom(stage.getZoom() * 1.25)}>
          <IconZoomIn />
        </ToolButton>
        <ToolButton title="原始比例 (1)" onClick={() => stage.resetView()}>
          <IconOneToOne />
        </ToolButton>
        <ToolButton title="置中並填滿 (F)" onClick={() => stage.fitToContent()}>
          <IconFit />
        </ToolButton>
        <span className="mx-1 h-4 w-px bg-line" />
        <ToolButton title="格線 (G)" active={grid} onClick={() => patchView({ grid: !grid })}>
          <IconGrid />
        </ToolButton>
        <ToolButton title="截圖（透明背景）" onClick={() => void saveScreenshot()}>
          <IconCamera />
        </ToolButton>
      </div>
    </div>
  );
}

function Hud() {
  const fps = useRuntimeStore((state) => state.fps);
  const zoom = useRuntimeStore((state) => state.zoom);
  const bounds = useRuntimeStore((state) => state.bounds);

  return (
    <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        <Badge tone={fps >= 50 ? 'ok' : fps > 0 ? 'warn' : 'neutral'}>{fps} FPS</Badge>
        <Badge>{Math.round(zoom * 100)}%</Badge>
        <Badge>{stage.ready ? stage.rendererName : '—'}</Badge>
      </div>
      {bounds ? (
        <Badge>
          {Math.round(bounds.width)} × {Math.round(bounds.height)}
        </Badge>
      ) : null}
    </div>
  );
}

async function saveScreenshot(): Promise<void> {
  const blob = await stage.screenshot(true);

  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const name = useAppStore.getState().info?.name ?? 'spine';

  link.href = url;
  link.download = `${name}-${Date.now()}.png`;
  link.click();
  // WebKit starts the download asynchronously; revoking synchronously can cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
