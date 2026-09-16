import { useState } from 'react';

import { IconInfo, IconLayers, IconSliders } from './icons';
import { DisplayTab } from './tabs/DisplayTab';
import { InfoTab } from './tabs/InfoTab';
import { PlaybackTab } from './tabs/PlaybackTab';
import { cx } from './ui';

const TABS = [
  { id: 'playback', label: '播放', icon: IconLayers },
  { id: 'display', label: '顯示', icon: IconSliders },
  { id: 'info', label: '資訊', icon: IconInfo },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function InspectorPanel() {
  const [tab, setTab] = useState<TabId>('playback');

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex shrink-0 border-b border-line-soft p-1">
        {TABS.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cx(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] transition-colors',
                tab === item.id ? 'bg-elevated text-ink' : 'text-dim hover:text-muted',
              )}
            >
              <Icon width={14} height={14} />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === 'playback' ? <PlaybackTab /> : null}
        {tab === 'display' ? <DisplayTab /> : null}
        {tab === 'info' ? <InfoTab /> : null}
      </div>
    </div>
  );
}
