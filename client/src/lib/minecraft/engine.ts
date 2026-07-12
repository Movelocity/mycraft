import * as THREE from 'three';
import { BLOCKS, HOTBAR_BLOCKS, type BlockType } from './blocks';
import { ChunkManager, ChangesIndex, RENDER_DISTANCE } from './chunk';
import {
  buildChunkMesh,
  disposeChunkMesh,
  createHighlightBox,
  createScene,
  createSkySystem,
  type SkySystem,
} from './renderer';
import {
  createPlayerState,
  updatePlayer,
  applyPlayerToCamera,
  getTargetBlock,
  isPlayerOverlappingBlock,
  type InputState,
  type PlayerState,
} from './player';
import { BreakOverlay } from './breakOverlay';
import { GameTime } from './time';

export interface GameLoadData {
  seed?: number;
  changes?: [number, number, number, BlockType][];
  changesIndex?: ChangesIndex;
  player?: {
    position: { x: number; y: number; z: number };
    yaw: number;
    pitch: number;
    flying: boolean;
  };
  hotbarIndex?: number;
  worldTime?: number;
}

export interface GameSnapshot {
  x: number;
  y: number;
  z: number;
  fps: number;
  flying: boolean;
  targetBlock: string;
  chunks: number;
  underwater: boolean;
  hotbarIndex: number;
}

const MAX_REBUILDS_PER_FRAME = 2;

