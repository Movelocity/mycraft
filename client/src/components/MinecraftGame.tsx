// MinecraftGame.tsx — Main game component
// Design: Authentic Minecraft aesthetic — full-screen 3D canvas with HUD overlay
// Style: Pixel-perfect Minecraft UI, Press Start 2P font, earthy palette

import React, { useEffect, useRef, useState, useCallback } from 'react';
import DebugOverlay, { type DebugOverlayHandle } from '@/components/DebugOverlay';
import { BLOCKS, HOTBAR_BLOCKS, type BlockType } from '@/lib/minecraft/blocks';
import { ChangesIndex } from '@/lib/minecraft/chunk';
import { GameEngine, type GameLoadData } from '@/lib/minecraft/engine';
import { InputState } from '@/lib/minecraft/player';
import { BLOCK_BREAK_DURATION_MS } from '@/lib/minecraft/breakOverlay';
import MobileControls from '@/components/mobile/MobileControls';
import HeldItem from '@/components/HeldItem';
import { exitFullscreen, isMobileUA } from '@/utils/mobile';

export interface GameInitData {
  seed: number;
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

interface MinecraftGameProps {
  loadData?: GameInitData;
  slot?: number;
  onExit?: () => void;
  mobileMode?: boolean;
}

export default function MinecraftGame({ loadData, slot, onExit, mobileMode }: MinecraftGameProps = {}) {
  const isMobile = mobileMode ?? isMobileUA();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [hotbarIndex, setHotbarIndex] = useState(loadData?.hotbarIndex ?? 0);
  const debugRef = useRef<DebugOverlayHandle>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [flying, setFlying] = useState(loadData?.player?.flying ?? false);
  const [isPaused, setIsPaused] = useState(!isMobile);
  const [hearts] = useState(10);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isUnderwater, setIsUnderwater] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [placeTrigger, setPlaceTrigger] = useState(0);
  const [breakTrigger, setBreakTrigger] = useState(0);
  const [breakProgress, setBreakProgress] = useState<number | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(isPaused);
  const showExitConfirmRef = useRef(showExitConfirm);
  const previousPausedRef = useRef(isPaused);
  const setPlaceTriggerRef = useRef(setPlaceTrigger);
  const setBreakTriggerRef = useRef(setBreakTrigger);
  setPlaceTriggerRef.current = setPlaceTrigger;
  setBreakTriggerRef.current = setBreakTrigger;
  isPausedRef.current = isPaused;
  showExitConfirmRef.current = showExitConfirm;

