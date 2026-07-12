import { gzip, ungzip } from 'pako';
import type { BlockType } from './blocks';
import type { PlayerState } from './player';
import { ChangesIndex } from './chunk';

const DB_NAME = 'web-minecraft';
const DB_VERSION = 2;
const STORE_NAME = 'saves';
const MAX_SLOTS = 3;

export type BlockChange = [x: number, y: number, z: number, type: BlockType];

export const CURRENT_SAVE_VERSION = 3 as const;

export interface SaveDataV3 {
  version: 3;
  name: string;
  timestamp: number;
  world: {
    seed: number;
    worldTime: number;
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

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; data: SaveDataV3 }
  | { kind: 'unsupported-version'; version: number }
  | { kind: 'corrupt'; message: string };

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

function compress(data: SaveDataV3): Uint8Array {
  const json = JSON.stringify(data);
  return gzip(json);
}

function decompress(bytes: Uint8Array): unknown {
  const result = ungzip(bytes, { toText: true } as Parameters<typeof ungzip>[1]);
  const json = typeof result === 'string' ? result : new TextDecoder().decode(result as Uint8Array);
  return JSON.parse(json);
}

// ── Public API ──

function isSaveDataV3(value: unknown): value is SaveDataV3 {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<SaveDataV3>;
  if (v.version !== CURRENT_SAVE_VERSION) return false;
  if (!v.world || typeof v.world !== 'object') return false;
  if (!v.player || typeof v.player !== 'object') return false;
  if (typeof v.world.seed !== 'number') return false;
  if (typeof v.world.worldTime !== 'number') return false;
  if (typeof v.world.changesByChunk !== 'object' || v.world.changesByChunk === null) return false;
  const pos = v.player.position;
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || typeof pos.z !== 'number') return false;
  if (typeof v.player.yaw !== 'number' || typeof v.player.pitch !== 'number') return false;
  if (typeof v.player.flying !== 'boolean' || typeof v.player.hotbarIndex !== 'number') return false;
  return true;
}

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
        const parsed = decompress(raw);
        if (isSaveDataV3(parsed)) {
          saves.push({
            slot,
            name: parsed.name,
            timestamp: parsed.timestamp,
            position: parsed.player.position,
          });
        } else {
          // Unsupported save version or shape — surface as a placeholder entry
          // so the home screen can offer deletion instead of silently dropping.
          saves.push({ slot, name: '', timestamp: 0, position: { x: 0, y: 0, z: 0 } });
        }
      } catch {
        saves.push({ slot, name: '', timestamp: 0, position: { x: 0, y: 0, z: 0 } });
      }
    } else {
      saves.push({ slot, name: '', timestamp: 0, position: { x: 0, y: 0, z: 0 } });
    }
  }

  return saves;
}

export async function saveGame(slot: number, data: SaveDataV3): Promise<void> {
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

export async function loadGame(slot: number): Promise<LoadResult> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const raw = await new Promise<Uint8Array | undefined>((resolve, reject) => {
    const req = store.get(slot);
    req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
    req.onerror = () => reject(req.error);
  });

  if (!raw) return { kind: 'empty' };

  let parsed: unknown;
  try {
    parsed = decompress(raw);
  } catch (err) {
    return { kind: 'corrupt', message: String((err as Error)?.message ?? err) };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { kind: 'corrupt', message: 'parsed save is not an object' };
  }

  const version = (parsed as { version?: unknown }).version;
  if (typeof version !== 'number') {
    return { kind: 'corrupt', message: 'missing version field' };
  }
  if (version !== CURRENT_SAVE_VERSION) {
    return { kind: 'unsupported-version', version };
  }
  if (!isSaveDataV3(parsed)) {
    return { kind: 'corrupt', message: 'save shape does not match v3 schema' };
  }
  return { kind: 'ok', data: parsed };
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

// ── Serialization: game state → SaveDataV3 ──

export function extractSaveData(params: {
  slot: number;
  seed: number;
  worldTime: number;
  changesIndex: ChangesIndex;
  player: PlayerState;
  hotbarIndex: number;
}): SaveDataV3 {
  const worldTime = Number.isFinite(params.worldTime) && params.worldTime >= 0
    ? params.worldTime
    : 0;
  return {
    version: CURRENT_SAVE_VERSION,
    name: slotName(params.slot),
    timestamp: Date.now(),
    world: {
      seed: params.seed,
      worldTime,
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

// ── Deserialization: SaveDataV3 → restore params ──

export function restoreFromSave(data: SaveDataV3) {
  const changesIndex = ChangesIndex.fromRecord(data.world.changesByChunk);
  return {
    seed: data.world.seed,
    worldTime: data.world.worldTime,
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