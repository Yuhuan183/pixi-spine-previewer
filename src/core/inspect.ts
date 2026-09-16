import type { SkeletonData } from '@esotericsoftware/spine-pixi-v8';

import type { AtlasPageInfo } from './loadSpine';

export interface SkinInfo {
  name: string;
  attachmentCount: number;
}

export interface AnimationInfo {
  name: string;
  duration: number;
  timelineCount: number;
}

export interface BoneInfo {
  name: string;
  parent: string | null;
  length: number;
}

export interface SlotInfo {
  name: string;
  bone: string;
  attachment: string | null;
  blendMode: string;
}

/** Read-only projection of SkeletonData for the inspector. Nothing here writes back. */
export interface SkeletonInfo {
  name: string | null;
  version: string | null;
  hash: string | null;
  fps: number;
  imagesPath: string | null;
  audioPath: string | null;
  referenceScale: number;
  setupBounds: { x: number; y: number; width: number; height: number };
  skins: SkinInfo[];
  animations: AnimationInfo[];
  bones: BoneInfo[];
  slots: SlotInfo[];
  events: string[];
  constraints: string[];
  pages: AtlasPageInfo[];
  counts: {
    bones: number;
    slots: number;
    skins: number;
    animations: number;
    events: number;
    constraints: number;
    attachments: number;
    pages: number;
  };
}

const BLEND_MODE_NAMES = ['normal', 'additive', 'multiply', 'screen'];

export function inspectSkeleton(data: SkeletonData, pages: AtlasPageInfo[]): SkeletonInfo {
  const skins = data.skins.map((skin) => ({
    name: skin.name,
    attachmentCount: skin.getAttachments().length,
  }));

  return {
    name: data.name,
    version: data.version,
    hash: data.hash,
    fps: data.fps,
    imagesPath: data.imagesPath,
    audioPath: data.audioPath,
    referenceScale: data.referenceScale,
    setupBounds: { x: data.x, y: data.y, width: data.width, height: data.height },
    skins,
    animations: data.animations.map((animation) => ({
      name: animation.name,
      duration: animation.duration,
      timelineCount: animation.timelines.length,
    })),
    bones: data.bones.map((bone) => ({
      name: bone.name,
      parent: bone.parent?.name ?? null,
      length: bone.length,
    })),
    slots: data.slots.map((slot) => ({
      name: slot.name,
      bone: slot.boneData.name,
      attachment: slot.attachmentName,
      blendMode: BLEND_MODE_NAMES[slot.blendMode] ?? String(slot.blendMode),
    })),
    events: data.events.map((event) => event.name),
    constraints: data.constraints.map((constraint) => constraint.name),
    pages,
    counts: {
      bones: data.bones.length,
      slots: data.slots.length,
      skins: data.skins.length,
      animations: data.animations.length,
      events: data.events.length,
      constraints: data.constraints.length,
      attachments: skins.reduce((sum, skin) => sum + skin.attachmentCount, 0),
      pages: pages.length,
    },
  };
}
