import { formatFrames } from '@/lib/format';
import { stage } from '@/store/stage';
import { useAppStore } from '@/store/useAppStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';

import { IconLoop, IconPause, IconPlay, IconRestart, IconStop } from './icons';
import { Badge, Segmented, ToolButton, cx } from './ui';

const SPEED_PRESETS = [
  { value: '0.25', label: '¼×' },
  { value: '0.5', label: '½×' },
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
];

export function Timeline({ short }: { short: boolean }) {
  const track = useAppStore((state) => state.track);
  const playing = useAppStore((state) => state.playing);
  const loop = useAppStore((state) => state.loop);
  const speed = useAppStore((state) => state.speed);
  const fps = useAppStore((state) => state.info?.fps ?? 30);
  const hasAsset = useAppStore((state) => state.info !== null);

  const togglePlaying = useAppStore((state) => state.togglePlaying);
  const restart = useAppStore((state) => state.restart);
  const setLoop = useAppStore((state) => state.setLoop);
  const setSpeed = useAppStore((state) => state.setSpeed);
  const setPlaying = useAppStore((state) => state.setPlaying);
  const clearTrack = useAppStore((state) => state.clearTrack);

  const entry = useRuntimeStore((state) => state.tracks.find((item) => item.index === track));
  const duration = entry?.duration ?? 0;
  const time = entry?.time ?? 0;
  const progress = duration > 0 ? time / duration : 0;

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-line bg-panel px-3 py-2">
      <div className="flex items-center gap-0.5">
        <ToolButton title="重新播放 (R)" onClick={restart} disabled={!entry}>
          <IconRestart />
        </ToolButton>
        <ToolButton title={playing ? '暫停 (Space)' : '播放 (Space)'} tone="solid" onClick={togglePlaying} disabled={!hasAsset}>
          {playing ? <IconPause /> : <IconPlay />}
        </ToolButton>
        <ToolButton title="停止並回到 setup pose" onClick={() => clearTrack(track)} disabled={!entry}>
          <IconStop />
        </ToolButton>
        <ToolButton title="循環 (L)" active={loop} onClick={() => setLoop(!loop)}>
          <IconLoop />
        </ToolButton>
      </div>

      <Badge tone={entry ? 'accent' : 'neutral'}>T{track}</Badge>

      <span className={cx('max-w-40 shrink-0 truncate text-[12px]', entry ? 'text-ink' : 'text-dim')} title={entry?.animation}>
        {entry?.animation ?? '未播放'}
      </span>

      <div className="relative flex min-w-0 flex-1 items-center">
        <div className="absolute inset-x-0 h-1 rounded-full bg-raised" />
        <div className="absolute h-1 rounded-full bg-accent/70" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        <input
          type="range"
          name="timeline"
          aria-label="時間軸"
          min={0}
          max={duration || 1}
          step={0.001}
          value={time}
          disabled={!entry}
          onPointerDown={() => setPlaying(false)}
          onChange={(event) => stage.seek(track, Number(event.target.value))}
          className="relative h-4 w-full cursor-pointer appearance-none bg-transparent accent-[var(--color-accent)] disabled:cursor-not-allowed"
        />
      </div>

      <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums">
        {time.toFixed(2)} / {duration.toFixed(2)}s
      </span>

      {!short ? (
        <span className="shrink-0 font-mono text-[11px] text-dim tabular-nums">
          {formatFrames(time, fps)} / {formatFrames(duration, fps)}
        </span>
      ) : null}

      <Segmented
        value={String(speed)}
        onChange={(value) => setSpeed(Number(value))}
        options={SPEED_PRESETS.filter((preset) => !short || preset.value !== '0.25')}
      />
    </div>
  );
}
