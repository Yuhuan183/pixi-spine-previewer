import { useAppStore } from '@/store/useAppStore';

import { Row, Section, Segmented, Slider, Toggle, CheckRow } from '../ui';

const DEBUG_FLAGS = [
  { key: 'bones', label: '骨骼' },
  { key: 'regions', label: '貼圖區塊框' },
  { key: 'meshHull', label: 'Mesh 外框' },
  { key: 'meshTriangles', label: 'Mesh 三角形' },
  { key: 'boundingBoxes', label: '碰撞框' },
  { key: 'clipping', label: '裁切多邊形' },
  { key: 'paths', label: '路徑' },
  { key: 'events', label: '事件標記' },
] as const;

export function DisplayTab() {
  const view = useAppStore((state) => state.view);
  const transform = useAppStore((state) => state.transform);
  const loadOptions = useAppStore((state) => state.loadOptions);
  const patchView = useAppStore((state) => state.patchView);
  const patchTransform = useAppStore((state) => state.patchTransform);
  const patchLoadOptions = useAppStore((state) => state.patchLoadOptions);

  return (
    <>
      <Section title="畫面">
        <Row label="背景色">
          <input
            type="color"
            value={view.background}
            onChange={(event) => patchView({ background: event.target.value })}
            className="h-6 w-10 cursor-pointer rounded border border-line bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0"
          />
          <span className="font-mono text-[11px] text-dim">{view.background}</span>
        </Row>
        <Row label="透明格">
          <Toggle checked={view.checkerboard} onChange={(value) => patchView({ checkerboard: value })} label={view.checkerboard ? '開' : '關'} />
        </Row>
        <Row label="格線">
          <Toggle checked={view.grid} onChange={(value) => patchView({ grid: value })} label={view.grid ? '開' : '關'} />
        </Row>
        <Row label="原點十字">
          <Toggle checked={view.origin} onChange={(value) => patchView({ origin: value })} label={view.origin ? '開' : '關'} />
        </Row>
        <Row label="邊界框" hint="目前影格的 skeleton bounds">
          <Toggle checked={view.boundsBox} onChange={(value) => patchView({ boundsBox: value })} label={view.boundsBox ? '開' : '關'} />
        </Row>
      </Section>

      <Section title="除錯繪製">
        <div className="grid grid-cols-2 gap-x-2">
          {DEBUG_FLAGS.map((flag) => (
            <CheckRow key={flag.key} checked={view[flag.key]} onChange={(value) => patchView({ [flag.key]: value })} label={flag.label} />
          ))}
        </div>
        <p className="mt-1 text-[11px] text-dim">由 SpineDebugRenderer 繪製，開啟後會額外吃效能。</p>
      </Section>

      <Section title="擺放">
        <Row label="X 位移">
          <Slider value={transform.offsetX} min={-800} max={800} step={1} onChange={(value) => patchTransform({ offsetX: value })} />
        </Row>
        <Row label="Y 位移">
          <Slider value={transform.offsetY} min={-800} max={800} step={1} onChange={(value) => patchTransform({ offsetY: value })} />
        </Row>
        <Row label="水平翻轉">
          <Toggle checked={transform.flipX} onChange={(value) => patchTransform({ flipX: value })} label={transform.flipX ? '開' : '關'} />
        </Row>
        <Row label="垂直翻轉">
          <Toggle checked={transform.flipY} onChange={(value) => patchTransform({ flipY: value })} label={transform.flipY ? '開' : '關'} />
        </Row>
        <button
          type="button"
          onClick={() => patchTransform({ offsetX: 0, offsetY: 0, flipX: false, flipY: false })}
          className="mt-2 w-full rounded-md border border-line bg-elevated py-1 text-[11px] text-muted hover:text-ink"
        >
          重設擺放
        </button>
      </Section>

      <Section title="載入參數" defaultOpen={false}>
        <p className="mb-2 text-[11px] text-dim">這四項要重新解析檔案才會生效，調整後會自動重新載入目前的資源。</p>
        <Row label="骨架縮放" hint="SkeletonBinary/Json.scale，解析階段就套用">
          <Slider
            value={loadOptions.skeletonScale}
            min={0.1}
            max={4}
            step={0.05}
            onChange={(value) => patchLoadOptions({ skeletonScale: value })}
            format={(value) => `${value.toFixed(2)}×`}
          />
        </Row>
        <Row label="預乘 Alpha" hint="auto 依 atlas 的 pma 旗標，與遊戲執行期一致">
          <Segmented
            value={loadOptions.premultipliedAlpha}
            onChange={(value) => patchLoadOptions({ premultipliedAlpha: value })}
            options={[
              { value: 'auto', label: 'auto' },
              { value: 'on', label: '開' },
              { value: 'off', label: '關' },
            ]}
          />
        </Row>
        <Row label="貼圖濾波">
          <Segmented
            value={loadOptions.textureFilter}
            onChange={(value) => patchLoadOptions({ textureFilter: value })}
            options={[
              { value: 'auto', label: 'auto' },
              { value: 'linear', label: 'linear' },
              { value: 'nearest', label: 'nearest' },
            ]}
          />
        </Row>
        <Row label="Dark tint" hint="auto 由執行期判斷是否有 tint black 插槽">
          <Segmented
            value={loadOptions.darkTint}
            onChange={(value) => patchLoadOptions({ darkTint: value })}
            options={[
              { value: 'auto', label: 'auto' },
              { value: 'on', label: '開' },
              { value: 'off', label: '關' },
            ]}
          />
        </Row>
      </Section>
    </>
  );
}
