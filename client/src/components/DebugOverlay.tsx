import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface DebugOverlayHandle {
  update(info: {
    x: number;
    y: number;
    z: number;
    fps: number;
    flying: boolean;
    targetBlock: string;
    chunks: number;
  }): void;
  setVisible(visible: boolean): void;
}

const DebugOverlay = forwardRef<DebugOverlayHandle>((_, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const xyzRef = useRef<HTMLSpanElement>(null);
  const chunksRef = useRef<HTMLSpanElement>(null);
  const blockRef = useRef<HTMLSpanElement>(null);
  const flyingRef = useRef<HTMLDivElement>(null);

  const visible = useRef(
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('debugVisible') === 'true'
      : false,
  );

  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.style.display = visible.current ? 'block' : 'none';
    }
  }, []);

  useImperativeHandle(ref, () => ({
    update({ x, y, z, fps, flying, targetBlock, chunks }) {
      if (!visible.current) return;
      if (fpsRef.current) fpsRef.current.textContent = String(fps);
      if (xyzRef.current) xyzRef.current.textContent = `${x} / ${y} / ${z}`;
      if (chunksRef.current) chunksRef.current.textContent = String(chunks);
      if (blockRef.current) blockRef.current.textContent = targetBlock;
      if (flyingRef.current) flyingRef.current.style.display = flying ? 'block' : 'none';
    },
    setVisible(v: boolean) {
      visible.current = v;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('debugVisible', String(v));
      }
      if (rootRef.current) {
        rootRef.current.style.display = v ? 'block' : 'none';
      }
    },
  }));

  return (
    <div
      ref={rootRef}
      className="absolute top-2 left-2 pointer-events-none"
      style={{ color: '#fff', fontSize: '9px', textShadow: '1px 1px 0 #000', lineHeight: '1.9' }}
    >
      <div style={{ color: '#FCFC00' }}>Web Minecraft</div>
      <div>FPS: <span ref={fpsRef}>0</span></div>
      <div>XYZ: <span ref={xyzRef}>0 / 0 / 0</span></div>
      <div>Chunks: <span ref={chunksRef}>0</span></div>
      <div style={{ color: '#88FF88' }}>Block: <span ref={blockRef}>air</span></div>
      <div ref={flyingRef} style={{ color: '#88DDFF', display: 'none' }}>✈ Flying</div>
      <div style={{ color: '#aaa', marginTop: '4px' }}>H = Help</div>
    </div>
  );
});

DebugOverlay.displayName = 'DebugOverlay';

export default DebugOverlay;
