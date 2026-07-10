// Home.tsx — Entry point for Web Minecraft Demo
import { useState, useEffect } from 'react';
import MinecraftGame, { type GameInitData } from '@/components/MinecraftGame';
import { listSaves, loadGame, type SaveInfo } from '@/lib/minecraft/save';

export default function Home() {
  const [gameData, setGameData] = useState<{ data: GameInitData; slot: number } | null>(null);
  const [saves, setSaves] = useState<SaveInfo[]>([]);

  useEffect(() => {
    listSaves().then(setSaves);
  }, []);

  const handleSelectSlot = async (slot: number) => {
    const saveData = await loadGame(slot);
    if (saveData) {
      const { restoreFromSave } = await import('@/lib/minecraft/save');
      const restored = restoreFromSave(saveData);
      setGameData({ data: restored, slot });
    } else {
      const seed = Math.floor(Math.random() * 99999);
      setGameData({ data: { seed, radius: 30 }, slot });
    }
  };

  const handleBackToMenu = () => {
    setGameData(null);
    listSaves().then(setSaves);
  };

  if (gameData) {
    return <MinecraftGame loadData={gameData.data} slot={gameData.slot} onExit={handleBackToMenu} />;
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', marginBottom: '24px' }}>
        {saves.map((save) => (
          <button
            key={save.slot}
            onClick={() => handleSelectSlot(save.slot)}
            style={{
              background: save.timestamp > 0 ? '#5D8A3C' : '#444',
              border: '3px solid #000',
              borderRight: '3px solid #2A2A2A',
              borderBottom: '3px solid #2A2A2A',
              color: '#fff',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '10px',
              padding: '12px 36px',
              cursor: 'pointer',
              textShadow: '2px 2px 0 #000',
              minWidth: '300px',
              textAlign: 'center',
              lineHeight: '2',
            }}
          >
            <div>{save.name || `存档 ${save.slot}`}</div>
            {save.timestamp > 0 ? (
              <div style={{ fontSize: '7px', color: '#ccc' }}>
                {new Date(save.timestamp).toLocaleDateString()} {new Date(save.timestamp).toLocaleTimeString()}
              </div>
            ) : (
              <div style={{ fontSize: '7px', color: '#888' }}>空存档</div>
            )}
          </button>
        ))}
      </div>

      {/* Tips */}
      <div style={{
        color: '#fff', fontSize: '8px', textShadow: '1px 1px 0 #000',
        textAlign: 'center', lineHeight: '2.2',
      }}>
        <div>Left Click = Break  ·  Right Click = Place</div>
        <div>WASD = Move  ·  Space = Jump  ·  F = Fly</div>
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
