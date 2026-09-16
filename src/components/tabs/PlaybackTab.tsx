import { formatSeconds } from '@/lib/format';
import { stage } from '@/store/stage';
import { TRACK_COUNT, useAppStore } from '@/store/useAppStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';

import { IconStop } from '../icons';
import { Badge, CheckRow, Row, Section, Segmented, Slider, Toggle, ToolButton, cx } from '../ui';

export function PlaybackTab() {
  const info = useAppStore((state) => state.info);
  const track = useAppStore((state) => state.track);
  const activeSkins = useAppStore((state) => state.activeSkins);
  const loop = useAppStore((state) => state.loop);
  const speed = useAppStore((state) => state.speed);
  const defaultMix = useAppStore((state) => state.defaultMix);
  const tracks = useRuntimeStore((state) => state.tracks);

  const setTrack = useAppStore((state) => state.setTrack);
  const playAnimation = useAppStore((state) => state.playAnimation);
  const toggleSkin = useAppStore((state) => state.toggleSkin);
  const setLoop = useAppStore((state) => state.setLoop);
  const setSpeed = useAppStore((state) => state.setSpeed);
  const setDefaultMix = useAppStore((state) => state.setDefaultMix);
  const clearTrack = useAppStore((state) => state.clearTrack);

  if (!info) {
    return <p className="px-3 py-4 text-[12px] text-dim">選擇一組資源後，這裡會列出它的皮膚與動畫。</p>;
  }

  const playingOnTrack = tracks.find((entry) => entry.index === track)?.animation ?? null;

  return (
    <>
      <Section title={`皮膚 · ${info.skins.length}`} aside={<Badge>{activeSkins.length || '預設'}</Badge>}>
        {info.skins.length === 0 ? (
          <p className="text-[12px] text-dim">這個骨架沒有皮膚定義。</p>
        ) : (
          <>
            <div className="max-h-56 overflow-y-auto pr-1">
              {info.skins.map((skin) => (
                <div key={skin.name} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <CheckRow
                      checked={activeSkins.includes(skin.name)}
                      onChange={() => toggleSkin(skin.name, false)}
                      label={skin.name}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-dim">{skin.attachmentCount}</span>
                  <button
                    type="button"
                    onClick={() => toggleSkin(skin.name, true)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-dim hover:bg-elevated hover:text-accent"
                    title="只顯示這一套皮膚"
                  >
                    單選
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-dim">勾選可疊加多套皮膚，Spine 會合併成一套暫時皮膚。</p>
          </>
        )}
      </Section>

      <Section title={`動畫 · ${info.animations.length}`}>
        <Row label="目標軌道" hint="新播放的動畫會設定在這條軌道上">
          <Segmented
            value={String(track)}
            onChange={(value) => setTrack(Number(value))}
            options={Array.from({ length: TRACK_COUNT }, (_, index) => ({ value: String(index), label: `${index}` }))}
          />
        </Row>
        <div className="mt-1 max-h-72 overflow-y-auto pr-1">
          {info.animations.map((animation) => {
            const active = animation.name === playingOnTrack;

            return (
              <button
                key={animation.name}
                type="button"
                onClick={() => playAnimation(animation.name)}
                className={cx(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] transition-colors',
                  active ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-elevated hover:text-ink',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{animation.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-dim">{formatSeconds(animation.duration)}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="播放參數">
        <Row label="速度">
          <Slider value={speed} min={0.05} max={3} step={0.05} onChange={setSpeed} format={(value) => `${value.toFixed(2)}×`} />
        </Row>
        <Row label="循環">
          <Toggle checked={loop} onChange={setLoop} label={loop ? '開' : '關'} />
        </Row>
        <Row label="混合時間" hint="AnimationStateData.defaultMix，切換動畫時的交叉淡入秒數">
          <Slider value={defaultMix} min={0} max={1} step={0.01} onChange={setDefaultMix} format={(value) => `${value.toFixed(2)}s`} />
        </Row>
      </Section>

      <Section title="進行中的軌道">
        {tracks.length === 0 ? (
          <p className="text-[12px] text-dim">目前沒有播放中的動畫。</p>
        ) : (
          tracks.map((entry) => (
            <div key={entry.index} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-elevated">
              <Badge tone="accent">T{entry.index}</Badge>
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{entry.animation}</span>
              <span className="shrink-0 font-mono text-[10px] text-dim">
                {entry.time.toFixed(2)} / {entry.duration.toFixed(2)}
              </span>
              <ToolButton title={`清除軌道 ${entry.index}`} onClick={() => clearTrack(entry.index)}>
                <IconStop width={13} height={13} />
              </ToolButton>
            </div>
          ))
        )}
        <button
          type="button"
          onClick={() => stage.clearAllTracks()}
          className="mt-2 w-full rounded-md border border-line bg-elevated py-1 text-[11px] text-muted hover:border-danger/40 hover:text-danger"
        >
          全部清除，回到 setup pose
        </button>
      </Section>
    </>
  );
}
