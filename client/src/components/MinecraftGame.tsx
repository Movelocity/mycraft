// MinecraftGame.tsx — Main game component
// Design: Authentic Minecraft aesthetic — full-screen 3D canvas with HUD overlay
// Style: Pixel-perfect Minecraft UI, Press Start 2P font, earthy palette

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { BLOCKS, HOTBAR_BLOCKS, type BlockType } from '@/lib/minecraft/blocks';
import { ChunkManager, RENDER_DISTANCE } from '@/lib/minecraft/chunk';
import {
  buildChunkMesh,
  createSkybox,
  createSun,
  createHighlightBox,
  createScene,
} from '@/lib/minecraft/renderer';
import {
  createPlayerState,
  updatePlayer,
  applyPlayerToCamera,
  getTargetBlock,
  InputState,
} from '@/lib/minecraft/player';

export interface GameInitData {
  seed: number;
  radius: number;
  changes?: [number, number, number, BlockType][];
  player?: {
    position: { x: number; y: number; z: number };
    yaw: number;
    pitch: number;
    flying: boolean;
  };
  hotbarIndex?: number;
}

interface MinecraftGameProps {
  loadData?: GameInitData;
  slot?: number;
  onExit?: () => void;
}

export default function MinecraftGame({ loadData, slot, onExit }: MinecraftGameProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    chunkManager: ChunkManager;
    highlight: THREE.LineSegments;
    animFrame: number;
    lastTime: number;
    input: InputState;
    playerState: ReturnType<typeof createPlayerState>;
    hotbarIndex: number;
    locked: boolean;
    seed: number;
    radius: number;
    changes: [number, number, number, BlockType][];
  } | null>(null);

  const [hotbarIndex, setHotbarIndex] = useState(loadData?.hotbarIndex ?? 0);
  const [debugInfo, setDebugInfo] = useState({ x: 0, y: 0, z: 0, fps: 0, flying: false, targetBlock: 'air', chunks: 0 });
  const [showHelp, setShowHelp] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hearts] = useState(10);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rebuildDirtyChunks = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const dirtyChunks = g.chunkManager.getDirtyChunks();
    for (const chunk of dirtyChunks) {
      const chunkName = `chunk_${chunk.x}_${chunk.z}`;
      const old = g.scene.getObjectByName(chunkName);
      if (old) {
        old.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
        g.scene.remove(old);
      }
      const newMesh = buildChunkMesh(chunk, g.chunkManager);
      g.scene.add(newMesh);
      chunk.dirty = false;
    }
  }, []);

  const handleSave = useCallback(async () => {
    const g = gameRef.current;
    if (!slot || !g) return;
    const { extractSaveData, saveGame } = await import('@/lib/minecraft/save');
    const data = extractSaveData({
      slot,
      seed: g.seed,
      radius: g.radius,
      changes: g.changes,
      player: g.playerState,
      hotbarIndex: g.hotbarIndex,
    });
    await saveGame(slot, data);
    setSaveNotification('游戏已保存');
    setTimeout(() => setSaveNotification(null), 2000);
  }, [slot]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const g = gameRef.current;
      if (!slot || !g) return;
      const { extractSaveData, saveGame } = await import('@/lib/minecraft/save');
      const data = extractSaveData({
        slot,
        seed: g.seed,
        radius: g.radius,
        changes: g.changes,
        player: g.playerState,
        hotbarIndex: g.hotbarIndex,
      });
      await saveGame(slot, data);
      setSaveNotification('自动保存中...');
      setTimeout(() => setSaveNotification(null), 2000);
    }, 30000);
  }, [slot]);

  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { scene, camera, renderer } = createScene(canvas);

    scene.add(createSkybox());
    createSun(scene);

    const worldSeed = loadData?.seed ?? Math.floor(Math.random() * 99999);
    const worldRadius = loadData?.radius ?? 30;
    const chunkManager = new ChunkManager(worldSeed);

    // Apply saved block changes
    const changes: [number, number, number, BlockType][] = loadData?.changes ? [...loadData.changes] : [];
    for (const [cx, cy, cz, type] of changes) {
      chunkManager.setBlock(cx, cy, cz, type);
    }

    const highlight = createHighlightBox();
    scene.add(highlight);

    let playerState;
    if (loadData?.player) {
      playerState = createPlayerState(
        loadData.player.position.x,
        loadData.player.position.y,
        loadData.player.position.z,
      );
      playerState.yaw = loadData.player.yaw;
      playerState.pitch = loadData.player.pitch;
      playerState.flying = loadData.player.flying;
    } else {
      // 生成出生点区块以找到地面高度
      chunkManager.getOrGenerateChunk(0, 0);
      let spawnY = 40;
      for (let y = 60; y >= 0; y--) {
        if (chunkManager.getBlock(0, y, 0) !== 'air') {
          spawnY = y + 2;
          break;
        }
      }
      playerState = createPlayerState(0.5, spawnY + 1.8, 0.5);
    }

    const input: InputState = {
      forward: false, backward: false,
      left: false, right: false,
      jump: false, sprint: false, fly: false,
    };

    gameRef.current = {
      scene, camera, renderer, chunkManager, highlight,
      animFrame: 0, lastTime: performance.now(),
      input, playerState, hotbarIndex: loadData?.hotbarIndex ?? 0,
      locked: false,
      seed: worldSeed, radius: worldRadius, changes,
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      switch (e.code) {
        case 'KeyW': g.input.forward = true; break;
        case 'KeyS': g.input.backward = true; break;
        case 'KeyA': g.input.left = true; break;
        case 'KeyD': g.input.right = true; break;
        case 'Space': e.preventDefault(); g.input.jump = true; break;
        case 'ShiftLeft': g.input.sprint = true; break;
        case 'KeyF':
          g.playerState.flying = !g.playerState.flying;
          break;
        case 'Digit1': g.hotbarIndex = 0; setHotbarIndex(0); break;
        case 'Digit2': g.hotbarIndex = 1; setHotbarIndex(1); break;
        case 'Digit3': g.hotbarIndex = 2; setHotbarIndex(2); break;
        case 'Digit4': g.hotbarIndex = 3; setHotbarIndex(3); break;
        case 'Digit5': g.hotbarIndex = 4; setHotbarIndex(4); break;
        case 'Digit6': g.hotbarIndex = 5; setHotbarIndex(5); break;
        case 'Digit7': g.hotbarIndex = 6; setHotbarIndex(6); break;
        case 'Digit8': g.hotbarIndex = 7; setHotbarIndex(7); break;
        case 'Digit9': g.hotbarIndex = 8; setHotbarIndex(8); break;
        case 'KeyH': setShowHelp(h => !h); break;
        case 'F5':
          e.preventDefault();
          handleSave();
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      switch (e.code) {
        case 'KeyW': g.input.forward = false; break;
        case 'KeyS': g.input.backward = false; break;
        case 'KeyA': g.input.left = false; break;
        case 'KeyD': g.input.right = false; break;
        case 'Space': g.input.jump = false; break;
        case 'ShiftLeft': g.input.sprint = false; break;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const g = gameRef.current;
      if (!g || !g.locked) return;
      const sens = 0.002;
      g.playerState.yaw -= e.movementX * sens;
      g.playerState.pitch -= e.movementY * sens;
      g.playerState.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, g.playerState.pitch));
    };

    const onMouseDown = (e: MouseEvent) => {
      const g = gameRef.current;
      if (!g || !g.locked) return;
      const target = getTargetBlock(g.camera, g.chunkManager);
      if (!target?.hit) return;
      if (e.button === 0) {
        const bx = target.blockPos.x, by = target.blockPos.y, bz = target.blockPos.z;
        g.chunkManager.setBlock(bx, by, bz, 'air');
        g.changes.push([bx, by, bz, 'air']);
        scheduleAutoSave();
      } else if (e.button === 2) {
        const px = target.blockPos.x + target.faceNormal.x;
        const py = target.blockPos.y + target.faceNormal.y;
        const pz = target.blockPos.z + target.faceNormal.z;
        const blockType = HOTBAR_BLOCKS[g.hotbarIndex];
        g.chunkManager.setBlock(px, py, pz, blockType);
        g.changes.push([px, py, pz, blockType]);
        scheduleAutoSave();
      }
    };

    const onWheel = (e: WheelEvent) => {
      const g = gameRef.current;
      if (!g) return;
      const d = e.deltaY > 0 ? 1 : -1;
      g.hotbarIndex = (g.hotbarIndex + d + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
      setHotbarIndex(g.hotbarIndex);
    };

    const onPointerLockChange = () => {
      const g = gameRef.current;
      const locked = document.pointerLockElement === canvas;
      if (g) g.locked = locked;
      setIsLocked(locked);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('wheel', onWheel, { passive: true });
    document.addEventListener('pointerlockchange', onPointerLockChange);
    canvas.addEventListener('click', () => { if (!gameRef.current?.locked) canvas.requestPointerLock(); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Prevent pinch-to-zoom on macOS trackpad
    const preventZoom = (e: Event) => { e.preventDefault(); };
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) { e.preventDefault(); }
    };
    document.addEventListener('gesturestart', preventZoom, { passive: false });
    document.addEventListener('gesturechange', preventZoom, { passive: false });
    document.addEventListener('gestureend', preventZoom, { passive: false });
    document.addEventListener('wheel', preventWheelZoom, { passive: false });

    const onResize = () => {
      const g = gameRef.current;
      if (!g) return;
      g.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      g.camera.aspect = canvas.clientWidth / canvas.clientHeight;
      g.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    let fpsCount = 0, fpsTimer = 0, fps = 0;

    const gameLoop = (now: number) => {
      const g = gameRef.current;
      if (!g) return;
      const dt = Math.min((now - g.lastTime) / 1000, 0.05);
      g.lastTime = now;

      fpsCount++;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {
        fps = Math.round(fpsCount / fpsTimer);
        fpsCount = 0; fpsTimer = 0;
      }

      updatePlayer(g.playerState, g.input, g.chunkManager, dt);
      applyPlayerToCamera(g.playerState, g.camera);

      // 更新区块加载/卸载
      const p = g.playerState.position;
      g.chunkManager.update(p.x, p.z);

      // 重建脏区块网格
      rebuildDirtyChunks();

      const target = getTargetBlock(g.camera, g.chunkManager);
      if (target?.hit) {
        g.highlight.position.set(target.blockPos.x + 0.5, target.blockPos.y + 0.5, target.blockPos.z + 0.5);
        g.highlight.visible = true;
      } else {
        g.highlight.visible = false;
      }

      const targetBlockName = target?.hit
        ? BLOCKS[g.chunkManager.getBlock(target.blockPos.x, target.blockPos.y, target.blockPos.z) as BlockType]?.name || 'unknown'
        : 'air';
      setDebugInfo({
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        z: Math.round(p.z * 10) / 10,
        fps,
        flying: g.playerState.flying,
        targetBlock: targetBlockName,
        chunks: g.chunkManager.getChunkCount(),
      });

      g.renderer.render(g.scene, g.camera);
      g.animFrame = requestAnimationFrame(gameLoop);
    };

    gameRef.current.animFrame = requestAnimationFrame(gameLoop);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('gesturestart', preventZoom);
      document.removeEventListener('gesturechange', preventZoom);
      document.removeEventListener('gestureend', preventZoom);
      document.removeEventListener('wheel', preventWheelZoom);
      window.removeEventListener('resize', onResize);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (gameRef.current) {
        cancelAnimationFrame(gameRef.current.animFrame);
        gameRef.current.renderer.dispose();
      }
    };
  }, [rebuildDirtyChunks, loadData, handleSave, scheduleAutoSave]);

  useEffect(() => {
    return initGame();
  }, [initGame]);

  return (
    <div
      className="relative w-full h-screen bg-black overflow-hidden select-none"
      style={{ fontFamily: "'Press Start 2P', monospace" }}
    >
      {/* Game Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none' }} />

      {/* Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line x1="10" y1="2" x2="10" y2="18" stroke="white" strokeWidth="2" />
          <line x1="2" y1="10" x2="18" y2="10" stroke="white" strokeWidth="2" />
          <line x1="10" y1="2" x2="10" y2="18" stroke="black" strokeWidth="4" strokeOpacity="0.4" />
          <line x1="2" y1="10" x2="18" y2="10" stroke="black" strokeWidth="4" strokeOpacity="0.4" />
          <line x1="10" y1="2" x2="10" y2="18" stroke="white" strokeWidth="2" />
          <line x1="2" y1="10" x2="18" y2="10" stroke="white" strokeWidth="2" />
        </svg>
      </div>

      {/* Debug Info — top left */}
      <div
        className="absolute top-2 left-2 pointer-events-none"
        style={{ color: '#fff', fontSize: '9px', textShadow: '1px 1px 0 #000', lineHeight: '1.9' }}
      >
        <div style={{ color: '#FCFC00' }}>Web Minecraft</div>
        <div>FPS: {debugInfo.fps}</div>
        <div>XYZ: {debugInfo.x} / {debugInfo.y} / {debugInfo.z}</div>
        <div>Chunks: {debugInfo.chunks}</div>
        <div style={{ color: '#88FF88' }}>Block: {debugInfo.targetBlock}</div>
        {debugInfo.flying && <div style={{ color: '#88DDFF' }}>✈ Flying</div>}
        <div style={{ color: '#aaa', marginTop: '4px' }}>H = Help</div>
      </div>

      {/* Hearts — top right */}
      <div
        className="absolute top-2 right-2 pointer-events-none flex gap-1"
        style={{ flexDirection: 'row-reverse' }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} style={{ fontSize: '14px', filter: 'drop-shadow(1px 1px 0 #000)' }}>
            {i < hearts ? '❤' : '🖤'}
          </span>
        ))}
      </div>

      {/* Hotbar */}
      <HotbarHUD hotbarIndex={hotbarIndex} />

      {/* Pause menu overlay */}
      {!isLocked && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div style={{
            background: '#1c1c1c',
            border: '3px solid #666',
            borderRight: '3px solid #333',
            borderBottom: '3px solid #333',
            padding: 'clamp(16px, 4vw, 28px) clamp(20px, 5vw, 36px)',
            color: '#fff',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 'clamp(8px, 2vw, 10px)',
            textAlign: 'center',
            width: '80%',
            maxWidth: '320px',
          }}>
            <div style={{ fontSize: 'clamp(11px, 2.8vw, 14px)', color: '#FCFC00', marginBottom: '20px' }}>PAUSED</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => canvasRef.current?.requestPointerLock()}
                style={{
                  background: '#5D8A3C',
                  border: '3px solid #000',
                  borderRight: '3px solid #2A2A2A',
                  borderBottom: '3px solid #2A2A2A',
                  color: '#fff',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 'clamp(8px, 2vw, 10px)',
                  padding: '12px 24px',
                  cursor: 'pointer',
                  textShadow: '2px 2px 0 #000',
                }}
              >
                继续游戏
              </button>
              <button
                onClick={async () => {
                  await handleSave();
                  onExit?.();
                }}
                style={{
                  background: '#555',
                  border: '3px solid #000',
                  borderRight: '3px solid #2A2A2A',
                  borderBottom: '3px solid #2A2A2A',
                  color: '#fff',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 'clamp(8px, 2vw, 10px)',
                  padding: '12px 24px',
                  cursor: 'pointer',
                  textShadow: '2px 2px 0 #000',
                }}
              >
                保存并退出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help overlay */}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

      {/* Save notification */}
      {saveNotification && (
        <div
          className="absolute bottom-20 left-1/2 pointer-events-none"
          style={{
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            border: '2px solid #888',
            padding: '8px 20px',
            color: '#FCFC00',
            fontSize: '9px',
            fontFamily: "'Press Start 2P', monospace",
            textShadow: '1px 1px 0 #000',
            animation: 'fadeInOut 2s ease-in-out',
          }}
        >
          {saveNotification}
        </div>
      )}
    </div>
  );
}

