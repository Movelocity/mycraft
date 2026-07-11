import { useEffect, useRef, useState } from 'react';
import { BLOCKS, type BlockType } from '@/lib/minecraft/blocks';

interface Props {
  blockType: BlockType;
  isMoving: boolean;
  placeTrigger: number; // increment to trigger place animation
  breakTrigger: number; // increment to trigger break animation
}

export default function HeldItem({ blockType, isMoving, placeTrigger, breakTrigger }: Props) {
  const [swing, setSwing] = useState(false);
  const lastPlaceRef = useRef(placeTrigger);
  const lastBreakRef = useRef(breakTrigger);
  const animFrameRef = useRef(0);
  const swingAngleRef = useRef(0);

  // Detect place/break trigger changes
  useEffect(() => {
    if (placeTrigger !== lastPlaceRef.current || breakTrigger !== lastBreakRef.current) {
      lastPlaceRef.current = placeTrigger;
      lastBreakRef.current = breakTrigger;
      setSwing(true);
      swingAngleRef.current = 0;

      const startTime = performance.now();
      const animate = (now: number) => {
        const elapsed = now - startTime;
        if (elapsed < 250) {
          // Swing down then up: 0 -> 45deg -> 0
          const t = elapsed / 250;
          swingAngleRef.current = Math.sin(t * Math.PI) * 45;
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          swingAngleRef.current = 0;
          setSwing(false);
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [placeTrigger, breakTrigger]);

  const def = BLOCKS[blockType];
  const sideColor = `#${def.color.side.toString(16).padStart(6, '0')}`;
  const topColor = def.color.top
    ? `#${def.color.top.toString(16).padStart(6, '0')}`
    : sideColor;
  const dark = darken(sideColor, 50);

  // Bob animation state derived from CSS
  const bobClass = isMoving ? 'held-item-bob' : '';

  return (
    <div
      className={`held-item ${bobClass}`}
      style={{
        position: 'absolute',
        right: -80,
        bottom: -80,
        width: 240,
        height: 240,
        pointerEvents: 'none',
        transformOrigin: 'bottom right',
        transform: `rotate(${-20 + swingAngleRef.current}deg)`,
        transition: swing ? 'none' : 'transform 0.15s ease-out',
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
          filter: 'drop-shadow(3px 6px 4px rgba(0,0,0,0.5))',
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
  );
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
