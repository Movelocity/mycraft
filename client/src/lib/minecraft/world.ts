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

function getTerrainHeight(x: number, z: number, seed: number): number {
  const n = octaveNoise(x / 64, z / 64, seed, 4, 0.5);
  return Math.floor(SEA_LEVEL + n * 20 - 4);
}

function shouldPlaceTree(x: number, z: number, seed: number): boolean {
  return hash(x, z, seed + 9999) > 0.93;
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
      const terrainH = getTerrainHeight(x, z, seed);

      for (let y = 0; y <= terrainH; y++) {
        let blockType: BlockType;

        if (y === 0) {
          blockType = 'bedrock';
        } else if (y < terrainH - 4) {
          // Deep underground: ores
          const r = hash(x, y * 31 + z, seed + 777);
          if (r < 0.005) blockType = 'diamond_ore';
          else if (r < 0.015) blockType = 'gold_ore';
          else if (r < 0.04) blockType = 'iron_ore';
          else if (r < 0.08) blockType = 'coal_ore';
          else blockType = 'stone';
        } else if (y < terrainH - 1) {
          blockType = 'dirt';
        } else if (y === terrainH) {
          if (terrainH < SEA_LEVEL + 1) {
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

      // Trees on grass
      if (terrainH >= SEA_LEVEL + 1 && shouldPlaceTree(x, z, seed)) {
        placeTree(world, x, terrainH + 1, z);
      }
    }
  }

  return world;
}
