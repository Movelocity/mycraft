// World generation for Web Minecraft Demo
// Uses simple noise-based terrain generation

import { BlockType } from './blocks';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const SEA_LEVEL = 32;

// Simple pseudo-random noise
function hash(x: number, z: number, seed: number): number {
  let n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.3) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  // Smooth interpolation
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

export type WorldData = Map<string, BlockType>;

function blockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function getBlock(world: WorldData, x: number, y: number, z: number): BlockType {
  return world.get(blockKey(x, y, z)) ?? 'air';
}

export function setBlock(world: WorldData, x: number, y: number, z: number, type: BlockType): void {
  if (type === 'air') {
    world.delete(blockKey(x, y, z));
  } else {
    world.set(blockKey(x, y, z), type);
  }
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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function getRawTerrainHeight(biome: Biome, baseNoise: number, detailNoise: number): number {
  switch (biome) {
    case 'river':  return SEA_LEVEL - 2 - detailNoise * 2;
    case 'plains': return SEA_LEVEL + 1 + baseNoise * 5 - 2 + detailNoise * 1.5;
    case 'hills':  return SEA_LEVEL + baseNoise * 18 - 4 + detailNoise * 4;
    case 'forest': return SEA_LEVEL + 2 + baseNoise * 10 - 2 + detailNoise * 2;
    default:       return SEA_LEVEL + baseNoise * 14 - 3;
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
    case 'forest': return r > 0.82;
    case 'plains': return r > 0.97;
    case 'hills':  return r > 0.95;
    default:       return false;
  }
}

function placeTree(world: WorldData, x: number, y: number, z: number): void {
  const trunkHeight = 4 + Math.floor(Math.random() * 2);

  // Trunk
  for (let i = 0; i < trunkHeight; i++) {
    setBlock(world, x, y + i, z, 'wood');
  }

  // Leaves
  const leafY = y + trunkHeight;
  for (let lx = -2; lx <= 2; lx++) {
    for (let lz = -2; lz <= 2; lz++) {
      for (let ly = -1; ly <= 1; ly++) {
        if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
        setBlock(world, x + lx, leafY + ly, z + lz, 'leaves');
      }
    }
  }
  // Top leaf
  setBlock(world, x, leafY + 2, z, 'leaves');
  setBlock(world, x + 1, leafY + 2, z, 'leaves');
  setBlock(world, x - 1, leafY + 2, z, 'leaves');
  setBlock(world, x, leafY + 2, z + 1, 'leaves');
  setBlock(world, x, leafY + 2, z - 1, 'leaves');
}

export function generateWorld(seed: number = 42, radius: number = 24): WorldData {
  const world: WorldData = new Map();

  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      const biome = getBiome(x, z, seed);
      const terrainH = getTerrainHeight(x, z, seed);
      const riverBand = Math.abs(
        octaveNoise(x / 80, z / 80, seed + 55555, 3, 0.5) - 0.5,
      );
      const nearRiver = riverBand < 0.08;

      for (let y = 0; y <= terrainH; y++) {
        let blockType: BlockType;

        if (y === 0) {
          blockType = 'bedrock';
        } else if (y < terrainH - 4) {
          const r = hash(x, y * 31 + z, seed + 777);
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

        setBlock(world, x, y, z, blockType);
      }

      // Water fill
      if (terrainH < SEA_LEVEL) {
        for (let y = terrainH + 1; y <= SEA_LEVEL; y++) {
          setBlock(world, x, y, z, 'water');
        }
      }

      // Trees (biome-aware)
      if (terrainH >= SEA_LEVEL + 1 && shouldPlaceTree(x, z, seed, biome)) {
        placeTree(world, x, terrainH + 1, z);
      }
    }
  }

  return world;
}
