// Three.js renderer for Web Minecraft Demo
// Design: Authentic Minecraft look with procedural pixel textures

import * as THREE from 'three';
import { BLOCKS, BlockType } from './blocks';
import { WorldData, getBlock } from './world';
import { getCachedTexture } from './textures';

// Face directions: +x, -x, +y, -y, +z, -z
const FACES = [
  { dir: [1, 0, 0] as const,  corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] as const, normal: 'side' as const,   uvRot: 0 },
  { dir: [-1,0,0] as const, corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] as const, normal: 'side' as const,   uvRot: 0 },
  { dir: [0,1,0] as const,  corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] as const, normal: 'top' as const,    uvRot: 0 },
  { dir: [0,-1,0] as const, corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] as const, normal: 'bottom' as const, uvRot: 0 },
  { dir: [0,0,1] as const,  corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] as const, normal: 'side' as const,   uvRot: 0 },
  { dir: [0,0,-1] as const, corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] as const, normal: 'side' as const,   uvRot: 0 },
];

// AO brightness per face
const FACE_BRIGHTNESS: Record<string, number> = {
  top: 1.0,
  bottom: 0.5,
  side: 0.8,
};

function isOpaque(type: BlockType): boolean {
  if (type === 'air') return false;
  const def = BLOCKS[type];
  return !def.transparent && !def.liquid;
}

// Build a texture atlas for all block types
let atlasTexture: THREE.CanvasTexture | null = null;
let atlasMap: Map<string, [number, number, number, number]> = new Map(); // key -> [u0, v0, u1, v1]

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    atlasTexture?.dispose();
    atlasTexture = null;
    atlasMap.clear();
  });
}

const ATLAS_COLS = 8;
const TILE_SIZE = 16;

function buildAtlas(): { texture: THREE.CanvasTexture; map: Map<string, [number, number, number, number]> } {
  if (atlasTexture) return { texture: atlasTexture, map: atlasMap };

  const blockTypes = Object.keys(BLOCKS).filter(b => b !== 'air') as BlockType[];
  const faces: Array<'top' | 'side' | 'bottom'> = ['top', 'side', 'bottom'];

  const entries: Array<{ key: string; canvas: HTMLCanvasElement }> = [];
  for (const bt of blockTypes) {
    for (const face of faces) {
      entries.push({ key: `${bt}_${face}`, canvas: getCachedTexture(bt, face) });
    }
  }

  const rows = Math.ceil(entries.length / ATLAS_COLS);
  const atlasW = ATLAS_COLS * TILE_SIZE;
  const atlasH = rows * TILE_SIZE;

  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = atlasW;
  atlasCanvas.height = atlasH;
  const ctx = atlasCanvas.getContext('2d')!;

  const newMap = new Map<string, [number, number, number, number]>();

  entries.forEach(({ key, canvas }, i) => {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    ctx.drawImage(canvas, col * TILE_SIZE, row * TILE_SIZE);

    const u0 = col / ATLAS_COLS;
    const v0 = row / rows;
    const u1 = (col + 1) / ATLAS_COLS;
    const v1 = (row + 1) / rows;
    newMap.set(key, [u0, v0, u1, v1]);
  });

  const tex = new THREE.CanvasTexture(atlasCanvas);
  tex.flipY = false;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;

  atlasTexture = tex;
  atlasMap = newMap;

  return { texture: tex, map: newMap };
}

function getFaceUVs(blockType: BlockType, faceNormal: 'top' | 'side' | 'bottom', map: Map<string, [number, number, number, number]>): [number, number, number, number] {
  const key = `${blockType}_${faceNormal}`;
  return map.get(key) ?? [0, 0, 1, 1];
}

export function buildWorldMesh(world: WorldData): THREE.Group {
  const group = new THREE.Group();
  const { texture, map } = buildAtlas();

  // Separate opaque and transparent geometry
  const opaquePositions: number[] = [];
  const opaqueUVs: number[] = [];
  const opaqueBrightness: number[] = [];
  const opaqueIndices: number[] = [];
  let opaqueVC = 0;

  const transPositions: number[] = [];
  const transUVs: number[] = [];
  const transBrightness: number[] = [];
  const transIndices: number[] = [];
  let transVC = 0;

  for (const [key, blockType] of Array.from(world.entries())) {
    if (blockType === 'air') continue;
    const [x, y, z] = key.split(',').map(Number);
    const def = BLOCKS[blockType as BlockType];
    const isTransparent = def.transparent || def.liquid;

    for (const face of FACES) {
      const nx = x + face.dir[0];
      const ny = y + face.dir[1];
      const nz = z + face.dir[2];
      const neighbor = getBlock(world, nx, ny, nz);

      if (isOpaque(neighbor)) continue;
      if (isTransparent && neighbor === blockType) continue;

      const brightness = FACE_BRIGHTNESS[face.normal] ?? 1.0;
      const [u0, v0, u1, v1] = getFaceUVs(blockType as BlockType, face.normal, map);

      const positions = isTransparent ? transPositions : opaquePositions;
      const uvs = isTransparent ? transUVs : opaqueUVs;
      const bArr = isTransparent ? transBrightness : opaqueBrightness;
      const indices = isTransparent ? transIndices : opaqueIndices;
      const vc = isTransparent ? transVC : opaqueVC;

      for (const corner of face.corners) {
        positions.push(x + corner[0], y + corner[1], z + corner[2]);
        bArr.push(brightness, brightness, brightness);
      }

      // UV mapping for quad corners: BL, TL, TR, BR
      uvs.push(u0, v1,  u0, v0,  u1, v0,  u1, v1);

      indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);

      if (isTransparent) transVC += 4;
      else opaqueVC += 4;
    }
  }

  // Build opaque mesh
  if (opaquePositions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(opaquePositions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(opaqueUVs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(opaqueBrightness, 3));
    geo.setIndex(opaqueIndices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'opaque';
    group.add(mesh);
  }

  // Build transparent mesh
  if (transPositions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(transPositions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(transUVs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(transBrightness, 3));
    geo.setIndex(transIndices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      alphaTest: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'transparent';
    group.add(mesh);
  }

  return group;
}

export function createSkybox(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(500, 32, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x87CEEB,
    side: THREE.BackSide,
  });
  return new THREE.Mesh(geo, mat);
}

export function createSun(scene: THREE.Scene): THREE.DirectionalLight {
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
  sun.position.set(60, 120, 40);
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0x8090B0, 0.7);
  scene.add(ambient);

  // Hemisphere light for sky/ground color
  const hemi = new THREE.HemisphereLight(0x87CEEB, 0x5D8A3C, 0.4);
  scene.add(hemi);

  return sun;
}

export function createHighlightBox(): THREE.LineSegments {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
  const mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
  const highlight = new THREE.LineSegments(geo, mat);
  highlight.visible = false;
  return highlight;
}

export function createScene(canvas: HTMLCanvasElement): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
} {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x87CEEB, 50, 130);

  const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.05, 500);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  return { scene, camera, renderer };
}
