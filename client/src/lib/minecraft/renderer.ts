// Three.js renderer for Web Minecraft Demo
// Design: Authentic Minecraft look with procedural pixel textures

import * as THREE from 'three';
import { BLOCKS, BlockType } from './blocks';
import { getCachedTexture } from './textures';
import { Chunk, ChunkManager, CHUNK_SIZE } from './chunk';
import type { GameTimeSnapshot } from './time';

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

let sharedOpaqueMat: THREE.MeshLambertMaterial | null = null;
let sharedTransparentMat: THREE.MeshLambertMaterial | null = null;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    atlasTexture?.dispose();
    atlasTexture = null;
    atlasMap.clear();
    sharedOpaqueMat?.dispose();
    sharedOpaqueMat = null;
    sharedTransparentMat?.dispose();
    sharedTransparentMat = null;
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

function getSharedMaterials(texture: THREE.CanvasTexture): { opaque: THREE.MeshLambertMaterial; transparent: THREE.MeshLambertMaterial } {
  if (!sharedOpaqueMat) {
    sharedOpaqueMat = new THREE.MeshLambertMaterial({ map: texture, vertexColors: true });
  }
  if (!sharedTransparentMat) {
    sharedTransparentMat = new THREE.MeshLambertMaterial({
      map: texture, vertexColors: true,
      transparent: true, opacity: 0.85, depthWrite: false, alphaTest: 0.1, side: THREE.DoubleSide,
    });
  }
  return { opaque: sharedOpaqueMat, transparent: sharedTransparentMat };
}

export function disposeChunkMesh(scene: THREE.Scene, chunkX: number, chunkZ: number): void {
  const name = `chunk_${chunkX}_${chunkZ}`;
  const obj = scene.getObjectByName(name);
  if (!obj) return;
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
  });
  scene.remove(obj);
}

// ── 区块级网格构建 ──

