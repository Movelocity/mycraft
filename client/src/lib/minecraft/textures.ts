// Procedural block textures for Web Minecraft Demo
// Generates canvas-based pixel textures for each block face

import { BlockType } from './blocks';

const TEXTURE_SIZE = 16;

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  return canvas;
}

function noise2d(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.5453;
  return n - Math.floor(n);
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function varyColor(r: number, g: number, b: number, amount: number, seed: number, x: number, y: number): [number, number, number] {
  const n = noise2d(x, y, seed) * 2 - 1;
  const v = n * amount;
  return [
    Math.max(0, Math.min(255, r + v)),
    Math.max(0, Math.min(255, g + v)),
    Math.max(0, Math.min(255, b + v)),
  ];
}

export function generateBlockTexture(blockType: BlockType, face: 'top' | 'side' | 'bottom'): HTMLCanvasElement {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const data = imageData.data;

  const seed = blockType.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const idx = (y * TEXTURE_SIZE + x) * 4;
      let r = 0, g = 0, b = 0, a = 255;

      switch (blockType) {
        case 'grass': {
          if (face === 'top') {
            const [br, bg, bb] = varyColor(93, 138, 60, 20, seed, x, y);
            r = br; g = bg; b = bb;
          } else if (face === 'bottom') {
            const [br, bg, bb] = varyColor(139, 94, 60, 15, seed + 1, x, y);
            r = br; g = bg; b = bb;
          } else {
            // Side: top half green, bottom half dirt
            if (y < 3) {
              const [br, bg, bb] = varyColor(93, 138, 60, 15, seed + 2, x, y);
              r = br; g = bg; b = bb;
            } else {
              const [br, bg, bb] = varyColor(139, 94, 60, 15, seed + 3, x, y);
              r = br; g = bg; b = bb;
            }
          }
          break;
        }
        case 'dirt': {
          // Add some texture detail with noise
          const n = noise2d(x / 3, y / 3, seed);
          const detail = n > 0.5 ? 10 : -10;
          const [br, bg, bb] = varyColor(139, 94, 60, 20, seed, x, y);
          r = Math.max(0, Math.min(255, br + detail));
          g = Math.max(0, Math.min(255, bg + detail));
          b = Math.max(0, Math.min(255, bb + detail));
          break;
        }
        case 'stone': {
          const [br, bg, bb] = varyColor(127, 127, 127, 18, seed, x, y);
          r = br; g = bg; b = bb;
          break;
        }
        case 'cobblestone': {
          const n = noise2d(x / 4, y / 4, seed);
          const base = n > 0.5 ? 100 : 80;
          const [br, bg, bb] = varyColor(base, base, base, 12, seed + 1, x, y);
          r = br; g = bg; b = bb;
          break;
        }
        case 'sand': {
          const [br, bg, bb] = varyColor(221, 204, 136, 15, seed, x, y);
          r = br; g = bg; b = bb;
          break;
        }
        case 'wood': {
          if (face === 'top' || face === 'bottom') {
            // Ring pattern
            const cx = x - 7.5, cy = y - 7.5;
            const dist = Math.sqrt(cx * cx + cy * cy);
            const ring = Math.sin(dist * 1.2) * 0.5 + 0.5;
            const base = 150 + ring * 30;
            r = base; g = base * 0.75; b = base * 0.4;
          } else {
            // Vertical grain
            const grain = noise2d(x / 2, y / 8, seed) * 30;
            r = 122 + grain; g = 82 + grain * 0.6; b = 48 + grain * 0.3;
          }
          break;
        }
        case 'planks': {
          const plankLine = Math.floor(y / 4) % 2 === 0 ? 0 : 8;
          const grain = noise2d((x + plankLine) / 3, y / 6, seed) * 25;
          r = 200 + grain; g = 160 + grain * 0.8; b = 96 + grain * 0.4;
          break;
        }
        case 'leaves': {
          const n = noise2d(x / 2, y / 2, seed);
          if (n < 0.15) { a = 0; } // Transparent holes
          else {
            const [br, bg, bb] = varyColor(58, 122, 32, 25, seed, x, y);
            r = br; g = bg; b = bb;
          }
          break;
        }
        case 'water': {
          const wave = Math.sin(x * 0.8 + seed * 0.1) * 10;
          r = 34; g = 85 + wave; b = 170 + wave;
          a = 180;
          break;
        }
        case 'glass': {
          // Mostly transparent with edge lines
          if (x === 0 || x === 15 || y === 0 || y === 15) {
            r = 170; g = 204; b = 238; a = 200;
          } else {
            r = 170; g = 204; b = 238; a = 60;
          }
          break;
        }
        case 'bedrock': {
          const n = noise2d(x / 3, y / 3, seed);
          const base = n > 0.6 ? 60 : 40;
          r = base; g = base; b = base;
          break;
        }
        case 'coal_ore': {
          const n = noise2d(x / 2, y / 2, seed);
          if (n > 0.65) { r = 20; g = 20; b = 20; }
          else { const [br, bg, bb] = varyColor(100, 100, 100, 12, seed + 1, x, y); r = br; g = bg; b = bb; }
          break;
        }
        case 'iron_ore': {
          const n = noise2d(x / 2, y / 2, seed);
          if (n > 0.65) { r = 180; g = 150; b = 120; }
          else { const [br, bg, bb] = varyColor(100, 100, 100, 12, seed + 1, x, y); r = br; g = bg; b = bb; }
          break;
        }
        case 'gold_ore': {
          const n = noise2d(x / 2, y / 2, seed);
          if (n > 0.65) { r = 220; g = 180; b = 30; }
          else { const [br, bg, bb] = varyColor(100, 100, 100, 12, seed + 1, x, y); r = br; g = bg; b = bb; }
          break;
        }
        case 'diamond_ore': {
          const n = noise2d(x / 2, y / 2, seed);
          if (n > 0.65) { r = 60; g = 200; b = 220; }
          else { const [br, bg, bb] = varyColor(100, 100, 100, 12, seed + 1, x, y); r = br; g = bg; b = bb; }
          break;
        }
        case 'gravel': {
          const n = noise2d(x / 3, y / 3, seed);
          const base = 120 + n * 40;
          r = base; g = base; b = base - 8;
          break;
        }
        case 'snow': {
          const [br, bg, bb] = varyColor(238, 238, 255, 10, seed, x, y);
          r = br; g = bg; b = bb;
          break;
        }
        default: {
          r = 200; g = 100; b = 200;
        }
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Cache textures - clear on module reload for development
let textureCache = new Map<string, HTMLCanvasElement>();

// Force cache clear on hot reload
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    textureCache.clear();
  });
}

export function getCachedTexture(blockType: BlockType, face: 'top' | 'side' | 'bottom'): HTMLCanvasElement {
  const key = `${blockType}_${face}`;
  if (!textureCache.has(key)) {
    textureCache.set(key, generateBlockTexture(blockType, face));
  }
  return textureCache.get(key)!;
}
