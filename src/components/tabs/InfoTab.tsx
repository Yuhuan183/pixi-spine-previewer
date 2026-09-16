import { RUNTIME_SPINE_LINE, isRuntimeCompatible } from '@/core/probe';
import { formatBytes } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';

import { Badge, KeyValue, Section } from '../ui';

const LIST_LIMIT = 300;

export function InfoTab() {
  const info = useAppStore((state) => state.info);
  const dataVersion = useAppStore((state) => state.dataVersion);
  const assetBytes = useAppStore((state) => state.assetBytes);
  const entries = useAppStore((state) => state.entries);
  const selectedId = useAppStore((state) => state.selectedId);
  const events = useAppStore((state) => state.events);
  const clearEvents = useAppStore((state) => state.clearEvents);

  const entry = entries.find((candidate) => candidate.id === selectedId) ?? null;

  if (!info || !entry) {
    return <p className="px-3 py-4 text-[12px] text-dim">選擇一組資源後，這裡會列出骨架與 atlas 的細節。</p>;
  }

  const compatible = isRuntimeCompatible(dataVersion);

  return (
    <>
      <Section title="來源">
        <KeyValue label="骨架" value={entry.skeleton?.relPath ?? '—'} />
        <KeyValue label="Atlas" value={entry.atlas?.relPath ?? '—'} />
        <KeyValue label="讀取量" value={formatBytes(assetBytes)} />
      </Section>

      <Section title="骨架資料">
        <div className="mb-1 flex items-center gap-1.5">
          <Badge tone={compatible ? 'ok' : 'warn'}>資料 {dataVersion ?? '未知'}</Badge>
          <Badge tone="accent">執行期 {RUNTIME_SPINE_LINE}</Badge>
        </div>
        {!compatible ? (
          <p className="mb-2 text-[11px] text-active">版本不同線，畫面可能異常或解析失敗，建議用 {RUNTIME_SPINE_LINE} 重新匯出。</p>
        ) : null}
        <KeyValue label="hash" value={info.hash ?? '—'} />
        <KeyValue label="匯出 FPS" value={info.fps || '—'} />
        <KeyValue label="images 路徑" value={info.imagesPath ?? '—'} />
        <KeyValue label="referenceScale" value={info.referenceScale} />
        <KeyValue
          label="setup 尺寸"
          value={`${Math.round(info.setupBounds.width)} × ${Math.round(info.setupBounds.height)} @ (${Math.round(info.setupBounds.x)}, ${Math.round(info.setupBounds.y)})`}
        />
      </Section>

      <Section title="統計">
        <div className="grid grid-cols-2 gap-x-4">
          <KeyValue label="骨骼" value={info.counts.bones} />
          <KeyValue label="插槽" value={info.counts.slots} />
          <KeyValue label="皮膚" value={info.counts.skins} />
          <KeyValue label="動畫" value={info.counts.animations} />
          <KeyValue label="附件" value={info.counts.attachments} />
          <KeyValue label="事件定義" value={info.counts.events} />
          <KeyValue label="約束" value={info.counts.constraints} />
          <KeyValue label="Atlas 分頁" value={info.counts.pages} />
        </div>
      </Section>

      <Section title={`Atlas 分頁 · ${info.pages.length}`}>
        {info.pages.map((page) => (
          <div key={page.name} className="mb-1.5 rounded-md border border-line-soft bg-elevated px-2 py-1.5 last:mb-0">
            <div className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink">{page.name}</span>
              {page.pma ? <Badge tone="accent">PMA</Badge> : null}
              {page.bytes === null ? <Badge tone="warn">找不到</Badge> : null}
            </div>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-dim">
              <span>
                {page.width} × {page.height}
              </span>
              {page.bytes !== null ? <span>{formatBytes(page.bytes)}</span> : null}
              {page.sourceRelPath && page.sourceRelPath !== page.name ? <span className="truncate">← {page.sourceRelPath}</span> : null}
            </div>
          </div>
        ))}
      </Section>

      <Section
        title={`事件紀錄 · ${events.length}`}
        aside={
          events.length > 0 ? (
            <button type="button" onClick={clearEvents} className="rounded px-1.5 py-0.5 text-[10px] text-dim hover:text-danger">
              清除
            </button>
          ) : null
        }
      >
        {events.length === 0 ? (
          <p className="text-[12px] text-dim">播放時觸發的 Spine 事件會即時列在這裡。</p>
        ) : (
          <div className="max-h-56 overflow-y-auto pr-1">
            {events.map((event) => (
              <div key={event.id} className="flex items-baseline gap-2 border-b border-line-soft py-0.5 last:border-b-0">
                <span className="font-mono text-[10px] text-dim">T{event.track}</span>
                <span className="font-mono text-[10px] text-dim">{event.time.toFixed(2)}s</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{event.name}</span>
                {event.detail ? <span className="shrink-0 font-mono text-[10px] text-muted">{event.detail}</span> : null}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`骨骼 · ${info.bones.length}`} defaultOpen={false}>
        <NameList items={info.bones.map((bone) => `${bone.name}${bone.parent ? ` ← ${bone.parent}` : ''}`)} />
      </Section>

      <Section title={`插槽 · ${info.slots.length}`} defaultOpen={false}>
        <NameList items={info.slots.map((slot) => `${slot.name}${slot.blendMode === 'normal' ? '' : ` · ${slot.blendMode}`}`)} />
      </Section>

      <Section title={`事件定義 · ${info.events.length}`} defaultOpen={false}>
        <NameList items={info.events} />
      </Section>
    </>
  );
}

function NameList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-[12px] text-dim">（無）</p>;

  return (
    <div className="max-h-64 overflow-y-auto pr-1">
      {items.slice(0, LIST_LIMIT).map((item) => (
        <p key={item} className="truncate font-mono text-[11px] text-muted">
          {item}
        </p>
      ))}
      {items.length > LIST_LIMIT ? <p className="mt-1 text-[11px] text-dim">…還有 {items.length - LIST_LIMIT} 筆</p> : null}
    </div>
  );
}
