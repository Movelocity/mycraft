import { describe, it, expect } from 'vitest';
import {
  GameTime,
  TICKS_PER_DAY,
  TICKS_PER_SECOND,
  DEFAULT_WORLD_TIME,
} from './time';

describe('GameTime', () => {
  it('uses DEFAULT_WORLD_TIME (6000) for new worlds', () => {
    const t = new GameTime();
    expect(DEFAULT_WORLD_TIME).toBe(6000);
    expect(t.worldTime).toBe(6000);
    expect(t.day).toBe(0);
    expect(t.timeOfDay).toBe(6000);
  });

  it('initializes from a saved worldTime', () => {
    const t = new GameTime({ worldTime: 12345 });
    expect(t.worldTime).toBe(12345);
    expect(t.timeOfDay).toBe(12345);
    expect(t.dayProgress).toBeCloseTo(12345 / TICKS_PER_DAY);
  });

  it('advances time when daylight cycle is enabled', () => {
    const t = new GameTime({ worldTime: 0 });
    t.update(1); // 1 real second
    expect(t.worldTime).toBeCloseTo(TICKS_PER_SECOND);
    expect(TICKS_PER_SECOND).toBe(20);
  });

  it('does not advance time when daylight cycle is disabled', () => {
    const t = new GameTime({ worldTime: 100, doDaylightCycle: false });
    t.update(5);
    expect(t.worldTime).toBe(100);
  });

  it('ignores negative or NaN dt', () => {
    const t = new GameTime({ worldTime: 100 });
    t.update(-1);
    t.update(NaN);
    expect(t.worldTime).toBe(100);
  });

  it('wraps dayProgress into [0,1) and day counts full days', () => {
    const t = new GameTime({ worldTime: TICKS_PER_DAY * 3 + 5000 });
    expect(t.day).toBe(3);
    expect(t.timeOfDay).toBe(5000);
    expect(t.dayProgress).toBeGreaterThanOrEqual(0);
    expect(t.dayProgress).toBeLessThan(1);
  });

  it('moon angle is offset from sun angle by PI', () => {
    const t = new GameTime({ worldTime: 6000 });
    expect(t.moonAngle).toBeCloseTo(t.sunAngle + Math.PI);
  });

  it('cloud offset is derived from worldTime deterministically', () => {
    const a = new GameTime({ worldTime: 6000 });
    const b = new GameTime({ worldTime: 6000 });
    expect(a.cloudOffset).toBe(b.cloudOffset);

    const c = new GameTime({ worldTime: 6000 + 1200 });
    expect(c.cloudOffset).toBe(a.cloudOffset + 1);
  });

  it('nighttime stays above the darkness floor', () => {
    const t = new GameTime({ worldTime: 18000 }); // midnight
    expect(t.lightLevel).toBeGreaterThan(0);
    expect(t.lightLevel).toBeLessThan(1);
  });

  it('noon is brighter than midnight', () => {
    const noon = new GameTime({ worldTime: 6000 });
    const midnight = new GameTime({ worldTime: 18000 });
    expect(noon.lightLevel).toBeGreaterThan(midnight.lightLevel);
  });

  it('snapshot is consistent with getters for the same worldTime', () => {
    const t = new GameTime({ worldTime: 9000 });
    const snap = t.snapshot();
    expect(snap.worldTime).toBe(t.worldTime);
    expect(snap.timeOfDay).toBe(t.timeOfDay);
    expect(snap.dayProgress).toBeCloseTo(t.dayProgress);
    expect(snap.sunAngle).toBeCloseTo(t.sunAngle);
    expect(snap.moonAngle).toBeCloseTo(t.moonAngle);
    expect(snap.lightLevel).toBeCloseTo(t.lightLevel);
    expect(snap.skyColorHex).toBe(t.skyColorHex);
    expect(snap.cloudOffset).toBe(t.cloudOffset);
  });

  it('coerces invalid saved worldTime to DEFAULT_WORLD_TIME', () => {
    expect(new GameTime({ worldTime: -1 }).worldTime).toBe(DEFAULT_WORLD_TIME);
    expect(new GameTime({ worldTime: NaN }).worldTime).toBe(DEFAULT_WORLD_TIME);
    expect(new GameTime({ worldTime: Number.POSITIVE_INFINITY }).worldTime).toBe(DEFAULT_WORLD_TIME);
  });
});