  const clearInput = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.input.forward = false;
    e.input.backward = false;
    e.input.left = false;
    e.input.right = false;
    e.input.jump = false;
    e.input.sprint = false;
    e.input.sneak = false;
    e.input.fly = false;
    e.input.flyDown = false;
    e.input.joystickX = null;
    e.input.joystickY = null;
  }, []);

  const openExitConfirm = useCallback(() => {
    if (showExitConfirmRef.current) return;
    previousPausedRef.current = isPausedRef.current;
    showExitConfirmRef.current = true;
    setShowExitConfirm(true);
    setIsPaused(true);
    clearInput();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [clearInput]);

  const cancelExitConfirm = useCallback(() => {
    showExitConfirmRef.current = false;
    setShowExitConfirm(false);

    if (previousPausedRef.current) {
      setIsPaused(true);
      return;
    }

    setIsPaused(false);
    if (!isMobile) {
      canvasRef.current?.requestPointerLock();
    }
  }, [isMobile]);

  const handleSave = useCallback(async () => {
    const e = engineRef.current;
    if (!slot || !e) return;
    const { extractSaveData, saveGame } = await import('@/lib/minecraft/save');
    const data = extractSaveData({
      slot,
      seed: e.seed,
      worldTime: e.getWorldTime(),
      changesIndex: e.chunkManager.changesIndex,
      player: e.playerState,
      hotbarIndex: e.hotbarIndex,
    });
    await saveGame(slot, data);
    setSaveNotification('游戏已保存');
    setTimeout(() => setSaveNotification(null), 2000);
  }, [slot]);

  const confirmExit = useCallback(async () => {
    await handleSave();
    if (document.fullscreenElement) {
      await exitFullscreen().catch(() => {});
    }
    onExit?.();
  }, [handleSave, onExit]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const e = engineRef.current;
      if (!slot || !e) return;
      const { extractSaveData, saveGame } = await import('@/lib/minecraft/save');
      const data = extractSaveData({
        slot,
        seed: e.seed,
        worldTime: e.getWorldTime(),
        changesIndex: e.chunkManager.changesIndex,
        player: e.playerState,
        hotbarIndex: e.hotbarIndex,
      });
      await saveGame(slot, data);
      setSaveNotification('自动保存中...');
      setTimeout(() => setSaveNotification(null), 2000);
    }, 30000);
  }, [slot]);

  const getBreakTargetKey = useCallback(() => {
    return engineRef.current?.getBreakTargetKey() ?? null;
  }, []);

  const updateBreakProgress = useCallback((progress: number | null) => {
    setBreakProgress(progress);
    engineRef.current?.updateBreakProgress(progress);
  }, []);

  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gameLoadData: GameLoadData = {
      seed: loadData?.seed,
      changes: loadData?.changes,
      changesIndex: loadData?.changesIndex,
      player: loadData?.player,
      hotbarIndex: loadData?.hotbarIndex,
      worldTime: loadData?.worldTime,
    };

    const engine = new GameEngine(canvas, gameLoadData);
    engineRef.current = engine;

    engine.onUnderwaterChanged(setIsUnderwater);
    engine.onFlyingChanged(setFlying);
    engine.onDebugUpdated((snap) => debugRef.current?.update(snap));

    const cleanupDesktop = isMobile ? () => {} : attachDesktopHandlers(
      canvas,
      engineRef,
      (i) => { setHotbarIndex(i); if (engineRef.current) engineRef.current.hotbarIndex = i; },
      setShowHelp,
      setIsPaused,
      handleSave,
      scheduleAutoSave,
      updateBreakProgress,
      () => setPlaceTriggerRef.current(t => t + 1),
      () => setBreakTriggerRef.current(t => t + 1),
      openExitConfirm,
      debugRef,
    );

    // Prevent pinch-to-zoom on macOS trackpad (desktop only)
    const preventZoom = (e: Event) => { e.preventDefault(); };
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) { e.preventDefault(); }
    };
    if (!isMobile) {
      document.addEventListener('gesturestart', preventZoom, { passive: false });
      document.addEventListener('gesturechange', preventZoom, { passive: false });
      document.addEventListener('gestureend', preventZoom, { passive: false });
      document.addEventListener('wheel', preventWheelZoom, { passive: false });
    }

    const onResize = () => engineRef.current?.handleResize();
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(canvas);

    // Hook into engine tick for movement detection
    const origTick = engine.tick.bind(engine);
    engine.tick = (dt: number) => {
      origTick(dt);
      const vel = engine.playerState.velocity;
      const isPlayerMoving = (vel.x * vel.x + vel.z * vel.z) > 0.5;
      if (isPlayerMoving) {
        if (!movingTimerRef.current) setIsMoving(true);
        if (movingTimerRef.current) clearTimeout(movingTimerRef.current);
        movingTimerRef.current = setTimeout(() => {
          setIsMoving(false);
          movingTimerRef.current = null;
        }, 150);
      }
    };

    engine.start();

    return () => {
      cleanupDesktop();
      if (!isMobile) {
        document.removeEventListener('gesturestart', preventZoom);
        document.removeEventListener('gesturechange', preventZoom);
        document.removeEventListener('gestureend', preventZoom);
        document.removeEventListener('wheel', preventWheelZoom);
      }
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize);
      resizeObserver.disconnect();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, [loadData, handleSave, scheduleAutoSave, updateBreakProgress, isMobile, openExitConfirm]);

  useEffect(() => {
    return initGame();
  }, [initGame]);

  useEffect(() => {
    engineRef.current?.setPaused(isPaused);
  }, [isPaused]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;
      event.preventDefault();
      openExitConfirm();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [openExitConfirm]);

  return (
    <div
      className="relative w-full bg-black overflow-hidden select-none"
      style={{ fontFamily: "'Press Start 2P', monospace", height: '100dvh' }}
    >
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="block"
        style={{
          touchAction: 'none',
          width: '100%',
          height: '100%',
          filter: isUnderwater ? 'brightness(0.9) contrast(0.98) saturate(1.05)' : 'none',
          transition: 'filter 180ms ease',
        }}
      />

      {isUnderwater && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'rgba(48, 145, 255, 0.22)',
          }}
        />
      )}

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

      {/* Debug overlay — ref-driven, no setState on each frame */}
      <DebugOverlay ref={debugRef} />

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

      {!isPaused && !showExitConfirm && (
        <button
          onClick={openExitConfirm}
          onTouchStart={(e) => {
            e.preventDefault();
            openExitConfirm();
          }}
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.45)',
            border: '2px solid rgba(255,255,255,0.42)',
            color: '#fff',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9,
            padding: '7px 12px',
            pointerEvents: 'auto',
            cursor: 'pointer',
            textShadow: '1px 1px 0 #000',
            zIndex: 25,
          }}
        >
          退出
        </button>
      )}

      {/* Hotbar — hidden on mobile (rendered inside MobileControls) */}
      {!isMobile && <HotbarHUD hotbarIndex={hotbarIndex} />}

      {/* Held item — right hand */}
      {!isPaused && (
        <HeldItem
          blockType={HOTBAR_BLOCKS[hotbarIndex]}
          isMoving={isMoving}
          placeTrigger={placeTrigger}
          breakTrigger={breakTrigger}
          breakProgress={breakProgress}
        />
      )}

      {/* Mobile controls overlay */}
      {isMobile && (
        <MobileControls
          gameRef={engineRef as unknown as React.MutableRefObject<{
            input: InputState;
            playerState: NonNullable<typeof engineRef.current>['playerState'];
            hotbarIndex: number;
          } | null>}
          isPaused={isPaused}
          flying={flying}
          hotbarIndex={hotbarIndex}
          onHotbarChange={(i) => {
            setHotbarIndex(i);
            if (engineRef.current) engineRef.current.hotbarIndex = i;
          }}
          onPause={() => setIsPaused(true)}
          getBreakTargetKey={getBreakTargetKey}
          onBreakProgressChange={updateBreakProgress}
          onPlaceBlock={() => {
            const e = engineRef.current;
            if (!e) return;
            if (e.placeBlock()) {
              scheduleAutoSave();
              setPlaceTrigger(t => t + 1);
            }
          }}
          onBreakBlock={() => {
            const e = engineRef.current;
            if (!e) return;
            if (e.breakBlock()) scheduleAutoSave();
          }}
        />
      )}

      {/* Pause menu overlay */}
      {isPaused && (
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
                onClick={() => {
                  if (isMobile) {
                    setIsPaused(false);
                  } else {
                    canvasRef.current?.requestPointerLock();
                  }
                }}
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

      {showExitConfirm && (
        <ExitConfirmOverlay
          onConfirm={confirmExit}
          onCancel={cancelExitConfirm}
        />
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
    ['Space', 'Jump / Double-jump to fly'],
    ['Shift', 'Sneak / Double-shift exit fly'],
    ['Ctrl', 'Sprint'],
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

function ExitConfirmOverlay({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', zIndex: 120 }}
    >
      <div style={{
        background: '#1c1c1c',
        border: '3px solid #666',
        borderRight: '3px solid #333',
        borderBottom: '3px solid #333',
        padding: 'clamp(18px, 4vw, 30px) clamp(20px, 5vw, 36px)',
        color: '#fff',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 'clamp(8px, 2vw, 10px)',
        textAlign: 'center',
        width: '84%',
        maxWidth: '340px',
      }}>
        <div style={{ fontSize: 'clamp(11px, 2.8vw, 14px)', color: '#FCFC00', marginBottom: 16 }}>
          退出游戏？
        </div>
        <div style={{ color: '#bbb', fontSize: 'clamp(6px, 1.6vw, 8px)', lineHeight: 2, marginBottom: 22 }}>
          将保存当前进度并返回首页
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onConfirm}
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
            保存并退出
          </button>
          <button
            onClick={onCancel}
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
            继续游戏
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Desktop input handler (extracted to keep initGame clean) ──────────────────

function attachDesktopHandlers(
  canvas: HTMLCanvasElement,
  gameRef: React.MutableRefObject<GameEngine | null>,
  setHotbarIndex: (i: number) => void,
  setShowHelp: (fn: (v: boolean) => boolean) => void,
  setIsPaused: (v: boolean) => void,
  handleSave: () => void,
  scheduleAutoSave: () => void,
  onBreakProgressChange: (progress: number | null) => void,
  onPlaceAction: () => void,
  onBreakAction: () => void,
  onExitRequest: () => void,
  debugOverlayRef: React.RefObject<DebugOverlayHandle | null>,
): () => void {
  let breakRaf = 0;
  let breakTargetKey: string | null = null;
  let breakStartTime = 0;
  let breakCooldownUntil = 0;
  const breakCooldownMs = 120;

  const clearBreakVisual = () => {
    gameRef.current?.updateBreakProgress(null);
    onBreakProgressChange(null);
  };

  const stopBreaking = (clearVisual = true) => {
    if (breakRaf !== 0) {
      cancelAnimationFrame(breakRaf);
      breakRaf = 0;
    }
    breakTargetKey = null;
    breakStartTime = 0;
    breakCooldownUntil = 0;
    if (clearVisual) clearBreakVisual();
  };

  const tickBreaking = (now: number) => {
    const g = gameRef.current;
    if (!g || !g.locked) {
      stopBreaking();
      return;
    }

    if (now < breakCooldownUntil) {
      breakRaf = requestAnimationFrame(tickBreaking);
      return;
    }

    const targetKey = g.getBreakTargetKey();
    if (!targetKey) {
      breakTargetKey = null;
      breakStartTime = 0;
      breakCooldownUntil = 0;
      clearBreakVisual();
      breakRaf = requestAnimationFrame(tickBreaking);
      return;
    }

    if (targetKey !== breakTargetKey) {
      breakTargetKey = targetKey;
      breakStartTime = now;
      breakCooldownUntil = 0;
    }

    const progress = Math.min((now - breakStartTime) / BLOCK_BREAK_DURATION_MS, 1);
    g.updateBreakProgress(progress);
    onBreakProgressChange(progress);

    if (progress >= 1) {
      if (g.breakBlock()) {
        scheduleAutoSave();
        onBreakAction();
      }
      breakTargetKey = null;
      breakStartTime = 0;
      breakCooldownUntil = now + breakCooldownMs;
      onBreakProgressChange(null);
      breakRaf = requestAnimationFrame(tickBreaking);
      return;
    }

    breakRaf = requestAnimationFrame(tickBreaking);
  };

  const startBreaking = () => {
    if (breakRaf !== 0) return;
    breakTargetKey = null;
    breakStartTime = 0;
    breakRaf = requestAnimationFrame(tickBreaking);
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
      case 'ShiftLeft': g.input.sneak = true; break;
      case 'ControlLeft': g.input.sprint = true; break;
      case 'KeyF': g.playerState.flying = !g.playerState.flying; break;
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
      case 'F3': {
        const overlay = debugOverlayRef.current;
        if (overlay) {
          const next = sessionStorage.getItem('debugVisible') !== 'true';
          overlay.setVisible(next);
        }
        break;
      }
      case 'F5': e.preventDefault(); handleSave(); break;
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
      case 'ShiftLeft': g.input.sneak = false; break;
      case 'ControlLeft': g.input.sprint = false; break;
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
    if (e.button === 0) {
      e.preventDefault();
      startBreaking();
    } else if (e.button === 2) {
      stopBreaking();
      if (g.placeBlock()) {
        scheduleAutoSave();
        onPlaceAction();
      }
    }
  };

  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) stopBreaking();
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
    if (locked) {
      setIsPaused(false);
    } else {
      setIsPaused(true);
      stopBreaking();
      onExitRequest();
    }
  };

  const onCanvasClick = () => {
    if (!gameRef.current?.locked) canvas.requestPointerLock();
  };
  const onContextMenu = (e: Event) => e.preventDefault();

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('wheel', onWheel, { passive: true });
  document.addEventListener('pointerlockchange', onPointerLockChange);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('contextmenu', onContextMenu);

  return () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('wheel', onWheel);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('contextmenu', onContextMenu);
    stopBreaking();
  };
}
