import { Skin, SpineDebugRenderer, type Spine, type TrackEntry } from '@esotericsoftware/spine-pixi-v8';
import { Application, Container, Graphics, RendererType, Texture, TilingSprite } from 'pixi.js';
// Pixi builds shader uniform code with `new Function` by default. The packaged app runs
// under a CSP without `unsafe-eval`, so this swaps in the interpreted implementation —
// import it before any Application is created.
import 'pixi.js/unsafe-eval';

export interface ViewConfig {
  /** CSS hex for the solid backdrop, e.g. `#12151c`. */
  background: string;
  checkerboard: boolean;
  grid: boolean;
  origin: boolean;
  boundsBox: boolean;
  bones: boolean;
  regions: boolean;
  meshHull: boolean;
  meshTriangles: boolean;
  boundingBoxes: boolean;
  clipping: boolean;
  paths: boolean;
  events: boolean;
}

export interface TransformConfig {
  offsetX: number;
  offsetY: number;
  flipX: boolean;
  flipY: boolean;
}

export interface TrackSnapshot {
  index: number;
  animation: string;
  loop: boolean;
  time: number;
  duration: number;
  alpha: number;
}

export interface StageStats {
  fps: number;
  zoom: number;
  tracks: TrackSnapshot[];
  bounds: { x: number; y: number; width: number; height: number } | null;
  /** Wall-clock seconds the current asset has been advancing, ignoring pauses. */
  elapsed: number;
}

export interface SpineEventLine {
  id: number;
  time: number;
  name: string;
  track: number;
  detail: string;
}

export const DEFAULT_VIEW: ViewConfig = {
  background: '#0e1117',
  checkerboard: false,
  grid: true,
  origin: true,
  boundsBox: false,
  bones: false,
  regions: false,
  meshHull: false,
  meshTriangles: false,
  boundingBoxes: false,
  clipping: false,
  paths: false,
  events: false,
};

export const DEFAULT_TRANSFORM: TransformConfig = { offsetX: 0, offsetY: 0, flipX: false, flipY: false };

const GRID_STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500];
const GRID_EXTENT = 6000;
const MIN_ZOOM = 0.02;
const MAX_ZOOM = 40;
const STATS_INTERVAL_MS = 50;

/**
 * Owns the whole Pixi side of the previewer: one Application, one camera, one skeleton.
 *
 * React never touches Pixi objects; it calls these methods and receives plain snapshots
 * through `onStats`. That split is what keeps 60 fps playback from re-rendering the UI —
 * the only per-frame React work is a throttled stats update.
 */
export class PreviewStage {
  private app: Application | null = null;
  private resizeObserver: ResizeObserver | null = null;

  /**
   * Bumped by every init and every destroy. An init that finishes after its generation
   * has moved on throws its Application away — without it, React StrictMode's
   * mount/unmount/mount leaves two live renderers fighting over one canvas host.
   */
  private generation = 0;

  // Built per init: `app.destroy({ children: true })` destroys these too, so they cannot
  // be created once as field initializers and reused across a remount.
  private backdrop!: Graphics;
  private checker!: TilingSprite;
  private world!: Container;
  private gridLayer!: Graphics;
  private content!: Container;
  private originLayer!: Graphics;
  private boundsLayer!: Graphics;

  private spine: Spine | null = null;
  private debugRenderer = new SpineDebugRenderer();
  private view: ViewConfig = { ...DEFAULT_VIEW };
  private transform: TransformConfig = { ...DEFAULT_TRANSFORM };

  private zoom = 1;
  private panX = 0;
  private panY = 0;

  private playing = true;
  private speed = 1;
  private elapsed = 0;
  private eventSeq = 0;
  private lastStatsAt = 0;
  /** Zoom the grid geometry was last built for; panning must not rebuild ~2 000 segments. */
  private gridBuiltAtZoom: number | null = null;

  onStats: ((stats: StageStats) => void) | null = null;
  onSpineEvent: ((line: SpineEventLine) => void) | null = null;

