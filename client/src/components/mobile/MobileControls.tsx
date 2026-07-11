import React, { useState, useCallback } from 'react';
import FloatingJoystick from './FloatingJoystick';
import JumpButton from './JumpButton';
import { useMobileControls } from '@/hooks/useMobileControls';
import { BLOCKS, HOTBAR_BLOCKS } from '@/lib/minecraft/blocks';
import { InputState } from '@/lib/minecraft/player';
import { createPlayerState } from '@/lib/minecraft/player';

interface GameRef {
  input: InputState;
  playerState: ReturnType<typeof createPlayerState>;
  hotbarIndex: number;
}

interface Props {
  gameRef: React.MutableRefObject<GameRef | null>;
  isPaused: boolean;
  flying: boolean;
  hotbarIndex: number;
  onHotbarChange: (i: number) => void;
  onPause: () => void;
  getBreakTargetKey: () => string | null;
  onPlaceBlock: () => void;
  onBreakBlock: () => void;
  onBreakProgressChange: (progress: number | null) => void;
}

// ── Break ring constants ──────────────────────────────────────────────────────
const RING_R = 56;
const RING_SIZE = (RING_R + 6) * 2;

interface BreakRing {
  progress: number;
  x: number;
  y: number;
}

export default function MobileControls({
  gameRef,
  isPaused,
  flying,
  hotbarIndex,
  onHotbarChange,
  onPause,
  getBreakTargetKey,
  onPlaceBlock,
  onBreakBlock,
  onBreakProgressChange,
}: Props) {
  const [breakRing, setBreakRing] = useState<BreakRing | null>(null);

  const handleBreakProgress = useCallback((progress: number, x: number, y: number) => {
    setBreakRing({ progress, x, y });
    onBreakProgressChange(progress);
  }, [onBreakProgressChange]);

  const handleBreakCancel = useCallback(() => {
    setBreakRing(null);
    onBreakProgressChange(null);
  }, [onBreakProgressChange]);

  const {
    onJoystickMove,
    onJoystickRelease,
    onJump,
    onJumpRelease,
    onAscend,
    onAscendRelease,
    onDescend,
    onDescendRelease,
    onToggleFly,
    onRightTouchStart,
    onRightTouchMove,
    onRightTouchEnd,
  } = useMobileControls({
    getInput: () => gameRef.current?.input ?? null,
    getPlayerState: () => gameRef.current?.playerState ?? null,
    getBreakTargetKey,
    onPlaceBlock,
    onBreakBlock,
    onBreakProgress: handleBreakProgress,
    onBreakCancel: handleBreakCancel,
  });

  if (isPaused) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {/* Left half: floating joystick */}
      <FloatingJoystick onMove={onJoystickMove} onRelease={onJoystickRelease} />

      {/* Right half: view control + tap/long-press gesture zone */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '50%',
          height: '100%',
          pointerEvents: 'auto',
        }}
        onTouchStart={onRightTouchStart}
        onTouchMove={onRightTouchMove}
        onTouchEnd={onRightTouchEnd}
        onTouchCancel={onRightTouchEnd}
      />

      {/* Break progress ring */}
      {breakRing && (
        <BreakProgressRing
          progress={breakRing.progress}
          x={breakRing.x}
          y={breakRing.y}
        />
      )}

      {/* Pause button — top right */}
      <button
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(0,0,0,0.45)',
          border: '2px solid rgba(255,255,255,0.4)',
          color: '#fff',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 10,
          padding: '6px 10px',
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
        onTouchStart={(e) => { e.preventDefault(); onPause(); }}
      >
        II
      </button>

      {/* Jump / fly buttons */}
      <JumpButton
        flying={flying}
        onJump={onJump}
        onJumpRelease={onJumpRelease}
        onAscend={onAscend}
        onAscendRelease={onAscendRelease}
        onDescend={onDescend}
        onDescendRelease={onDescendRelease}
        onToggleFly={onToggleFly}
      />

      {/* Hotbar */}
      <MobileHotbar hotbarIndex={hotbarIndex} onSelect={onHotbarChange} />
    </div>
  );
}

// ── Break Progress Ring ───────────────────────────────────────────────────────

function BreakProgressRing({ progress, x, y }: { progress: number; x: number; y: number }) {
  const expandR = RING_R * progress;
  const expandDiam = expandR * 2;

  return (
    <div
      style={{
        position: 'fixed',
        left: x - RING_SIZE / 2,
        top: y - RING_SIZE * 0.6,
        width: RING_SIZE,
        height: RING_SIZE,
        pointerEvents: 'none',
      }}
    >
      {/* Outer border ring */}
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        style={{ position: 'absolute', inset: 0 }}
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={3}
        />
      </svg>

      {/* Invert expanding circle — grows from center outward */}
      <div
        style={{
          position: 'absolute',
          left: RING_SIZE / 2 - expandR,
          top: RING_SIZE / 2 - expandR,
          width: expandDiam,
          height: expandDiam,
          borderRadius: '50%',
          backdropFilter: 'invert(1)',
          WebkitBackdropFilter: 'invert(1)',
        }}
      />
    </div>
  );
}

// ── Mobile Hotbar ─────────────────────────────────────────────────────────────

function MobileHotbar({ hotbarIndex, onSelect }: { hotbarIndex: number; onSelect: (i: number) => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 3,
        background: 'rgba(0,0,0,0.55)',
        border: '2px solid #888',
        padding: 4,
        pointerEvents: 'auto',
      }}
    >
      {HOTBAR_BLOCKS.map((blockType, i) => {
        const def = BLOCKS[blockType];
        const sideColor = `#${def.color.side.toString(16).padStart(6, '0')}`;
        const topColor = def.color.top
          ? `#${def.color.top.toString(16).padStart(6, '0')}`
          : sideColor;
        const isSelected = i === hotbarIndex;
        return (
          <div
            key={i}
            style={{
              width: 38,
              height: 38,
              border: isSelected ? '2px solid #fff' : '2px solid #444',
              background: isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              cursor: 'pointer',
            }}
            onTouchStart={(e) => { e.preventDefault(); onSelect(i); }}
          >
            <MobileBlockIcon sideColor={sideColor} topColor={topColor} />
            <div style={{
              position: 'absolute',
              bottom: 1,
              right: 2,
              fontSize: 6,
              color: isSelected ? '#FCFC00' : '#aaa',
              fontFamily: "'Press Start 2P', monospace",
              textShadow: '1px 1px 0 #000',
            }}>{i + 1}</div>
          </div>
        );
      })}
    </div>
  );
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function MobileBlockIcon({ sideColor, topColor }: { sideColor: string; topColor: string }) {
  const dark = darken(sideColor, 50);
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" style={{ imageRendering: 'pixelated' }}>
      <polygon points="13,2 23,7 13,12 3,7" fill={topColor} />
      <polygon points="3,7 13,12 13,22 3,17" fill={sideColor} />
      <polygon points="23,7 13,12 13,22 23,17" fill={dark} />
      <polygon points="13,2 23,7 13,12 3,7" fill="none" stroke="#000" strokeWidth="0.6" />
      <polygon points="3,7 13,12 13,22 3,17" fill="none" stroke="#000" strokeWidth="0.6" />
      <polygon points="23,7 13,12 13,22 23,17" fill="none" stroke="#000" strokeWidth="0.6" />
    </svg>
  );
}
