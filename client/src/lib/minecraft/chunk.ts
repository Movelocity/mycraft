// Chunk manager for Web Minecraft Demo
// Manages chunk-based world generation and block access

import { BlockType } from './blocks';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const SEA_LEVEL = 32;

// Distance parameters (in chunks)
export const GENERATE_DISTANCE = 4;
export const RENDER_DISTANCE = 3;
export const UNLOAD_DISTANCE = 6;

export interface Chunk {
  x: number;           // 区块坐标 X
  z: number;           // 区块坐标 Z
  blocks: Map<string, BlockType>;  // "localX,localY,localZ" → BlockType
  dirty: boolean;      // 是否需要重建网格
}

// ── 坐标转换 ──

export function worldToChunk(x: number, z: number): [chunkX: number, chunkZ: number] {
  return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
}

export function worldToLocal(x: number, y: number, z: number): [lx: number, ly: number, lz: number] {
  const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return [lx, y, lz];
}

export function chunkToWorld(chunkX: number, chunkZ: number): [x: number, z: number] {
  return [chunkX * CHUNK_SIZE, chunkZ * CHUNK_SIZE];
}

function chunkKey(chunkX: number, chunkZ: number): string {
  return `${chunkX},${chunkZ}`;
}

function blockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

// ── 噪声函数 (确定性) ──

function hash(x: number, z: number, seed: number): number {
  let n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.3) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function octaveNoise(x: number, z: number, seed: number, octaves: number, persistence: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, z * frequency, seed + i * 1000) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return value / maxValue;
}

type Biome = 'plains' | 'hills' | 'river' | 'forest';

function getBiome(x: number, z: number, seed: number): Biome {
  const biomeNoise = octaveNoise(x / 256, z / 256, seed + 31337, 2, 0.5);
  const riverNoise = octaveNoise(x / 80, z / 80, seed + 55555, 3, 0.5);
  const riverBand = Math.abs(riverNoise - 0.5);

  if (riverBand < 0.018) return 'river';
  if (biomeNoise < 0.35) return 'plains';
  if (biomeNoise < 0.60) return 'hills';
  if (biomeNoise < 0.72) return 'forest';
  return 'hills';
}

// 平滑阶梯函数 smoothstep
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function getRawTerrainHeight(biome: Biome, baseNoise: number, detailNoise: number): number {
  switch (biome) {
    case 'river':
      return SEA_LEVEL - 2 - detailNoise * 2;
    case 'plains':
      return SEA_LEVEL + 1 + baseNoise * 5 - 2 + detailNoise * 1.5;
    case 'hills':
      return SEA_LEVEL + baseNoise * 18 - 4 + detailNoise * 4;
    case 'forest':
      return SEA_LEVEL + 2 + baseNoise * 10 - 2 + detailNoise * 2;
    default:
      return SEA_LEVEL + baseNoise * 14 - 3;
  }
}

function getTerrainHeight(x: number, z: number, seed: number): number {
  const baseNoise = octaveNoise(x / 96, z / 96, seed, 4, 0.5);
  const detailNoise = octaveNoise(x / 32, z / 32, seed + 2000, 2, 0.4);

  const riverNoise = octaveNoise(x / 80, z / 80, seed + 55555, 3, 0.5);
  const riverBand = Math.abs(riverNoise - 0.5);

  const RIVER_EDGE = 0.018;
  const RIVER_SHORE = 0.08;

  let height: number;

  if (riverBand < RIVER_EDGE) {
    height = SEA_LEVEL - 3 - detailNoise * 3;
  } else if (riverBand < RIVER_SHORE) {
    const biome = getBiome(x, z, seed);
    const landHeight = getRawTerrainHeight(biome, baseNoise, detailNoise);
    const riverHeight = SEA_LEVEL - 3 - detailNoise * 3;
    const t = smoothstep(RIVER_EDGE, RIVER_SHORE, riverBand);
    // 纯线性插值；landHeight 可能低于海平面，钳制公式在该情形下单调性错误
    height = riverHeight + (landHeight - riverHeight) * t;
  } else {
    const biome = getBiome(x, z, seed);
    height = getRawTerrainHeight(biome, baseNoise, detailNoise);
  }

  return Math.max(1, Math.min(WORLD_HEIGHT - 2, Math.floor(height)));
}

