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

  const chop = Math.abs(Math.sin(action.progress * Math.PI * 7.5));
  const returnEase = 1 - action.progress;
  const x = -14 * chop * returnEase;
  const y = -42 * chop * returnEase;
  const rotation = baseRotation + 34 * chop * returnEase;
  return `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
}

function getBreakProgressTransform(progress: number): string {
  const baseRotation = -20;
  const chop = Math.pow(Math.max(0, Math.sin(progress * Math.PI * 4.5)), 0.75);
  const intensity = 0.5 + progress * 0.25;
  const x = -8 * chop * intensity;
  const y = -28 * chop * intensity;
  const rotation = baseRotation + 22 * chop * intensity;
  return `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