export function buildChunkMesh(chunk: Chunk, manager: ChunkManager): THREE.Group {
  const group = new THREE.Group();
  const { texture, map } = buildAtlas();
  const { opaque: opaqueMat, transparent: transMat } = getSharedMaterials(texture);

  const blockCount = chunk.blocks.size;
  const maxFaces = blockCount * 6;
  const maxVertices = maxFaces * 4;

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

  opaquePositions.length = 0;
  transPositions.length = 0;
  void maxVertices;

  const worldStartX = chunk.x * CHUNK_SIZE;
  const worldStartZ = chunk.z * CHUNK_SIZE;

  for (const [key, blockType] of chunk.blocks) {
    if (blockType === 'air') continue;
    const [lx, ly, lz] = key.split(',').map(Number);
    const wx = worldStartX + lx;
    const wz = worldStartZ + lz;
    const def = BLOCKS[blockType as BlockType];
    const isTransparent = def.transparent || def.liquid;

    for (const face of FACES) {
      const nwx = wx + face.dir[0];
      const nwy = ly + face.dir[1];
      const nwz = wz + face.dir[2];

      const neighbor = manager.getBlock(nwx, nwy, nwz);

      if (isOpaque(neighbor)) continue;
      if (isTransparent && neighbor === blockType) continue;

      const brightness = FACE_BRIGHTNESS[face.normal] ?? 1.0;
      const [u0, v0, u1, v1] = getFaceUVs(blockType, face.normal, map);

      const positions = isTransparent ? transPositions : opaquePositions;
      const uvs = isTransparent ? transUVs : opaqueUVs;
      const bArr = isTransparent ? transBrightness : opaqueBrightness;
      const indices = isTransparent ? transIndices : opaqueIndices;
      const vc = isTransparent ? transVC : opaqueVC;

      for (const corner of face.corners) {
        positions.push(wx + corner[0], ly + corner[1], wz + corner[2]);
        bArr.push(brightness, brightness, brightness);
      }

      uvs.push(u0, v1, u0, v0, u1, v0, u1, v1);
      indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);

      if (isTransparent) transVC += 4;
      else opaqueVC += 4;
    }
  }

  if (opaquePositions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(opaquePositions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(opaqueUVs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(opaqueBrightness, 3));
    geo.setIndex(opaqueIndices);

    const mesh = new THREE.Mesh(geo, opaqueMat);
    mesh.name = 'opaque';
    group.add(mesh);
  }

  if (transPositions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(transPositions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(transUVs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(transBrightness, 3));
    geo.setIndex(transIndices);

    const mesh = new THREE.Mesh(geo, transMat);
    mesh.name = 'transparent';
    group.add(mesh);
  }

  group.name = `chunk_${chunk.x}_${chunk.z}`;
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

export interface SkySystem {
  sun: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  hemi: THREE.HemisphereLight;
  sunMesh: THREE.Mesh;
  moonMesh: THREE.Mesh;
  cloudGroup: THREE.Group;
  skyboxMaterial: THREE.MeshBasicMaterial;
  /** Most recently applied air brightness in [0, 1]. */
  airBrightness: number;
  /** Update directional, ambient, hemisphere, skybox, and fog from a time snapshot. */
  update(snapshot: GameTimeSnapshot, scene: THREE.Scene): void;
  /** Update sun/moon position and cloud positions every frame to track camera + time. */
  updateSunDirection(snapshot: GameTimeSnapshot, camera: THREE.Camera): void;
}

const SKYBOX_RADIUS = 500;
const SUN_DISTANCE = SKYBOX_RADIUS * 0.85;
const SUN_VISUAL_DISTANCE = SKYBOX_RADIUS * 0.7;
const SUN_VISUAL_SIZE = 60;
const MOON_VISUAL_DISTANCE = SKYBOX_RADIUS * 0.7;
const MOON_VISUAL_SIZE = 40;
const CLOUD_ALTITUDE = 90;
const CLOUD_TILE = 200;
const CLOUD_COUNT_X = 3;
const CLOUD_COUNT_Z = 3;

// ── Procedural sun + moon + cloud textures ──

function buildSunTexture(): THREE.CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Outer glow ring (slightly warmer than the core).
  const coreRadius = size * 0.36;
  for (let r = size * 0.5; r > coreRadius; r -= 1) {
    const t = (r - coreRadius) / (size * 0.5 - coreRadius);
    const alpha = (1 - t) * 0.35;
    ctx.fillStyle = `rgba(255, 220, 140, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Core disc.
  ctx.fillStyle = '#FFE680';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, coreRadius, 0, Math.PI * 2);
  ctx.fill();

  // Pixel highlight.
  ctx.fillStyle = '#FFFAD0';
  ctx.fillRect(size * 0.40, size * 0.32, size * 0.16, size * 0.16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function buildMoonTexture(): THREE.CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const radius = size * 0.42;
  ctx.fillStyle = '#E8E8F2';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  ctx.fill();

  // Craters
  ctx.fillStyle = '#B8B8C6';
  ctx.beginPath();
  ctx.arc(size * 0.35, size * 0.40, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size * 0.65, size * 0.55, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size * 0.50, size * 0.70, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Outer rim shadow.
  ctx.strokeStyle = 'rgba(120, 120, 140, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function buildCloudTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Cloud silhouette built from soft circles.
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  const blobs = [
    [0.50, 0.55, 0.22],
    [0.32, 0.55, 0.18],
    [0.68, 0.55, 0.18],
    [0.42, 0.45, 0.16],
    [0.58, 0.45, 0.16],
    [0.50, 0.38, 0.14],
  ];
  for (const [cx, cy, r] of blobs) {
    ctx.beginPath();
    ctx.arc(cx * size, cy * size, r * size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft underside shadow so clouds have a tiny bit of volume.
  ctx.fillStyle = 'rgba(160, 170, 190, 0.35)';
  ctx.beginPath();
  ctx.arc(size * 0.50, size * 0.62, size * 0.20, 0, Math.PI);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function createSkySystem(scene: THREE.Scene): SkySystem {
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
  sun.position.set(60, 120, 40);
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0x8090B0, 0.7);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x87CEEB, 0x5D8A3C, 0.4);
  scene.add(hemi);

  const skybox = createSkybox();
  const skyboxMaterial = skybox.material as THREE.MeshBasicMaterial;
  scene.add(skybox);

  // ── Sun + Moon sprites (camera-facing planes on opposite sides of the orbit) ──

  const sunTexture = buildSunTexture();
  const sunMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(SUN_VISUAL_SIZE, SUN_VISUAL_SIZE),
    new THREE.MeshBasicMaterial({ map: sunTexture, transparent: true, depthWrite: false, fog: false }),
  );
  sunMesh.name = 'sunSprite';
  sunMesh.renderOrder = -1;
  scene.add(sunMesh);

  const moonTexture = buildMoonTexture();
  const moonMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(MOON_VISUAL_SIZE, MOON_VISUAL_SIZE),
    new THREE.MeshBasicMaterial({ map: moonTexture, transparent: true, depthWrite: false, fog: false }),
  );
  moonMesh.name = 'moonSprite';
  moonMesh.renderOrder = -1;
  scene.add(moonMesh);

  // ── Cloud planes (drift deterministically from worldTime) ──

  const cloudTexture = buildCloudTexture();
  const cloudMaterial = new THREE.MeshBasicMaterial({
    map: cloudTexture,
    transparent: true,
    depthWrite: false,
    fog: false,
    opacity: 0.85,
  });
  const cloudGroup = new THREE.Group();
  cloudGroup.name = 'cloudGroup';
  const cloudTiles: THREE.Mesh[] = [];
  for (let i = 0; i < CLOUD_COUNT_X * CLOUD_COUNT_Z; i++) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CLOUD_TILE, CLOUD_TILE), cloudMaterial.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    cloudTiles.push(mesh);
    cloudGroup.add(mesh);
  }
  scene.add(cloudGroup);

  const system: SkySystem = {
    sun,
    ambient,
    hemi,
    sunMesh,
    moonMesh,
    cloudGroup,
    skyboxMaterial,
    airBrightness: 1,
    update(snapshot: GameTimeSnapshot, scene: THREE.Scene) {
      const skyHex = snapshot.skyColorHex;
      const ambientHex = snapshot.ambientColorHex;

      skyboxMaterial.color.setHex(skyHex);
      scene.background = new THREE.Color(skyHex);
      if (scene.fog) {
        (scene.fog as THREE.Fog).color.setHex(skyHex);
      }

      sun.color.setHex(snapshot.directionalIntensity > 0 ? 0xfff5e0 : 0xc8d4ff);
      sun.intensity = snapshot.directionalIntensity;

      ambient.color.setHex(ambientHex);
      const baseAmbient = 0.7;
      ambient.intensity = baseAmbient * (0.55 + 0.45 * snapshot.lightLevel);

      hemi.color.setHex(skyHex);
      hemi.groundColor.setHex(0x5D8A3C);
      const baseHemi = 0.4;
      hemi.intensity = baseHemi * (0.4 + 0.6 * snapshot.lightLevel);

      // Fade sun/moon sprites with their angle relative to horizon so they
      // don't pop visibly at dawn/dusk.
      const sunAbove = Math.sin(snapshot.sunAngle);
      const moonAbove = Math.sin(snapshot.moonAngle);
      const spriteAlpha = (h: number) => Math.max(0, Math.min(1, h * 1.6 + 0.15));
      (sunMesh.material as THREE.MeshBasicMaterial).opacity = spriteAlpha(sunAbove);
      (moonMesh.material as THREE.MeshBasicMaterial).opacity = spriteAlpha(moonAbove);

      // Cloud opacity dips slightly at night so the sky reads as darker.
      const cloudOpacityBase = 0.85 * (0.45 + 0.55 * snapshot.lightLevel);
      for (const tile of cloudTiles) {
        (tile.material as THREE.MeshBasicMaterial).opacity = cloudOpacityBase;
      }

      system.airBrightness = snapshot.lightLevel;
    },
    updateSunDirection(snapshot: GameTimeSnapshot, camera: THREE.Camera) {
      // Light direction: sun on a sphere around the camera.
      const sx = Math.cos(snapshot.sunAngle) * SUN_DISTANCE;
      const sy = Math.sin(snapshot.sunAngle) * SUN_DISTANCE;
      const sz = Math.sin(snapshot.sunAngle * 0.5) * SUN_DISTANCE * 0.3;
      sun.position.set(camera.position.x + sx, camera.position.y + sy, camera.position.z + sz);
      sun.target.position.set(camera.position.x, camera.position.y, camera.position.z);
      sun.target.updateMatrixWorld();

      // Sun sprite position (mirrors light direction).
      const vx = Math.cos(snapshot.sunAngle) * SUN_VISUAL_DISTANCE;
      const vy = Math.sin(snapshot.sunAngle) * SUN_VISUAL_DISTANCE;
      sunMesh.position.set(camera.position.x + vx, camera.position.y + vy, camera.position.z);
      sunMesh.lookAt(camera.position);

      // Moon sprite — opposite side of the same orbit.
      const mx = Math.cos(snapshot.moonAngle) * MOON_VISUAL_DISTANCE;
      const my = Math.sin(snapshot.moonAngle) * MOON_VISUAL_DISTANCE;
      moonMesh.position.set(camera.position.x + mx, camera.position.y + my, camera.position.z);
      moonMesh.lookAt(camera.position);

      // Cloud tiles form a moving grid centered around the camera. The grid
      // moves with worldTime so cloud position is deterministic across saves.
      const tileSpan = CLOUD_TILE * 1.4;
      const ox = ((snapshot.cloudOffset * 8) % tileSpan + tileSpan) % tileSpan;
      const oz = ((snapshot.cloudOffset * 5) % tileSpan + tileSpan) % tileSpan;
      const baseX = camera.position.x - Math.floor(CLOUD_COUNT_X / 2) * tileSpan - ox;
      const baseZ = camera.position.z - Math.floor(CLOUD_COUNT_Z / 2) * tileSpan - oz;
      let idx = 0;
      for (let gx = 0; gx < CLOUD_COUNT_X; gx++) {
        for (let gz = 0; gz < CLOUD_COUNT_Z; gz++) {
          const tile = cloudTiles[idx++];
          tile.position.set(
            baseX + gx * tileSpan,
            camera.position.y + CLOUD_ALTITUDE,
            baseZ + gz * tileSpan,
          );
        }
      }
    },
  };

  return system;
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
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 50, 130);

  const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.05, 500);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  return { scene, camera, renderer };
}