export class GameEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  chunkManager: ChunkManager;
  playerState: PlayerState;
  input: InputState;
  highlight: THREE.LineSegments;
  breakOverlay: BreakOverlay;
  hotbarIndex: number;
  locked = false;
  seed: number;
  gameTime: GameTime;
  skySystem: SkySystem;

  // Pause contract: when `paused` is true, the simulation freezes —
  // player physics, world streaming, and GameTime advancement all halt.
  // The renderer still runs so the paused overlay keeps rendering.
  // This is intentional: an in-progress day should not advance behind
  // the pause menu.
  paused = false;

  setPaused(value: boolean) {
    if (value && !this.paused) {
      // Reset lastTime so the next dt doesn't include the pause duration.
      this.lastTime = performance.now();
      this._wasPaused = true;
    }
    this.paused = value;
  }

  private animFrame = 0;
  private lastTime = 0;
  private fpsCount = 0;
  private fpsTimer = 0;
  private fps = 0;
  private underwater = false;

  private onUnderwaterChange?: (v: boolean) => void;
  private onFlyingChange?: (v: boolean) => void;
  private onDebugUpdate?: (snap: Omit<GameSnapshot, 'underwater' | 'hotbarIndex'>) => void;

  constructor(
    canvas: HTMLCanvasElement,
    loadData?: GameLoadData,
  ) {
    const { scene, camera, renderer } = createScene(canvas);
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.skySystem = createSkySystem(scene);

    this.seed = loadData?.seed ?? Math.floor(Math.random() * 99999);

    const changesIndex = loadData?.changesIndex instanceof ChangesIndex
      ? loadData.changesIndex
      : new ChangesIndex();

    if (loadData?.changes && !(loadData.changesIndex instanceof ChangesIndex)) {
      for (const [cx, cy, cz, type] of loadData.changes) {
        changesIndex.add(cx, cy, cz, type);
      }
    }

    this.chunkManager = new ChunkManager(this.seed, changesIndex);

    if (loadData?.player) {
      this.playerState = createPlayerState(
        loadData.player.position.x,
        loadData.player.position.y,
        loadData.player.position.z,
      );
      this.playerState.yaw = loadData.player.yaw;
      this.playerState.pitch = loadData.player.pitch;
      this.playerState.flying = loadData.player.flying;
    } else {
      this.chunkManager.getOrGenerateChunk(0, 0);
      let spawnY = 40;
      for (let y = 60; y >= 0; y--) {
        if (this.chunkManager.getBlock(0, y, 0) !== 'air') {
          spawnY = y + 2;
          break;
        }
      }
      this.playerState = createPlayerState(0.5, spawnY + 1.8, 0.5);
    }

    this.input = {
      forward: false, backward: false,
      left: false, right: false,
      jump: false, sprint: false, sneak: false,
      fly: false, flyDown: false,
      joystickX: null, joystickY: null,
    };

    this.hotbarIndex = loadData?.hotbarIndex ?? 0;
    this.gameTime = new GameTime({ worldTime: loadData?.worldTime });
    this.skySystem.update(this.gameTime.snapshot(), scene);
    this.skySystem.updateSunDirection(this.gameTime.snapshot(), this.camera);
    this.highlight = createHighlightBox();
    scene.add(this.highlight);
    this.breakOverlay = new BreakOverlay();
    scene.add(this.breakOverlay.object);
  }

  onUnderwaterChanged(cb: (v: boolean) => void) { this.onUnderwaterChange = cb; }
  onFlyingChanged(cb: (v: boolean) => void) { this.onFlyingChange = cb; }
  onDebugUpdated(cb: (snap: Omit<GameSnapshot, 'underwater' | 'hotbarIndex'>) => void) { this.onDebugUpdate = cb; }

  start() {
    this.lastTime = performance.now();
    this.animFrame = requestAnimationFrame(this._tick);
  }

  private _prevFlying = false;
  private _wasPaused = false;

  private _tick = (now: number) => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // When transitioning from paused → running, skip one frame's dt so the
    // elapsed wall-clock during the pause menu doesn't bleed into physics.
    if (this._wasPaused) {
      this._wasPaused = false;
    }

    this.fpsCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsCount / this.fpsTimer);
      this.fpsCount = 0;
      this.fpsTimer = 0;
    }

    this.tick(dt);
    this.animFrame = requestAnimationFrame(this._tick);
  };

  tick(dt: number) {
    this.gameTime.update(dt);
    this.skySystem.update(this.gameTime.snapshot(), this.scene);
    this.skySystem.updateSunDirection(this.gameTime.snapshot(), this.camera);

    if (this.paused) {
      // Still render the paused frame, but skip simulation.
      this.renderer.render(this.scene, this.camera);
      return;
    }

    updatePlayer(this.playerState, this.input, this.chunkManager, dt);
    applyPlayerToCamera(this.playerState, this.camera);

    const cameraBlock = this.chunkManager.getBlock(
      Math.floor(this.camera.position.x),
      Math.floor(this.camera.position.y),
      Math.floor(this.camera.position.z),
    );
    const nextUnderwater = cameraBlock === 'water';
    if (nextUnderwater !== this.underwater) {
      this.underwater = nextUnderwater;
      this.onUnderwaterChange?.(nextUnderwater);
    }

    if (this.playerState.flying !== this._prevFlying) {
      this._prevFlying = this.playerState.flying;
      this.onFlyingChange?.(this.playerState.flying);
    }

    const p = this.playerState.position;
    const { unloaded, meshShow, meshHide } = this.chunkManager.update(p.x, p.z);

    for (const [cx, cz] of unloaded) {
      const chunk = this.chunkManager.getChunk(cx, cz);
      if (chunk) chunk.meshGroup = undefined;
      disposeChunkMesh(this.scene, cx, cz);
    }

    for (const [cx, cz] of meshHide) {
      const chunk = this.chunkManager.getChunk(cx, cz);
      if (chunk?.meshGroup) {
        chunk.meshGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) child.geometry.dispose();
        });
        this.scene.remove(chunk.meshGroup);
        chunk.meshGroup = undefined;
      }
    }

    for (const chunk of meshShow) {
      chunk.dirty = true;
      this.chunkManager.dirtySet.add(`${chunk.x},${chunk.z}`);
    }

    this._rebuildDirtyChunks();

    const target = getTargetBlock(this.camera, this.chunkManager);
    if (target?.hit) {
      this.highlight.position.set(
        target.blockPos.x + 0.5,
        target.blockPos.y + 0.5,
        target.blockPos.z + 0.5,
      );
      this.highlight.visible = true;
    } else {
      this.highlight.visible = false;
    }

    this.onDebugUpdate?.({
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      z: Math.round(p.z * 10) / 10,
      fps: this.fps,
      flying: this.playerState.flying,
      targetBlock: target?.hit
        ? (BLOCKS[this.chunkManager.getBlock(target.blockPos.x, target.blockPos.y, target.blockPos.z) as BlockType]?.name ?? 'unknown')
        : 'air',
      chunks: this.chunkManager.getChunkCount(),
    });

    this.renderer.render(this.scene, this.camera);
  }

  private _rebuildDirtyChunks() {
    const dirty = this.chunkManager.getDirtyChunks();
    let rebuilt = 0;
    for (const chunk of dirty) {
      if (rebuilt >= MAX_REBUILDS_PER_FRAME) break;
      disposeChunkMesh(this.scene, chunk.x, chunk.z);
      const mesh = buildChunkMesh(chunk, this.chunkManager);
      this.scene.add(mesh);
      chunk.meshGroup = mesh;
      this.chunkManager.clearDirty(chunk.x, chunk.z);
      rebuilt++;
    }
  }

  getTargetBlock() {
    return getTargetBlock(this.camera, this.chunkManager);
  }

  placeBlock() {
    const target = this.getTargetBlock();
    if (!target?.hit) return false;
    const px = target.blockPos.x + target.faceNormal.x;
    const py = target.blockPos.y + target.faceNormal.y;
    const pz = target.blockPos.z + target.faceNormal.z;
    if (isPlayerOverlappingBlock(this.playerState, px, py, pz)) return false;
    const blockType = HOTBAR_BLOCKS[this.hotbarIndex];
    this.clearBreakProgress();
    this.chunkManager.setBlock(px, py, pz, blockType);
    return true;
  }

  breakBlock() {
    const target = this.getTargetBlock();
    if (!target?.hit) return false;
    const { x, y, z } = target.blockPos;
    this.clearBreakProgress();
    this.chunkManager.setBlock(x, y, z, 'air');
    return true;
  }

  updateBreakProgress(progress: number | null): void {
    if (progress === null) {
      this.clearBreakProgress();
      return;
    }

    const target = this.getTargetBlock();
    if (!target?.hit) {
      this.clearBreakProgress();
      return;
    }

    this.breakOverlay.setTarget(target.blockPos, progress);
  }

  clearBreakProgress(): void {
    this.breakOverlay.clear();
  }

  getBreakTargetKey(): string | null {
    const target = this.getTargetBlock();
    if (!target?.hit) return null;
    const { x, y, z } = target.blockPos;
    return `${x},${y},${z}`;
  }

  getSnapshot(): GameSnapshot {
    const p = this.playerState.position;
    return {
      x: p.x,
      y: p.y,
      z: p.z,
      fps: this.fps,
      flying: this.playerState.flying,
      targetBlock: 'air',
      chunks: this.chunkManager.getChunkCount(),
      underwater: this.underwater,
      hotbarIndex: this.hotbarIndex,
    };
  }

  getWorldTime(): number {
    return this.gameTime.worldTime;
  }

  handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    cancelAnimationFrame(this.animFrame);
    const toRemove = this.scene.children.filter(c => c.name.startsWith('chunk_'));
    for (const obj of toRemove) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      this.scene.remove(obj);
    }
    this.breakOverlay.dispose();
    this.renderer.dispose();
  }
}
