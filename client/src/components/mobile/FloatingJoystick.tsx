import { useRef, useCallback } from 'react';

interface Props {
  onMove: (x: number, y: number) => void;
  onRelease: () => void;
}

const STICK_RADIUS = 48;
const KNOB_RADIUS = 20;

export default function FloatingJoystick({ onMove, onRelease }: Props) {
  const touchIdRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const showJoystick = useCallback((ox: number, oy: number) => {
    const base = baseRef.current;
    if (!base) return;
    const size = STICK_RADIUS * 2 + 8;
    base.style.display = 'block';
    base.style.left = `${ox - STICK_RADIUS - 4}px`;
    base.style.top = `${oy - STICK_RADIUS - 4}px`;
    base.style.width = `${size}px`;
    base.style.height = `${size}px`;
    const knob = knobRef.current;
    if (knob) {
      knob.style.left = `${STICK_RADIUS + 4 - KNOB_RADIUS}px`;
      knob.style.top = `${STICK_RADIUS + 4 - KNOB_RADIUS}px`;
    }
  }, []);

  const hideJoystick = useCallback(() => {
    const base = baseRef.current;
    if (base) base.style.display = 'none';
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    originRef.current = { x: touch.clientX, y: touch.clientY };
    showJoystick(touch.clientX, touch.clientY);
  }, [showJoystick]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const origin = originRef.current;
    if (!origin) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== touchIdRef.current) continue;

      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clamped = Math.min(dist, STICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      const nx = (clamped / STICK_RADIUS) * Math.cos(angle);
      const ny = (clamped / STICK_RADIUS) * Math.sin(angle);

      const knob = knobRef.current;
      if (knob) {
        knob.style.left = `${STICK_RADIUS + 4 - KNOB_RADIUS + nx * STICK_RADIUS}px`;
        knob.style.top = `${STICK_RADIUS + 4 - KNOB_RADIUS + ny * STICK_RADIUS}px`;
      }
      onMove(nx, ny);
      break;
    }
  }, [onMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        originRef.current = null;
        hideJoystick();
        onRelease();
        break;
      }
    }
  }, [onRelease, hideJoystick]);

  const size = STICK_RADIUS * 2 + 8;

  return (
    <div
      className="absolute inset-0 left-0"
      style={{ width: '50%', pointerEvents: 'auto' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        ref={baseRef}
        style={{
          display: 'none',
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          border: '2px solid rgba(255,255,255,0.35)',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={knobRef}
          style={{
            position: 'absolute',
            width: KNOB_RADIUS * 2,
            height: KNOB_RADIUS * 2,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.55)',
            border: '2px solid rgba(255,255,255,0.8)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
