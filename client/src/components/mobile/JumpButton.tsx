import { useRef, useCallback, useEffect } from 'react';

interface Props {
  flying: boolean;
  onJump: () => void;
  onJumpRelease: () => void;
  onAscend: () => void;
  onAscendRelease: () => void;
  onDescend: () => void;
  onDescendRelease: () => void;
  onToggleFly: () => void;
}

const BTN_SIZE = 76;
const BTN_STYLE: React.CSSProperties = {
  width: BTN_SIZE,
  height: BTN_SIZE,
  background: 'rgba(255,255,255,0.18)',
  border: '2px solid rgba(255,255,255,0.45)',
  color: '#fff',
  fontSize: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  cursor: 'pointer',
  touchAction: 'none',
};

function SquareBtn({
  label,
  onDown,
  onUp,
  active,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  active?: boolean;
}) {
  return (
    <div
      style={{
        ...BTN_STYLE,
        background: active ? 'rgba(255,255,255,0.38)' : BTN_STYLE.background,
      }}
      onTouchStart={(e) => { e.preventDefault(); onDown(); }}
      onTouchEnd={(e) => { e.preventDefault(); onUp(); }}
      onTouchCancel={(e) => { e.preventDefault(); onUp(); }}
    >
      {label}
    </div>
  );
}

export default function JumpButton({
  flying,
  onJump,
  onJumpRelease,
  onAscend,
  onAscendRelease,
  onDescend,
  onDescendRelease,
  onToggleFly,
}: Props) {
  const lastTapRef = useRef(0);
  const prevFlyingRef = useRef(flying);

  useEffect(() => {
    if (prevFlyingRef.current === flying) return;

    if (flying) {
      onJumpRelease();
    } else {
      onAscendRelease();
      onDescendRelease();
    }
    prevFlyingRef.current = flying;
  }, [flying, onJumpRelease, onAscendRelease, onDescendRelease]);

  const handleJumpDown = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      onToggleFly();
      onJumpRelease();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    onJump();
  }, [onJump, onJumpRelease, onToggleFly]);

  if (flying) {
    return (
      <div
        style={{
          position: 'absolute',
          right: 88,
          bottom: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          pointerEvents: 'auto',
        }}
      >
        <SquareBtn label="↑" onDown={onAscend} onUp={onAscendRelease} />
        <SquareBtn label="↓" onDown={onDescend} onUp={onDescendRelease} />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 90,
        bottom: 120,
        pointerEvents: 'auto',
      }}
    >
      <SquareBtn label="▲" onDown={handleJumpDown} onUp={onJumpRelease} />
    </div>
  );
}
