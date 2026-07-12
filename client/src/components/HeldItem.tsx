import { useEffect, useRef, useState } from 'react';
import { BLOCKS, type BlockType } from '@/lib/minecraft/blocks';

type ActionKind = 'place' | 'break';

interface Props {
  blockType: BlockType;
  isMoving: boolean;
  placeTrigger: number; // increment to trigger place animation
  breakTrigger: number; // increment to trigger break animation
  breakProgress: number | null;
}

export default function HeldItem({ blockType, isMoving, placeTrigger, breakTrigger, breakProgress }: Props) {
  const [action, setAction] = useState<{ kind: ActionKind; progress: number } | null>(null);
  const lastPlaceRef = useRef(placeTrigger);
  const lastBreakRef = useRef(breakTrigger);
  const animFrameRef = useRef(0);

  useEffect(() => {
    let kind: ActionKind | null = null;

    if (placeTrigger !== lastPlaceRef.current) {
      lastPlaceRef.current = placeTrigger;
      kind = 'place';
    }
    if (breakTrigger !== lastBreakRef.current) {
      lastBreakRef.current = breakTrigger;
      kind = 'break';
    }

    if (!kind) return;

    cancelAnimationFrame(animFrameRef.current);
    const duration = kind === 'place' ? 220 : 413;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      setAction({ kind, progress });

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setAction(null);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [placeTrigger, breakTrigger]);

  const def = BLOCKS[blockType];
  const sideColor = `#${def.color.side.toString(16).padStart(6, '0')}`;
  const topColor = def.color.top
    ? `#${def.color.top.toString(16).padStart(6, '0')}`
    : sideColor;
  const dark = darken(sideColor, 50);

  const isBreaking = breakProgress !== null;
  const isAnimating = action !== null;
  const isActing = isBreaking || isAnimating;
  const showBob = isMoving && !isActing;
  const bobClass = showBob ? 'held-item-bob' : '';
  const actionTransform = isBreaking
    ? getBreakProgressTransform(breakProgress)
    : getActionTransform(action);

  return (
    <div
      className="held-item"
      style={{
        position: 'absolute',
        right: -90,
        bottom: -52,
        width: 240,
        height: 240,
        pointerEvents: 'none',
      }}
    >
      <div
        className={bobClass}
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: 'bottom right',
          transform: showBob ? undefined : actionTransform,
          transition: showBob || isActing ? 'none' : 'transform 0.15s ease-out',
          backfaceVisibility: 'hidden',
          willChange: showBob || isActing ? 'transform' : 'auto',
        }}
      >
        {/* Block — 8x size, positioned at bottom-right to be clipped by screen edge */}
        <svg
          width="208"
          height="208"
          viewBox="0 0 208 208"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            imageRendering: 'pixelated',
          }}
        >
          {/* Top face */}
          <polygon points="104,16 184,56 104,96 24,56" fill={topColor} />
          {/* Left face */}
          <polygon points="24,56 104,96 104,176 24,136" fill={sideColor} />
          {/* Right face */}
          <polygon points="184,56 104,96 104,176 184,136" fill={dark} />
          {/* Outline */}
          <polygon points="104,16 184,56 104,96 24,56" fill="none" stroke="#000" strokeWidth="3" />
          <polygon points="24,56 104,96 104,176 24,136" fill="none" stroke="#000" strokeWidth="3" />
          <polygon points="184,56 104,96 104,176 184,136" fill="none" stroke="#000" strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
}

function getActionTransform(action: { kind: ActionKind; progress: number } | null): string {
  const baseRotation = -20;
  if (!action) return `rotate(${baseRotation}deg)`;

  if (action.kind === 'place') {
    const thrust = Math.sin(action.progress * Math.PI);
    return `translate(${-30 * thrust}px, ${-34 * thrust}px) scale(${1 - 0.08 * thrust}) rotate(${baseRotation - 8 * thrust}deg)`;
  }

  const hit = Math.sin(action.progress * Math.PI);
  const settle = Math.sin(action.progress * Math.PI * 2) * Math.pow(1 - action.progress, 2);
  const x = -18 * hit - 3 * settle;
  const y = -36 * hit - 5 * settle;
  const rotation = baseRotation + 28 * hit + 4 * settle;
  return `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
}

function getBreakProgressTransform(progress: number): string {
  const baseRotation = -20;
  const envelope = smoothStep(0, 0.16, progress) * (1 - smoothStep(0.82, 1, progress));
  const pulse = 0.5 - 0.5 * Math.cos(progress * Math.PI * 4);
  const chop = pulse * envelope;
  const intensity = 0.55 + progress * 0.18;
  const x = -7 * chop * intensity;
  const y = -22 * chop * intensity;
  const rotation = baseRotation + 17 * chop * intensity;
  return `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
