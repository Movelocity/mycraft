// Home.tsx — Entry point for Web Minecraft Demo
import { useState, useEffect, useCallback } from 'react';
import MinecraftGame, { type GameInitData } from '@/components/MinecraftGame';
import { listSaves, loadGame, deleteSave, type SaveInfo } from '@/lib/minecraft/save';
import { isMobileUA, enterFullscreen, isLandscape } from '@/utils/mobile';

export default function Home() {
  const [gameData, setGameData] = useState<{ data: GameInitData; slot: number; mobile: boolean } | null>(null);
  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [showRotateHint, setShowRotateHint] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [mobileOrientationBlock, setMobileOrientationBlock] = useState<number | null>(null);
  const isMobile = isMobileUA();

  const refreshSaves = useCallback(() => listSaves().then(setSaves), []);

  useEffect(() => {
    refreshSaves();
  }, [refreshSaves]);

  useEffect(() => {
    if (!gameData?.mobile) return;
    const check = () => setShowRotateHint(!isLandscape());
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [gameData?.mobile]);

  // 移动端：监听方向变化，横屏后自动进入游戏
  useEffect(() => {
    if (mobileOrientationBlock === null) return;
    const tryEnter = async () => {
      if (!isLandscape()) return;
      const slot = mobileOrientationBlock;
      setMobileOrientationBlock(null);
      await doEnterGame(slot, true);
    };
    tryEnter();
    window.addEventListener('resize', tryEnter);
    window.addEventListener('orientationchange', tryEnter);
    return () => {
      window.removeEventListener('resize', tryEnter);
      window.removeEventListener('orientationchange', tryEnter);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileOrientationBlock]);

  const doEnterGame = async (slot: number, mobile: boolean) => {
    const saveData = await loadGame(slot);
    if (saveData) {
      const { restoreFromSave } = await import('@/lib/minecraft/save');
      const restored = restoreFromSave(saveData);
      setGameData({ data: restored, slot, mobile });
    } else {
      const seed = Math.floor(Math.random() * 99999);
      setGameData({ data: { seed, radius: 30 }, slot, mobile });
    }
  };

  const handleSelectSlot = async (slot: number) => {
    if (isMobile) {
      await enterFullscreen().catch(() => {});
      if (!isLandscape()) {
        setMobileOrientationBlock(slot);
        return;
      }
      await doEnterGame(slot, true);
    } else {
      await doEnterGame(slot, false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, slot: number) => {
    e.stopPropagation();
    setConfirmDelete(slot);
  };

  const handleConfirmDelete = async () => {
    if (confirmDelete === null) return;
    await deleteSave(confirmDelete);
    setConfirmDelete(null);
    refreshSaves();
  };

  const handleBackToMenu = () => {
    setGameData(null);
    refreshSaves();
  };

  if (mobileOrientationBlock !== null) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontFamily: "'Press Start 2P', monospace",
        textAlign: 'center', gap: 24, padding: 24,
      }}>
        <div style={{ fontSize: 64, lineHeight: 1 }}>📱</div>
        <div style={{ fontSize: 11, lineHeight: 2, color: '#FCFC00', textShadow: '2px 2px 0 #000' }}>
          请旋转设备至横屏
        </div>
        <div style={{ fontSize: 8, color: '#aaa', lineHeight: 2 }}>
          横屏体验更佳，竖屏无法进入游戏
        </div>
        <button
          onClick={() => setMobileOrientationBlock(null)}
          style={{
            marginTop: 8,
            background: 'transparent', border: '2px solid #555',
            color: '#777', fontFamily: "'Press Start 2P', monospace",
            fontSize: 7, padding: '8px 16px', cursor: 'pointer',
          }}
        >
          返回菜单
        </button>
      </div>
    );
  }

  if (gameData) {
    return (
      <>
        <MinecraftGame
          loadData={gameData.data}
          slot={gameData.slot}
          onExit={handleBackToMenu}
          mobileMode={gameData.mobile}
        />
        {showRotateHint && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: "'Press Start 2P', monospace",
            fontSize: 10, textAlign: 'center', gap: 16,
          }}>
            <div style={{ fontSize: 48 }}>↻</div>
            <div>请将设备旋转至横屏</div>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className="w-full h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #87CEEB 0%, #87CEEB 55%, #5D8A3C 55%, #5D8A3C 62%, #8B5E3C 62%, #8B5E3C 100%)',
        fontFamily: "'Press Start 2P', monospace",
        userSelect: 'none',
      }}
    >
      {/* Clouds */}
      <div style={{ position: 'absolute', top: '8%', left: '5%', opacity: 0.85 }}>
        <CloudShape />
      </div>
      <div style={{ position: 'absolute', top: '15%', right: '10%', opacity: 0.7, transform: 'scale(0.7)' }}>
        <CloudShape />
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '40px', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '5px', left: '5px',
          fontSize: 'clamp(26px, 5.5vw, 52px)',
          color: '#3A3A00', letterSpacing: '2px', whiteSpace: 'nowrap',
        }}>MINECRAFT</div>
        <div style={{
          fontSize: 'clamp(26px, 5.5vw, 52px)',
          color: '#FCFC00', letterSpacing: '2px', whiteSpace: 'nowrap', position: 'relative',
        }}>MINECRAFT</div>
        <div style={{
          fontSize: 'clamp(9px, 1.8vw, 14px)',
          color: '#fff', textShadow: '2px 2px 0 #000', letterSpacing: '6px', marginTop: '6px',
        }}>WEB DEMO</div>
      </div>

      {/* Save Slots */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', marginBottom: '24px', width: '90%', maxWidth: '360px' }}>
        {saves.map((save) => (
          <div key={save.slot} style={{ width: '100%', position: 'relative' }}>
            <button
              onClick={() => handleSelectSlot(save.slot)}
              style={{
                width: '100%',
                background: save.timestamp > 0 ? '#5D8A3C' : '#444',
                border: '3px solid #000',
                borderRight: '3px solid #2A2A2A',
                borderBottom: '3px solid #2A2A2A',
                color: '#fff',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 'clamp(8px, 2vw, 10px)',
                padding: '12px 16px',
                cursor: 'pointer',
                textShadow: '2px 2px 0 #000',
                textAlign: 'center',
                lineHeight: '2',
              }}
            >
              <div>{save.name || `存档 ${save.slot}`}</div>
              {save.timestamp > 0 ? (
                <div style={{ fontSize: 'clamp(6px, 1.5vw, 7px)', color: '#ccc' }}>
                  {new Date(save.timestamp).toLocaleDateString()} {new Date(save.timestamp).toLocaleTimeString()}
                </div>
              ) : (
                <div style={{ fontSize: 'clamp(6px, 1.5vw, 7px)', color: '#888' }}>空存档</div>
              )}
            </button>
            {save.timestamp > 0 && (
              <button
                onClick={(e) => handleDeleteClick(e, save.slot)}
                title="删除存档"
                style={{
                  position: 'absolute', top: 0, right: 0, bottom: 0,
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.45)',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 11,
                  padding: '0 12px',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirm Modal */}
      {confirmDelete !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#222',
            border: '4px solid #000',
            borderRight: '4px solid #111',
            borderBottom: '4px solid #111',
            padding: '28px 32px',
            fontFamily: "'Press Start 2P', monospace",
            color: '#fff',
            textAlign: 'center',
            maxWidth: 320,
            width: '85%',
          }}>
            <div style={{ fontSize: 10, marginBottom: 16, lineHeight: 2, textShadow: '2px 2px 0 #000' }}>
              删除存档 {confirmDelete}？
            </div>
            <div style={{ fontSize: 7, color: '#aaa', marginBottom: 24, lineHeight: 2 }}>
              此操作无法撤销
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={handleConfirmDelete}
                style={{
                  background: '#7a1a1a',
                  border: '3px solid #000',
                  borderRight: '3px solid #2A2A2A',
                  borderBottom: '3px solid #2A2A2A',
                  color: '#fff',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 8, padding: '10px 16px', cursor: 'pointer',
                }}
              >
                确认删除
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  background: '#444',
                  border: '3px solid #000',
                  borderRight: '3px solid #2A2A2A',
                  borderBottom: '3px solid #2A2A2A',
                  color: '#fff',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 8, padding: '10px 16px', cursor: 'pointer',
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div style={{
        color: '#fff', fontSize: 'clamp(6px, 1.6vw, 8px)', textShadow: '1px 1px 0 #000',
        textAlign: 'center', lineHeight: '2.2', padding: '0 16px',
      }}>
        {isMobile ? (
          <>
            <div>轻触右侧 = 放置方块 · 长按右侧 = 破坏</div>
            <div>左摇杆移动 · 右滑视角 · 跳跃按钮</div>
          </>
        ) : (
          <>
            <div>Left Click = Break  ·  Right Click = Place</div>
            <div>WASD = Move  ·  Space = Jump  ·  F = Fly</div>
          </>
        )}
      </div>

      {/* Version */}
      <div style={{
        position: 'absolute', bottom: '16px', right: '16px',
        color: 'rgba(255,255,255,0.5)', fontSize: '7px', textShadow: '1px 1px 0 #000',
      }}>
        Web Demo v1.0 · Three.js
      </div>
    </div>
  );
}

function CloudShape() {
  return (
    <svg width="120" height="50" viewBox="0 0 120 50" style={{ imageRendering: 'pixelated' }}>
      <rect x="20" y="30" width="80" height="20" fill="white" />
      <rect x="30" y="20" width="60" height="20" fill="white" />
      <rect x="40" y="10" width="40" height="20" fill="white" />
    </svg>
  );
}