  async init(host: HTMLElement): Promise<void> {
    const generation = ++this.generation;

    this.teardown();

    const app = new Application();

    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      preference: 'webgl',
    });

    if (generation !== this.generation) {
      app.destroy(true, { children: true });

      return;
    }

    this.app = app;
    host.append(app.canvas);

    this.backdrop = new Graphics();
    this.checker = new TilingSprite({ texture: makeCheckerTexture(), width: 10, height: 10 });
    this.checker.visible = false;
    this.world = new Container();
    this.gridLayer = new Graphics();
    this.content = new Container();
    this.originLayer = new Graphics();
    this.boundsLayer = new Graphics();

    this.content.addChild(this.originLayer, this.boundsLayer);
    this.world.addChild(this.gridLayer, this.content);
    app.stage.addChild(this.backdrop, this.checker, this.world);

    app.ticker.add(() => this.tick());
    // Pixi's `resizeTo` only listens to window resize; the host also changes size when a
    // rail is dragged, so the observer has to push the new size into the renderer itself.
    this.resizeObserver = new ResizeObserver(() => {
      app.resize();
      this.layout();
    });
    this.resizeObserver.observe(host);
    this.layout();
    this.applyView();
  }

  destroy(): void {
    this.generation += 1;
    this.teardown();
  }

  private teardown(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (!this.app) return;

    this.clearSpine();
    this.app.destroy(true, { children: true });
    this.app = null;
  }

  get ready(): boolean {
    return this.app !== null;
  }

  get rendererName(): string {
    return this.app?.renderer.type === RendererType.WEBGPU ? 'WebGPU' : 'WebGL';
  }

  // ---------------------------------------------------------------- asset

  setSpine(spine: Spine | null): void {
    this.clearSpine();

    if (!spine || !this.app) return;

    this.spine = spine;
    spine.autoUpdate = false;
    spine.state.addListener({
      event: (entry, event) => {
        this.eventSeq += 1;
        this.onSpineEvent?.({
          id: this.eventSeq,
          time: Number(event.time.toFixed(3)),
          name: event.data.name,
          track: entry.trackIndex,
          detail: [
            event.intValue ? `int ${event.intValue}` : '',
            event.floatValue ? `float ${event.floatValue}` : '',
            event.stringValue ? `str ${event.stringValue}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
        });
      },
    });
    this.content.addChildAt(spine, 0);
    this.elapsed = 0;
    this.applyDebug();
    this.applyTransform();
  }

  private clearSpine(): void {
    if (!this.spine) return;

    this.spine.debug = undefined;
    this.spine.state.clearListeners();
    this.content.removeChild(this.spine);
    this.spine.destroy();
    this.spine = null;
    this.boundsLayer.clear();
  }

  // ------------------------------------------------------------- playback

  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setAnimation(trackIndex: number, name: string, loop: boolean): TrackEntry | null {
    if (!this.spine) return null;

    const entry = this.spine.state.setAnimation(trackIndex, name, loop);

    this.spine.update(0);

    return entry;
  }

  clearTrack(trackIndex: number): void {
    if (!this.spine) return;

    this.spine.state.clearTrack(trackIndex);
    this.spine.skeleton.setupPose();
    this.spine.update(0);
  }

  clearAllTracks(): void {
    if (!this.spine) return;

    this.spine.state.clearTracks();
    this.spine.skeleton.setupPose();
    this.spine.update(0);
  }

  setLoop(trackIndex: number, loop: boolean): void {
    const entry = this.spine?.state.tracks[trackIndex];

    if (entry) entry.loop = loop;
  }

  restart(trackIndex: number): void {
    const entry = this.spine?.state.tracks[trackIndex];

    if (!entry || !this.spine) return;

    entry.trackTime = 0;
    this.spine.update(0);
  }

  seek(trackIndex: number, time: number): void {
    const entry = this.spine?.state.tracks[trackIndex];

    if (!entry || !this.spine) return;

    entry.trackTime = time;
    // dt 0 re-applies the pose at the new track time without advancing the state queue.
    this.spine.update(0);
  }

  setDefaultMix(duration: number): void {
    if (this.spine) this.spine.state.data.defaultMix = duration;
  }

  /** Replaces the active skin set; an empty list falls back to the skeleton's default skin. */
  setSkins(names: string[]): void {
    if (!this.spine) return;

    const { skeleton } = this.spine;
    const data = skeleton.data;

    if (names.length === 0) {
      skeleton.setSkin(data.defaultSkin);
    } else if (names.length === 1) {
      skeleton.setSkin(names[0]!);
    } else {
      // Spine has no multi-skin setter; combining into a throwaway skin is the documented way.
      const combined = new Skin('previewer-combined');

      for (const name of names) {
        const skin = data.findSkin(name);

        if (skin) combined.addSkin(skin);
      }

      skeleton.setSkin(combined);
    }

    skeleton.setupPoseSlots();
    this.spine.update(0);
  }

  // ----------------------------------------------------------------- view

  setView(view: ViewConfig): void {
    this.view = view;
    this.applyView();
  }

  setTransform(transform: TransformConfig): void {
    this.transform = transform;
    this.applyTransform();
  }

  private applyView(): void {
    if (!this.app) return;

    this.backdrop.tint = this.view.background;
    if (this.checker) this.checker.visible = this.view.checkerboard;
    this.gridLayer.visible = this.view.grid;
    this.originLayer.visible = this.view.origin;
    this.boundsLayer.visible = this.view.boundsBox;
    this.drawGrid();
    this.drawOrigin();
    this.applyDebug();
  }

  private applyDebug(): void {
    if (!this.spine) return;

    const { view } = this;
    const anyDebug =
      view.bones || view.regions || view.meshHull || view.meshTriangles || view.boundingBoxes || view.clipping || view.paths || view.events;

    if (!anyDebug) {
      this.spine.debug = undefined;

      return;
    }

    const renderer = this.debugRenderer;

    renderer.drawBones = view.bones;
    renderer.drawRegionAttachments = view.regions;
    renderer.drawMeshHull = view.meshHull;
    renderer.drawMeshTriangles = view.meshTriangles;
    renderer.drawBoundingBoxes = view.boundingBoxes;
    renderer.drawClipping = view.clipping;
    renderer.drawPaths = view.paths;
    renderer.drawEvents = view.events;
    this.spine.debug = renderer;
  }

  private applyTransform(): void {
    if (!this.app) return;

    this.content.position.set(this.transform.offsetX, this.transform.offsetY);
    this.content.scale.set(this.transform.flipX ? -1 : 1, this.transform.flipY ? -1 : 1);
  }

  // --------------------------------------------------------------- camera

  getZoom(): number {
    return this.zoom;
  }

  setZoom(zoom: number, anchor?: { x: number; y: number }): void {
    if (!this.app) return;

    const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    const { width, height } = this.app.screen;
    const point = anchor ?? { x: width / 2, y: height / 2 };
    const worldX = (point.x - (width / 2 + this.panX)) / this.zoom;
    const worldY = (point.y - (height / 2 + this.panY)) / this.zoom;

    this.zoom = next;
    this.panX = point.x - width / 2 - worldX * next;
    this.panY = point.y - height / 2 - worldY * next;
    this.layout();
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.layout();
  }

  resetView(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.layout();
  }

  /** Frames the current skeleton with a margin; falls back to the setup-pose size. */
  fitToContent(margin = 0.82): void {
    if (!this.app) return;

    const bounds = this.measureBounds();

    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      this.resetView();

      return;
    }

    const { width, height } = this.app.screen;
    const zoom = clamp(Math.min(width / bounds.width, height / bounds.height) * margin, MIN_ZOOM, MAX_ZOOM);
    const centerX = this.transform.offsetX + bounds.x + bounds.width / 2;
    const centerY = this.transform.offsetY - bounds.y - bounds.height / 2;

    this.zoom = zoom;
    this.panX = -centerX * zoom;
    this.panY = -centerY * zoom;
    this.layout();
  }

  private measureBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this.spine) return null;

    const rect = this.spine.skeleton.getBoundsRect();

    if (Number.isFinite(rect.width) && rect.width > 0) return rect;

    const data = this.spine.skeleton.data;

    return data.width > 0 ? { x: data.x, y: data.y, width: data.width, height: data.height } : null;
  }

  private layout(): void {
    if (!this.app) return;

    const { width, height } = this.app.screen;

    this.backdrop.clear().rect(0, 0, width, height).fill(0xffffff);
    this.backdrop.tint = this.view.background;

    if (this.checker) {
      this.checker.width = width;
      this.checker.height = height;
    }

    this.world.scale.set(this.zoom);
    this.world.position.set(width / 2 + this.panX, height / 2 + this.panY);
    // Helper strokes are one screen pixel wide, so both depend on the zoom, not just the grid.
    this.drawGrid();
    this.drawOrigin();
  }

  // ---------------------------------------------------------------- frame

  private tick(): void {
    const app = this.app;

    if (!app) return;

    const dt = app.ticker.deltaMS / 1000;

    if (this.spine && this.playing) {
      this.spine.update(dt * this.speed);
      this.elapsed += dt * this.speed;
    }

    if (this.view.boundsBox) this.drawBounds();

    const now = performance.now();

    if (now - this.lastStatsAt >= STATS_INTERVAL_MS) {
      this.lastStatsAt = now;
      this.onStats?.({
        fps: Math.round(app.ticker.FPS),
        zoom: this.zoom,
        elapsed: this.elapsed,
        bounds: this.measureBounds(),
        tracks: this.snapshotTracks(),
      });
    }
  }

  private snapshotTracks(): TrackSnapshot[] {
    if (!this.spine) return [];

    const out: TrackSnapshot[] = [];

    this.spine.state.tracks.forEach((entry, index) => {
      if (!entry?.animation) return;

      out.push({
        index,
        animation: entry.animation.name,
        loop: entry.loop,
        time: entry.loop && entry.animation.duration > 0 ? entry.trackTime % entry.animation.duration : entry.trackTime,
        duration: entry.animation.duration,
        alpha: entry.alpha,
      });
    });

    return out;
  }

  private drawBounds(): void {
    if (!this.app) return;

    const bounds = this.measureBounds();

    this.boundsLayer.clear();

    if (!bounds) return;

    // Skeleton space is y-up, the Pixi container is y-down: mirror the rect on Y.
    this.boundsLayer
      .rect(bounds.x, -bounds.y - bounds.height, bounds.width, bounds.height)
      .stroke({ width: 1 / this.zoom, color: 0x38bdf8, alpha: 0.9 });
  }

  private drawOrigin(): void {
    if (!this.app) return;

    const size = 40;

    this.originLayer
      .clear()
      .moveTo(-size, 0)
      .lineTo(size, 0)
      .moveTo(0, -size)
      .lineTo(0, size)
      .stroke({ width: 1 / this.zoom, color: 0xf97316, alpha: 0.85 });
  }

  private drawGrid(): void {
    if (!this.app || !this.view.grid) {
      this.gridBuiltAtZoom = null;

      return;
    }

    if (this.gridBuiltAtZoom === this.zoom) return;

    this.gridBuiltAtZoom = this.zoom;

    const step = GRID_STEPS.find((candidate) => candidate * this.zoom >= 28) ?? GRID_STEPS.at(-1)!;

    this.gridLayer.clear();

    const lineWidth = 1 / this.zoom;

    for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += step) {
      this.gridLayer.moveTo(x, -GRID_EXTENT).lineTo(x, GRID_EXTENT);
    }

    for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += step) {
      this.gridLayer.moveTo(-GRID_EXTENT, y).lineTo(GRID_EXTENT, y);
    }

    this.gridLayer.stroke({ width: lineWidth, color: 0xffffff, alpha: 0.06 });

    for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += step * 5) {
      this.gridLayer.moveTo(x, -GRID_EXTENT).lineTo(x, GRID_EXTENT);
    }

    for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += step * 5) {
      this.gridLayer.moveTo(-GRID_EXTENT, y).lineTo(GRID_EXTENT, y);
    }

    this.gridLayer.stroke({ width: lineWidth, color: 0xffffff, alpha: 0.12 });
  }

  /** Renders the current frame to a PNG blob; `transparent` drops the backdrop and helpers. */
  async screenshot(transparent: boolean): Promise<Blob | null> {
    if (!this.app) return null;

    const hidden: Container[] = [];

    if (transparent) {
      for (const layer of [this.backdrop, this.checker, this.gridLayer, this.originLayer, this.boundsLayer]) {
        if (layer && layer.visible) {
          layer.visible = false;
          hidden.push(layer);
        }
      }
    }

    this.app.renderer.render(this.app.stage);

    const canvas = this.app.renderer.extract.canvas(this.app.stage) as HTMLCanvasElement;

    for (const layer of hidden) layer.visible = true;

    return new Promise((resolve) => {
      if (typeof canvas.toBlob !== 'function') {
        resolve(null);

        return;
      }

      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function makeCheckerTexture(): Texture {
  const size = 16;
  const canvas = document.createElement('canvas');

  canvas.width = size * 2;
  canvas.height = size * 2;

  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#20242e';
  ctx.fillRect(0, 0, size * 2, size * 2);
  ctx.fillStyle = '#171a22';
  ctx.fillRect(0, 0, size, size);
  ctx.fillRect(size, size, size, size);

  return Texture.from(canvas);
}
