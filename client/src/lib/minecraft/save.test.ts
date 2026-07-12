import { describe, it, expect } from 'vitest';
import {
  CURRENT_SAVE_VERSION,
  extractSaveData,
  restoreFromSave,
} from './save';
import { ChangesIndex } from './chunk';
import { createPlayerState } from './player';

// These tests don't touch IndexedDB. They verify the pure
// serialize/deserialize helpers and the version contract.

describe('save v3', () => {
  it('uses version 3', () => {
    expect(CURRENT_SAVE_VERSION).toBe(3);
  });

  it('round-trips worldTime through extractSaveData → restoreFromSave', () => {
    const changesIndex = new ChangesIndex();
    const player = createPlayerState(1.5, 65.25, -3.75);
    const data = extractSaveData({
      slot: 1,
      seed: 12345,
      worldTime: 9000,
      changesIndex,
      player,
      hotbarIndex: 2,
    });

    expect(data.version).toBe(3);
    expect(data.world.worldTime).toBe(9000);

    const restored = restoreFromSave(data);
    expect(restored.worldTime).toBe(9000);
    expect(restored.seed).toBe(12345);
    expect(restored.hotbarIndex).toBe(2);
    expect(restored.player.position.x).toBeCloseTo(1.5);
    expect(restored.player.position.y).toBeCloseTo(65.25);
    expect(restored.player.position.z).toBeCloseTo(-3.75);
  });

  it('clamps invalid worldTime to 0 in the saved payload', () => {
    const changesIndex = new ChangesIndex();
    const player = createPlayerState(0, 60, 0);
    const a = extractSaveData({ slot: 1, seed: 1, worldTime: -100, changesIndex, player, hotbarIndex: 0 });
    const b = extractSaveData({ slot: 1, seed: 1, worldTime: Number.NaN, changesIndex, player, hotbarIndex: 0 });
    expect(a.world.worldTime).toBe(0);
    expect(b.world.worldTime).toBe(0);
  });

  it('treats worldTime as a finite non-negative number in the payload', () => {
    const changesIndex = new ChangesIndex();
    const player = createPlayerState(0, 60, 0);
    const data = extractSaveData({ slot: 1, seed: 1, worldTime: 24000 * 5 + 1234, changesIndex, player, hotbarIndex: 0 });
    expect(typeof data.world.worldTime).toBe('number');
    expect(Number.isFinite(data.world.worldTime)).toBe(true);
    expect(data.world.worldTime).toBeGreaterThanOrEqual(0);
  });
});