function shouldPlaceTree(x: number, z: number, seed: number, biome: Biome): boolean {
  const r = hash(x, z, seed + 9999);
  switch (biome) {
    case 'forest': return r > 0.82;  // ~18% — 森林茂密
    case 'plains': return r > 0.97;  // ~3%  — 平原偶有孤树
    case 'hills':  return r > 0.95;  // ~5%  — 山丘少量树
    default:       return false;
  }
}

// ── 区块生成 ──

export function generateChunk(chunkX: number, chunkZ: number, seed: number): Chunk {
  const blocks = new Map<string, BlockType>();
  const [startX, startZ] = chunkToWorld(chunkX, chunkZ);

  for (let localX = 0; localX < CHUNK_SIZE; localX++) {
    for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
      const worldX = startX + localX;
      const worldZ = startZ + localZ;
      const biome = getBiome(worldX, worldZ, seed);
      const terrainH = getTerrainHeight(worldX, worldZ, seed);
      const riverBand = Math.abs(
        octaveNoise(worldX / 80, worldZ / 80, seed + 55555, 3, 0.5) - 0.5,
      );
      const nearRiver = riverBand < 0.08;

      for (let y = 0; y <= terrainH; y++) {
        let blockType: BlockType;

        if (y === 0) {
          blockType = 'bedrock';
        } else if (y < terrainH - 4) {
          const r = hash(worldX, y * 31 + worldZ, seed + 777);
          if (r < 0.005) blockType = 'diamond_ore';
          else if (r < 0.015) blockType = 'gold_ore';
          else if (r < 0.04) blockType = 'iron_ore';
          else if (r < 0.08) blockType = 'coal_ore';
          else blockType = 'stone';
        } else if (y < terrainH - 1) {
          blockType = 'dirt';
        } else if (y === terrainH) {
          if (terrainH < SEA_LEVEL + 1 || nearRiver) {
            blockType = 'sand';
          } else {
            blockType = 'grass';
          }
        } else {
          blockType = 'dirt';
        }

        blocks.set(blockKey(localX, y, localZ), blockType);
      }

      // Water fill
      if (terrainH < SEA_LEVEL) {
        for (let y = terrainH + 1; y <= SEA_LEVEL; y++) {
          blocks.set(blockKey(localX, y, localZ), 'water');
        }
      }

      // Trees (deterministic, biome-aware)
      if (terrainH >= SEA_LEVEL + 1 && shouldPlaceTree(worldX, worldZ, seed, biome)) {
        placeTree(blocks, localX, terrainH + 1, localZ);
      }
    }
  }

  return { x: chunkX, z: chunkZ, blocks, dirty: true };
}

function placeTree(blocks: Map<string, BlockType>, x: number, y: number, z: number): void {
  const trunkHeight = 4 + Math.floor(hash(x, z, 12345) * 2);

  for (let i = 0; i < trunkHeight; i++) {
    blocks.set(blockKey(x, y + i, z), 'wood');
  }

  const leafY = y + trunkHeight;
  for (let lx = -2; lx <= 2; lx++) {
    for (let lz = -2; lz <= 2; lz++) {
      for (let ly = -1; ly <= 1; ly++) {
        if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
        const bx = x + lx, by = leafY + ly, bz = z + lz;
        if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && by >= 0 && by < WORLD_HEIGHT) {
          blocks.set(blockKey(bx, by, bz), 'leaves');
        }
      }
    }
  }

  const topPositions = [[0, 2, 0], [1, 2, 0], [-1, 2, 0], [0, 2, 1], [0, 2, -1]];
  for (const [dx, dy, dz] of topPositions) {
    const bx = x + dx, by = leafY + dy, bz = z + dz;
    if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && by >= 0 && by < WORLD_HEIGHT) {
      blocks.set(blockKey(bx, by, bz), 'leaves');
    }
  }
}

// ── ChunkManager ──

