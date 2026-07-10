// Save system for Web Minecraft Demo
// Uses IndexedDB for persistent storage with 3 save slots

import type { BlockType } from './blocks';
import type { PlayerState } from './player';

const DB_NAME = 'web-minecraft';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const MAX_SLOTS = 3;

export type BlockChange = [x: number, y: number, z: number, type: BlockType];

export interface SaveData {
  version: 1;
  name: string;
  timestamp: number;
  world: {
    seed: number;
    radius: number;
    changes: BlockChange[];
  };
  player: {
    position: { x: number; y: number; z: number };
    yaw: number;
    pitch: number;
    flying: boolean;
    hotbarIndex: number;
  };
}

export interface SaveInfo {
  slot: number;
  name: string;
  timestamp: number;
  position: { x: number; y: number; z: number };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listSaves(): Promise<SaveInfo[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const saves: SaveInfo[] = [];

  for (let slot = 1; slot <= MAX_SLOTS; slot++) {
    const data = await new Promise<SaveData | undefined>((resolve, reject) => {
      const req = store.get(slot);
      req.onsuccess = () => resolve(req.result as SaveData | undefined);
      req.onerror = () => reject(req.error);
    });
    if (data) {
      saves.push({
        slot,
        name: data.name,
        timestamp: data.timestamp,
        position: data.player.position,
      });
    } else {
      saves.push({ slot, name: '', timestamp: 0, position: { x: 0, y: 0, z: 0 } });
    }
  }

  db.close();
  return saves;
}

export async function saveGame(slot: number, data: SaveData): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(data, slot);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadGame(slot: number): Promise<SaveData | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const data = await new Promise<SaveData | undefined>((resolve, reject) => {
    const req = store.get(slot);
    req.onsuccess = () => resolve(req.result as SaveData | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return data ?? null;
}

export async function deleteSave(slot: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(slot);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function slotName(slot: number): string {
  return `存档 ${slot}`;
}

// ── 序列化：游戏状态 → SaveData ──

export function extractSaveData(params: {
  slot: number;
  seed: number;
  radius: number;
  changes: BlockChange[];
  player: PlayerState;
  hotbarIndex: number;
}): SaveData {
  return {
    version: 1,
    name: slotName(params.slot),
    timestamp: Date.now(),
    world: {
      seed: params.seed,
      radius: params.radius,
      changes: params.changes,
    },
    player: {
      position: {
        x: Math.round(params.player.position.x * 100) / 100,
        y: Math.round(params.player.position.y * 100) / 100,
        z: Math.round(params.player.position.z * 100) / 100,
      },
      yaw: params.player.yaw,
      pitch: params.player.pitch,
      flying: params.player.flying,
      hotbarIndex: params.hotbarIndex,
    },
  };
}

// ── 反序列化：SaveData → 恢复参数 ──

export function restoreFromSave(data: SaveData) {
  return {
    seed: data.world.seed,
    radius: data.world.radius,
    changes: data.world.changes,
    player: {
      position: data.player.position,
      yaw: data.player.yaw,
      pitch: data.player.pitch,
      flying: data.player.flying,
    },
    hotbarIndex: data.player.hotbarIndex,
  };
}
