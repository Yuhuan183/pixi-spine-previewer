import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { bridge, type UpdateInfo } from '@/bridge';
import { inspectSkeleton, type SkeletonInfo } from '@/core/inspect';
import { DEFAULT_LOAD_OPTIONS, loadSpineAsset, type LoadOptions } from '@/core/loadSpine';
import { groupSpineAssets } from '@/core/scanner';
import { DEFAULT_TRANSFORM, DEFAULT_VIEW, type SpineEventLine, type TransformConfig, type ViewConfig } from '@/core/stage';
import type { ScannedFile, SourceRoot, SpineAssetEntry } from '@/core/types';

import { mountAsset, stage } from './stage';
import { useRuntimeStore } from './useRuntimeStore';

const EVENT_LOG_LIMIT = 200;
export const TRACK_COUNT = 3;

/**
 * Download progress arrives once per chunk, which is far more often than a progress bar can
 * show. Coalescing keeps a 3 MB download from queueing hundreds of renders.
 */
const PROGRESS_THROTTLE_MS = 100;

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'current' | 'error';

export interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  downloaded: number;
  /** Null until the server reports a content length. */
  total: number | null;
  error: string | null;
  /** The modal; `available` without it is the quiet state where only the badge shows. */
  dialogOpen: boolean;
}

const IDLE_UPDATE: UpdateState = {
  status: 'idle',
  info: null,
  downloaded: 0,
  total: null,
  error: null,
  dialogOpen: false,
};

/**
 * Load options are driven by sliders, and each change costs a full re-read and re-parse of
 * the asset. Coalescing the reload keeps dragging the skeleton-scale slider from firing one
 * disk read per pixel.
 */
const RELOAD_DEBOUNCE_MS = 250;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

interface AppState {
  root: SourceRoot | null;
  files: ScannedFile[];
  entries: SpineAssetEntry[];
  scanning: boolean;
  scanNote: string | null;
  recent: string[];
  filter: string;

  selectedId: string | null;
  loading: boolean;
  error: string | null;
  warnings: string[];
  info: SkeletonInfo | null;
  dataVersion: string | null;
  assetBytes: number;

  track: number;
  loop: boolean;
  playing: boolean;
  speed: number;
  defaultMix: number;
  activeSkins: string[];
  events: SpineEventLine[];

  view: ViewConfig;
  transform: TransformConfig;
  loadOptions: LoadOptions;
  leftWidth: number;
  rightWidth: number;
  update: UpdateState;

  openDirectory: () => Promise<void>;
  reopenRecent: (path: string) => Promise<void>;
  rescan: () => Promise<void>;
  setFilter: (filter: string) => void;
  selectEntry: (id: string) => Promise<void>;
  reloadCurrent: () => Promise<void>;

