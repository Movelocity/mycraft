import { useRef, useState, useCallback } from 'react';

interface Props {
  onMove: (x: number, y: number) => void;
  onRelease: () => void;
}

const STICK_RADIUS = 48;
const KNOB_RADIUS = 20;

export default function FloatingJoystick({ onMove, onRelease }: Props) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setOrigin({ x: touch.clientX, y: touch.clientY });
    setKnob({ x: 0, y: 0 });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (origin === null) return;
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

      setKnob({ x: nx * STICK_RADIUS, y: ny * STICK_RADIUS });
      onMove(nx, ny);
      break;
    }
  }, [origin, onMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setOrigin(null);
        setKnob({ x: 0, y: 0 });
        onRelease();
        break;
      }
    }
  }, [onRelease]);

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
      {origin && (
        <div
          style={{
            position: 'absolute',
            left: origin.x - STICK_RADIUS - 4,
            top: origin.y - STICK_RADIUS - 4,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            border: '2px solid rgba(255,255,255,0.35)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: STICK_RADIUS + 4 - KNOB_RADIUS + knob.x,
              top: STICK_RADIUS + 4 - KNOB_RADIUS + knob.y,
              width: KNOB_RADIUS * 2,
              height: KNOB_RADIUS * 2,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.55)',
              border: '2px solid rgba(255,255,255,0.8)',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}