export class ChunkManager {
  chunks = new Map<string, Chunk>();
  seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  getChunk(chunkX: number, chunkZ: number): Chunk | undefined {
    return this.chunks.get(chunkKey(chunkX, chunkZ));
  }

  getOrGenerateChunk(chunkX: number, chunkZ: number): Chunk {
    const key = chunkKey(chunkX, chunkZ);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = generateChunk(chunkX, chunkZ, this.seed);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (y < 0 || y >= WORLD_HEIGHT) return 'air';
    const [chunkX, chunkZ] = worldToChunk(x, z);
    const chunk = this.getChunk(chunkX, chunkZ);
    if (!chunk) {
      // 邻居区块未加载时，用地形函数推算，防止水/实体方块侧面暴露
      const h = getTerrainHeight(x, z, this.seed);
      if (y <= h) return 'stone';
      if (y <= SEA_LEVEL) return 'water';
      return 'air';
    }
    const [lx, ly, lz] = worldToLocal(x, y, z);
    return chunk.blocks.get(blockKey(lx, ly, lz)) ?? 'air';
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const [chunkX, chunkZ] = worldToChunk(x, z);
    const chunk = this.getOrGenerateChunk(chunkX, chunkZ);
    const [lx, ly, lz] = worldToLocal(x, y, z);
    if (type === 'air') {
      chunk.blocks.delete(blockKey(lx, ly, lz));
    } else {
      chunk.blocks.set(blockKey(lx, ly, lz), type);
    }
    chunk.dirty = true;

    // Mark adjacent chunks dirty if block is on border
    if (lx === 0) this.markDirty(chunkX - 1, chunkZ);
    if (lx === CHUNK_SIZE - 1) this.markDirty(chunkX + 1, chunkZ);
    if (lz === 0) this.markDirty(chunkX, chunkZ - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(chunkX, chunkZ + 1);
  }

  private markDirty(chunkX: number, chunkZ: number): void {
    const chunk = this.getChunk(chunkX, chunkZ);
    if (chunk) chunk.dirty = true;
  }

  getLoadedChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  getDirtyChunks(): Chunk[] {
    return this.getLoadedChunks().filter(c => c.dirty);
  }

  getChunkCount(): number {
    return this.chunks.size;
  }

  // ── 区块加载调度 (每帧调用) ──

  update(playerX: number, playerZ: number): { loaded: Chunk[]; unloaded: [number, number][] } {
    const [playerChunkX, playerChunkZ] = worldToChunk(playerX, playerZ);
    const loaded: Chunk[] = [];
    const unloaded: [number, number][] = [];

    // 1. 加载生成距离内的区块
    const toLoad: [number, number, number][] = []; // [chunkX, chunkZ, distSq]
    for (let dx = -GENERATE_DISTANCE; dx <= GENERATE_DISTANCE; dx++) {
      for (let dz = -GENERATE_DISTANCE; dz <= GENERATE_DISTANCE; dz++) {
        const distSq = dx * dx + dz * dz;
        if (distSq > GENERATE_DISTANCE * GENERATE_DISTANCE) continue;
        const cx = playerChunkX + dx;
        const cz = playerChunkZ + dz;
        if (!this.getChunk(cx, cz)) {
          toLoad.push([cx, cz, distSq]);
        }
      }
    }

    // 按距离排序，优先加载近的
    toLoad.sort((a, b) => a[2] - b[2]);

    // 每帧最多加载 1 个区块
    if (toLoad.length > 0) {
      const [cx, cz] = toLoad[0];
      const chunk = this.getOrGenerateChunk(cx, cz);
      loaded.push(chunk);
    }

    // 2. 卸载超出卸载距离的区块
    for (const [key, chunk] of Array.from(this.chunks)) {
      const dx = chunk.x - playerChunkX;
      const dz = chunk.z - playerChunkZ;
      const distSq = dx * dx + dz * dz;
      if (distSq > UNLOAD_DISTANCE * UNLOAD_DISTANCE) {
        this.chunks.delete(key);
        unloaded.push([chunk.x, chunk.z]);
      }
    }

    return { loaded, unloaded };
  }
}