  setTrack: (track: number) => void;
  playAnimation: (name: string, track?: number) => void;
  stepAnimation: (delta: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  restart: () => void;
  clearTrack: (track: number) => void;
  setSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;
  setDefaultMix: (mix: number) => void;
  toggleSkin: (name: string, exclusive: boolean) => void;

  patchView: (patch: Partial<ViewConfig>) => void;
  patchTransform: (patch: Partial<TransformConfig>) => void;
  patchLoadOptions: (patch: Partial<LoadOptions>) => void;
  pushEvent: (line: SpineEventLine) => void;
  clearEvents: () => void;
  setPanelWidth: (side: 'left' | 'right', width: number) => void;

  /** `manual` opens the dialog straight away and reports "already current" and failures. */
  checkForUpdate: (manual: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
  openUpdateDialog: () => void;
  closeUpdateDialog: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      root: null,
      files: [],
      entries: [],
      scanning: false,
      scanNote: null,
      recent: [],
      filter: '',

      selectedId: null,
      loading: false,
      error: null,
      warnings: [],
      info: null,
      dataVersion: null,
      assetBytes: 0,

      track: 0,
      loop: true,
      playing: true,
      speed: 1,
      defaultMix: 0.2,
      activeSkins: [],
      events: [],

      view: { ...DEFAULT_VIEW },
      transform: { ...DEFAULT_TRANSFORM },
      loadOptions: { ...DEFAULT_LOAD_OPTIONS },
      leftWidth: 288,
      rightWidth: 340,
      update: { ...IDLE_UPDATE },

      async openDirectory() {
        const root = await bridge.pickDirectory();

        if (!root) return;

        set({ root, selectedId: null, info: null, error: null });
        mountAsset(null);
        await get().rescan();
        void bridge.recentRoots().then((recent) => set({ recent }));
      },

      async reopenRecent(path: string) {
        const root = await bridge.reopen(path);

        if (!root) {
          set({ scanNote: `目錄已不存在：${path}` });

          return;
        }

        set({ root, selectedId: null, info: null, error: null });
        mountAsset(null);
        await get().rescan();
      },

      async rescan() {
        const { root } = get();

        if (!root) return;

        set({ scanning: true, scanNote: null });

        try {
          const result = await bridge.scan(root);
          const entries = groupSpineAssets(result.files);

          set({
            files: result.files,
            entries,
            scanning: false,
            scanNote: result.truncated
              ? `檔案數超過上限，只掃描了前 ${result.files.length} 個檔案`
              : `${result.dirCount} 個目錄 · ${result.files.length} 個相關檔案`,
          });

          const { selectedId } = get();

          if (selectedId && entries.some((entry) => entry.id === selectedId)) {
            await get().reloadCurrent();
          }
        } catch (error) {
          set({ scanning: false, scanNote: `掃描失敗：${(error as Error).message}` });
        }
      },

      setFilter(filter) {
        set({ filter });
      },

      async selectEntry(id) {
        if (get().loading && get().selectedId === id) return;

        set({ selectedId: id, loading: true, error: null, warnings: [], info: null, events: [] });

        const entry = get().entries.find((candidate) => candidate.id === id);

        if (!entry) {
          set({ loading: false, error: '找不到這組資源，請重新掃描' });

          return;
        }

        try {
          const loaded = await loadSpineAsset(entry, get().files, bridge, get().loadOptions);

          // A newer selection may have won the race while this one was decoding.
          if (get().selectedId !== id) {
            loaded.spine.destroy();
            loaded.atlas.dispose();

            return;
          }

          mountAsset(loaded);

          const info = inspectSkeleton(loaded.skeletonData, loaded.pages);
          const named = info.skins.filter((skin) => skin.name !== 'default');
          const activeSkins = named.length > 0 ? [named[0]!.name] : [];

          set({
            info,
            warnings: loaded.warnings,
            dataVersion: loaded.dataVersion,
            assetBytes: loaded.bytes,
            loading: false,
            activeSkins,
          });

          stage.setSkins(activeSkins);
          stage.setDefaultMix(get().defaultMix);
          stage.setSpeed(get().speed);
          stage.setPlaying(get().playing);
          stage.setView(get().view);
          stage.setTransform(get().transform);

          const first = info.animations[0];

          if (first) stage.setAnimation(0, first.name, get().loop);

          stage.fitToContent();
        } catch (error) {
          mountAsset(null);
          set({ loading: false, error: (error as Error).message, info: null });
        }
      },

      async reloadCurrent() {
        const { selectedId } = get();

        if (!selectedId) return;

        const keep = {
          skins: get().activeSkins,
          animation: stageAnimationName(),
        };

        set({ selectedId: null });
        await get().selectEntry(selectedId);

        if (get().error) return;

        const info = get().info;

        if (keep.skins.length > 0 && info) {
          const valid = keep.skins.filter((name) => info.skins.some((skin) => skin.name === name));

          if (valid.length > 0) {
            set({ activeSkins: valid });
            stage.setSkins(valid);
          }
        }

        if (keep.animation && info?.animations.some((animation) => animation.name === keep.animation)) {
          stage.setAnimation(get().track, keep.animation, get().loop);
        }
      },

      setTrack(track) {
        set({ track });
      },

      playAnimation(name, track) {
        const index = track ?? get().track;

        stage.setAnimation(index, name, get().loop);
        stage.setPlaying(true);
        set({ playing: true });
      },

      stepAnimation(delta) {
        const { info, track } = get();

        if (!info || info.animations.length === 0) return;

        const currentName = stageAnimationName(track);
        const index = info.animations.findIndex((animation) => animation.name === currentName);
        const nextIndex = (index + delta + info.animations.length) % info.animations.length;

        get().playAnimation(info.animations[nextIndex]!.name, track);
      },

      setPlaying(playing) {
        stage.setPlaying(playing);
        set({ playing });
      },

      togglePlaying() {
        get().setPlaying(!get().playing);
      },

      restart() {
        stage.restart(get().track);
        get().setPlaying(true);
      },

      clearTrack(track) {
        stage.clearTrack(track);
      },

      setSpeed(speed) {
        stage.setSpeed(speed);
        set({ speed });
      },

      setLoop(loop) {
        stage.setLoop(get().track, loop);
        set({ loop });
      },

      setDefaultMix(defaultMix) {
        stage.setDefaultMix(defaultMix);
        set({ defaultMix });
      },

      toggleSkin(name, exclusive) {
        const active = get().activeSkins;
        const next = exclusive
          ? [name]
          : active.includes(name)
            ? active.filter((candidate) => candidate !== name)
            : [...active, name];

        set({ activeSkins: next });
        stage.setSkins(next);
      },

      patchView(patch) {
        const view = { ...get().view, ...patch };

        set({ view });
        stage.setView(view);
      },

      patchTransform(patch) {
        const transform = { ...get().transform, ...patch };

        set({ transform });
        stage.setTransform(transform);
      },

      patchLoadOptions(patch) {
        set({ loadOptions: { ...get().loadOptions, ...patch } });

        // These only take effect through the parser, so the asset has to be read again.
        if (reloadTimer) clearTimeout(reloadTimer);

        reloadTimer = setTimeout(() => {
          reloadTimer = null;
          void get().reloadCurrent();
        }, RELOAD_DEBOUNCE_MS);
      },

      pushEvent(line) {
        set({ events: [line, ...get().events].slice(0, EVENT_LOG_LIMIT) });
      },

      clearEvents() {
        set({ events: [] });
      },

      setPanelWidth(side, width) {
        set(side === 'left' ? { leftWidth: width } : { rightWidth: width });
      },

      async checkForUpdate(manual) {
        const channel = bridge.updates;
        const { status } = get().update;

        if (!channel || status === 'checking' || status === 'downloading') return;
        // The startup check must not reset an update the user has already been offered.
        if (!manual && status !== 'idle') return;

        set({ update: { ...IDLE_UPDATE, status: 'checking', dialogOpen: manual } });

        try {
          const info = await channel.check();

          set((state) => ({
            update: { ...state.update, status: info ? 'available' : 'current', info },
          }));
        } catch (error) {
          // A failed startup check is a network blip, not something worth interrupting for.
          set((state) => ({
            update: manual
              ? { ...state.update, status: 'error', error: (error as Error).message }
              : { ...IDLE_UPDATE },
          }));
        }
      },

      async installUpdate() {
        const channel = bridge.updates;

        if (!channel || get().update.status !== 'available') return;

        set((state) => ({ update: { ...state.update, status: 'downloading', dialogOpen: true } }));

        let lastPublishedAt = 0;

        try {
          await channel.installAndRelaunch(({ downloaded, total }) => {
            const now = performance.now();
            const complete = total !== null && downloaded >= total;

            if (!complete && now - lastPublishedAt < PROGRESS_THROTTLE_MS) return;

            lastPublishedAt = now;
            set((state) => ({ update: { ...state.update, downloaded, total } }));
          });
        } catch (error) {
          set((state) => ({
            update: { ...state.update, status: 'error', error: (error as Error).message },
          }));
        }
      },

      openUpdateDialog() {
        set((state) => ({ update: { ...state.update, dialogOpen: true } }));
      },

      closeUpdateDialog() {
        // Guarded here rather than only in the dialog, so no caller can strand an install.
        if (get().update.status === 'downloading') return;

        set((state) => ({
          update: {
            ...state.update,
            dialogOpen: false,
            // Dismissing a finished check clears it; an offered update stays on the badge.
            status: state.update.status === 'available' ? 'available' : 'idle',
            error: null,
          },
        }));
      },
    }),
    {
      name: 'spine-previewer',
      version: 1,
      // The default merge replaces nested objects wholesale, so a view flag added in a later
      // release would come back `undefined` for anyone with an older snapshot in localStorage.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;

        return {
          ...current,
          ...saved,
          view: { ...current.view, ...saved.view },
          transform: { ...current.transform, ...saved.transform },
          loadOptions: { ...current.loadOptions, ...saved.loadOptions },
        };
      },
      partialize: (state) => ({
        view: state.view,
        transform: state.transform,
        loadOptions: state.loadOptions,
        speed: state.speed,
        loop: state.loop,
        defaultMix: state.defaultMix,
        leftWidth: state.leftWidth,
        rightWidth: state.rightWidth,
      }),
    },
  ),
);

/** Name currently playing on a track, read straight off the runtime snapshot. */
function stageAnimationName(track = useAppStore.getState().track): string | null {
  return useRuntimeStore.getState().tracks.find((entry) => entry.index === track)?.animation ?? null;
}
