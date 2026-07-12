import * as THREE from 'three';

export const BLOCK_BREAK_DURATION_MS = 450;

const TEXTURE_SIZE = 16;
const STAGE_COUNT = 10;
const OVERLAY_SCALE = 1.012;

export class BreakOverlay {
  object: THREE.Mesh;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private material: THREE.MeshBasicMaterial;
  private lastStage = -1;
  private lastSeed: number | null = null;
  private stageCanvases: HTMLCanvasElement[] = [];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = TEXTURE_SIZE;
    this.canvas.height = TEXTURE_SIZE;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.flipY = false;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.02,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const geometry = new THREE.BoxGeometry(OVERLAY_SCALE, OVERLAY_SCALE, OVERLAY_SCALE);
    this.object = new THREE.Mesh(geometry, this.material);
    this.object.name = 'break_overlay';
    this.object.renderOrder = 10;
    this.object.visible = false;
  }

  setTarget(blockPos: THREE.Vector3, progress: number): void {
    const clamped = Math.max(0, Math.min(progress, 0.999));
    const stage = Math.min(STAGE_COUNT - 1, Math.floor(clamped * STAGE_COUNT));
    const seed = seedFromPosition(blockPos.x, blockPos.y, blockPos.z);

    this.object.position.set(blockPos.x + 0.5, blockPos.y + 0.5, blockPos.z + 0.5);
    this.object.visible = progress > 0;

    if (seed !== this.lastSeed) {
      this.stageCanvases = buildStageCanvases(seed);
      this.lastSeed = seed;
      this.lastStage = -1;
    }

    if (stage !== this.lastStage) {
      this.ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      this.ctx.drawImage(this.stageCanvases[stage], 0, 0);
      this.texture.needsUpdate = true;
      this.lastStage = stage;
    }
  }

  clear(): void {
    this.object.visible = false;
    this.lastStage = -1;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.texture.dispose();
    this.material.dispose();
  }
}

function buildStageCanvases(seed: number): HTMLCanvasElement[] {
  const marks = buildCorruptionMarks(seed);
  const stageCanvases: HTMLCanvasElement[] = [];
  const data = new Uint8ClampedArray(TEXTURE_SIZE * TEXTURE_SIZE * 4);

  for (let stage = 0; stage < STAGE_COUNT; stage++) {
    const progress = (stage + 1) / STAGE_COUNT;
    const coverage = 0.02 + Math.pow(progress, 1.35) * 0.54;

    for (const mark of marks) {
      if (mark.rank > coverage) break;
      const idx = mark.index * 4;
      data[idx] = mark.r;
      data[idx + 1] = mark.g;
      data[idx + 2] = mark.b;
      data[idx + 3] = Math.max(data[idx + 3], Math.floor(mark.alpha * (0.5 + progress * 0.5)));
    }

    stageCanvases.push(canvasFromData(data));
  }

  return stageCanvases;
}

interface CorruptionMark {
  index: number;
  rank: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
}

function buildCorruptionMarks(seed: number): CorruptionMark[] {
  const marks = new Map<number, CorruptionMark>();

  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const cell = hash2d(Math.floor(x / 2), Math.floor(y / 2), seed + 17);
      const fine = hash2d(x, y, seed + 31);
      const rank = Math.min(0.999, fine * 0.7 + cell * 0.3);
      addMark(marks, x, y, rank, seed, 95);
    }
  }

  const random = mulberry32(seed ^ 0x7f4a7c15);
  const clusterCount = 18;
  for (let cluster = 0; cluster < clusterCount; cluster++) {
    const cx = Math.floor(random() * TEXTURE_SIZE);
    const cy = Math.floor(random() * TEXTURE_SIZE);
    const radius = random() < 0.7 ? 1 : 2;
    const rank = Math.pow((cluster + random() * 0.65) / clusterCount, 1.15) * 0.9;

    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x < 0 || x >= TEXTURE_SIZE || y < 0 || y >= TEXTURE_SIZE) continue;
        const distance = Math.abs(x - cx) + Math.abs(y - cy);
        if (distance > radius + (random() < 0.25 ? 1 : 0)) continue;
        addMark(marks, x, y, Math.min(0.999, rank + distance * 0.025 + random() * 0.04), seed, 135);
      }
    }
  }

  return Array.from(marks.values()).sort((a, b) => a.rank - b.rank);
}

function addMark(
  marks: Map<number, CorruptionMark>,
  x: number,
  y: number,
  rank: number,
  seed: number,
  alphaBase: number,
): void {
  const index = y * TEXTURE_SIZE + x;
  const previous = marks.get(index);
  if (previous && previous.rank <= rank) return;
  marks.set(index, {
    index,
    rank,
    r: 0,
    g: 0,
    b: 0,
    alpha: alphaBase + Math.floor(hash2d(x, y, seed + 53) * 85),
  });
}

function canvasFromData(data: Uint8ClampedArray): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), TEXTURE_SIZE, TEXTURE_SIZE), 0, 0);
  return canvas;
}

function seedFromPosition(x: number, y: number, z: number): number {
  return (
    Math.imul(Math.floor(x), 73856093) ^
    Math.imul(Math.floor(y), 19349663) ^
    Math.imul(Math.floor(z), 83492791)
  ) >>> 0;
}

function hash2d(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