// ── Hotbar ──────────────────────────────────────────────────────────────────

function HotbarHUD({ hotbarIndex }: { hotbarIndex: number }) {
  return (
    <div
      className="absolute bottom-4 left-1/2 pointer-events-none"
      style={{ transform: 'translateX(-50%)', userSelect: 'none' }}
    >
      <div style={{
        display: 'flex',
        gap: '3px',
        background: 'rgba(0,0,0,0.55)',
        border: '2px solid #888',
        borderBottom: '2px solid #444',
        borderRight: '2px solid #444',
        padding: '4px',
      }}>
        {HOTBAR_BLOCKS.map((blockType, i) => {
          const def = BLOCKS[blockType];
          const sideColor = `#${def.color.side.toString(16).padStart(6, '0')}`;
          const topColor = def.color.top
            ? `#${def.color.top.toString(16).padStart(6, '0')}`
            : sideColor;
          const isSelected = i === hotbarIndex;
          return (
            <div key={i} style={{
              width: '42px', height: '42px',
              border: isSelected ? '2px solid #fff' : '2px solid #444',
              background: isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.4)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              transition: 'border-color 0.1s',
            }}>
              <BlockIcon sideColor={sideColor} topColor={topColor} />
              <div style={{
                position: 'absolute', bottom: '1px', right: '3px',
                fontSize: '7px', color: isSelected ? '#FCFC00' : '#aaa',
                textShadow: '1px 1px 0 #000',
              }}>{i + 1}</div>
            </div>
          );
        })}
      </div>
      <div style={{
        textAlign: 'center', marginTop: '5px',
        color: '#fff', fontSize: '8px',
        textShadow: '1px 1px 0 #000',
      }}>
        {BLOCKS[HOTBAR_BLOCKS[hotbarIndex]].name.toUpperCase()}
      </div>
    </div>
  );
}

