import { gzip, ungzip } from 'pako';
import type { BlockType } from './blocks';
import type { PlayerState } from './player';
import { ChangesIndex } from './chunk';

const DB_NAME = 'web-minecraft';
const DB_VERSION = 2;
const STORE_NAME = 'saves';
const MAX_SLOTS = 3;

export type BlockChange = [x: number, y: number, z: number, type: BlockType];

export interface SaveDataV2 {
  version: 2;
  name: string;
  timestamp: number;
  world: {
    seed: number;
    changesByChunk: Record<string, [lx: number, ly: number, lz: number, type: BlockType][]>;
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

// ── IndexedDB connection singleton ──

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

// ── Compression helpers ──

function compress(data: SaveDataV2): Uint8Array {
  const json = JSON.stringify(data);
  return gzip(json);
}

function decompress(bytes: Uint8Array): SaveDataV2 {
  const result = ungzip(bytes, { toText: true } as Parameters<typeof ungzip>[1]);
  const json = typeof result === 'string' ? result : new TextDecoder().decode(result as Uint8Array);
  return JSON.parse(json) as SaveDataV2;
}

// ── Public API ──

export async function listSaves(): Promise<SaveInfo[]> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const saves: SaveInfo[] = [];

  for (let slot = 1; slot <= MAX_SLOTS; slot++) {
    const raw = await new Promise<Uint8Array | undefined>((resolve, reject) => {
      const req = store.get(slot);
      req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
      req.onerror = () => reject(req.error);
    });

    if (raw) {
      try {
        const data = decompress(raw);
        saves.push({
          slot,
          name: data.name,
          timestamp: data.timestamp,
          position: data.player.position,
        });
      } catch {
        saves.push({ slot, name: '', timestamp: 0, position: { x: 0, y: 0, z: 0 } });
      }
    } else {
      saves.push({ slot, name: '', timestamp: 0, position: { x: 0, y: 0, z: 0 } });
    }
  }

  return saves;
}

export async function saveGame(slot: number, data: SaveDataV2): Promise<void> {
  const db = await getDB();
  const compressed = compress(data);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(compressed, slot);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadGame(slot: number): Promise<SaveDataV2 | null> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const raw = await new Promise<Uint8Array | undefined>((resolve, reject) => {
    const req = store.get(slot);
    req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
    req.onerror = () => reject(req.error);
  });

  if (!raw) return null;
  try {
    return decompress(raw);
  } catch {
    return null;
  }
}

export async function deleteSave(slot: number): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(slot);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function slotName(slot: number): string {
  return `存档 ${slot}`;
}

// ── Serialization: game state → SaveDataV2 ──

export function extractSaveData(params: {
  slot: number;
  seed: number;
  changesIndex: ChangesIndex;
  player: PlayerState;
  hotbarIndex: number;
}): SaveDataV2 {
  return {
    version: 2,
    name: slotName(params.slot),
    timestamp: Date.now(),
    world: {
      seed: params.seed,
      changesByChunk: params.changesIndex.toRecord(),
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

// ── Deserialization: SaveDataV2 → restore params ──

export function restoreFromSave(data: SaveDataV2) {
  const changesIndex = ChangesIndex.fromRecord(data.world.changesByChunk);
  return {
    seed: data.world.seed,
    changesIndex,
    player: {
      position: data.player.position,
      yaw: data.player.yaw,
      pitch: data.player.pitch,
      flying: data.player.flying,
    },
    hotbarIndex: data.player.hotbarIndex,
  };
}
