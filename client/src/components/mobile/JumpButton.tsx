import { useRef, useCallback } from 'react';

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

const BTN_SIZE = 52;
const BTN_STYLE: React.CSSProperties = {
  width: BTN_SIZE,
  height: BTN_SIZE,
  background: 'rgba(255,255,255,0.18)',
  border: '2px solid rgba(255,255,255,0.45)',
  color: '#fff',
  fontSize: 20,
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

  const handleJumpDown = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      onToggleFly();
    }
    lastTapRef.current = now;
    onJump();
  }, [onJump, onToggleFly]);

  if (flying) {
    return (
      <div
        style={{
          position: 'absolute',
          right: 20,
          bottom: 80,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'auto',
        }}
      >
        <SquareBtn label="↑" onDown={onAscend} onUp={onAscendRelease} />
        <SquareBtn label="✈" onDown={onToggleFly} onUp={() => {}} />
        <SquareBtn label="↓" onDown={onDescend} onUp={onDescendRelease} />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 20,
        bottom: 80,
        pointerEvents: 'auto',
      }}
    >
      <SquareBtn label="▲" onDown={handleJumpDown} onUp={onJumpRelease} />
    </div>
  );
}