function BlockIcon({ sideColor, topColor }: { sideColor: string; topColor: string }) {
  const dark = darken(sideColor, 50);
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" style={{ imageRendering: 'pixelated' }}>
      {/* Top face */}
      <polygon points="13,2 23,7 13,12 3,7" fill={topColor} />
      {/* Left face */}
      <polygon points="3,7 13,12 13,22 3,17" fill={sideColor} />
      {/* Right face */}
      <polygon points="23,7 13,12 13,22 23,17" fill={dark} />
      {/* Outline */}
      <polygon points="13,2 23,7 13,12 3,7" fill="none" stroke="#000" strokeWidth="0.6" />
      <polygon points="3,7 13,12 13,22 3,17" fill="none" stroke="#000" strokeWidth="0.6" />
      <polygon points="23,7 13,12 13,22 23,17" fill="none" stroke="#000" strokeWidth="0.6" />
    </svg>
  );
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ── Help Overlay ─────────────────────────────────────────────────────────────

function HelpOverlay({ onClose }: { onClose: () => void }) {
  const controls = [
    ['W A S D', 'Move'],
    ['Mouse', 'Look around'],
    ['Left Click', 'Break block'],
    ['Right Click', 'Place block'],
    ['Space', 'Jump'],
    ['Shift', 'Sprint'],
    ['F', 'Toggle fly mode'],
    ['1 – 9', 'Select block'],
    ['Scroll', 'Cycle hotbar'],
    ['H', 'Toggle this help'],
    ['ESC', 'Release mouse'],
  ];

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1c1c1c',
          border: '3px solid #666',
          borderRight: '3px solid #333',
          borderBottom: '3px solid #333',
          padding: '28px 36px',
          color: '#fff',
          fontSize: '9px',
          lineHeight: '2.4',
          minWidth: '340px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '13px', color: '#FCFC00', marginBottom: '18px', textAlign: 'center', letterSpacing: '2px' }}>
          CONTROLS
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {controls.map(([key, action]) => (
              <tr key={key}>
                <td style={{ color: '#FCFC00', paddingRight: '20px', paddingBottom: '2px', whiteSpace: 'nowrap' }}>{key}</td>
                <td style={{ color: '#ccc', paddingBottom: '2px' }}>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'center', marginTop: '18px', color: '#666', fontSize: '8px' }}>
          Click anywhere to close
        </div>
      </div>
    </div>
  );
}


