// Pure, deterministic in-game time model.
//
// All values derive from a single source of truth: `worldTime`.
// No DOM, no Three.js, no side effects beyond updating internal state
// in `update(dtSeconds)`.

export const TICKS_PER_DAY = 24000;
export const DEFAULT_WORLD_TIME = 6000;
export const TICKS_PER_SECOND = 20;

// Day phases by `timeOfDay` (0..24000).
// Dawn ~ 0, Noon ~ 6000, Dusk ~ 12000, Midnight ~ 18000.
const SUNRISE_START = 22000; // 11pm-ish sky starts warming up
const SUNRISE_END = 24000;   // wrap, dawn visible after SUNRISE_END window re-enters 0
const DAY_END = 12000;       // noon at 6000; dusk band starts after this
const SUNSET_END = 13800;
const NIGHT_END = 22200;

export interface GameTimeOptions {
  worldTime?: number;
  doDaylightCycle?: boolean;
  ticksPerSecond?: number;
}

export interface SkyColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface GameTimeSnapshot {
  worldTime: number;
  day: number;
  timeOfDay: number;
  dayProgress: number;
  doDaylightCycle: boolean;
  sunAngle: number;
  moonAngle: number;
  /** 0 = full dark, 1 = full bright. Floor at NIGHT_FLOOR so night stays readable. */
  lightLevel: number;
  /** Hex color for sky / fog / scene.background. */
  skyColorHex: number;
  skyColor: SkyColorRGB;
  ambientColor: SkyColorRGB;
  ambientColorHex: number;
  /** Multiplier applied to the directional light intensity. */
  directionalIntensity: number;
  /** Deterministic cloud drift offset derived from worldTime. */
  cloudOffset: number;
}

const NIGHT_FLOOR = 0.18;

const NOON_SKY = { r: 0x87, g: 0xce, b: 0xeb };
const DAWN_SKY = { r: 0xff, g: 0xb6, b: 0x7a };
const DUSK_SKY = { r: 0xff, g: 0x8a, b: 0x5e };
const NIGHT_SKY = { r: 0x10, g: 0x18, b: 0x30 };

const NOON_AMBIENT = { r: 0x80, g: 0x90, b: 0xb0 };
const DAWN_AMBIENT = { r: 0xff, g: 0xa0, b: 0x80 };
const DUSK_AMBIENT = { r: 0xff, g: 0x70, b: 0x60 };
const NIGHT_AMBIENT = { r: 0x40, g: 0x48, b: 0x70 };

const NOON_DIRECTIONAL = 1.4;
const NIGHT_DIRECTIONAL = 0.0;
const MOON_DIRECTIONAL = 0.18;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function mix3(a: SkyColorRGB, b: SkyColorRGB, t: number): SkyColorRGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function rgbToHex(c: SkyColorRGB): number {
  const r = clamp(Math.round(c.r), 0, 255);
  const g = clamp(Math.round(c.g), 0, 255);
  const b = clamp(Math.round(c.b), 0, 255);
  return (r << 16) | (g << 8) | b;
}

/**
 * Triangular phase weight: 0 outside [start, end], peaks at 1 at peakTick,
 * linear in/out on each side. All times in `timeOfDay` (0..TICKS_PER_DAY).
 */
function triangularPulse(
  timeOfDay: number,
  start: number,
  peakTick: number,
  end: number,
): number {
  if (timeOfDay <= start || timeOfDay >= end) return 0;
  if (timeOfDay <= peakTick) {
    return (timeOfDay - start) / (peakTick - start);
  }
  return 1 - (timeOfDay - peakTick) / (end - peakTick);
}

function computeSkyAndLight(timeOfDay: number) {
  // Smoothstep weights for the four phases. Bands overlap so transitions feel continuous.
  // Dawn band centered at timeOfDay ~ 0 (wraps midnight).
  // Noon: timeOfDay near 6000.
  // Dusk: timeOfDay near 12000.
  // Midnight: timeOfDay near 18000.

  const dawn = Math.max(
    triangularPulse(timeOfDay, SUNRISE_START, TICKS_PER_DAY, TICKS_PER_DAY) +
    triangularPulse(timeOfDay, 0, 600, 1200),
    0,
  );
  const noon = triangularPulse(timeOfDay, 3000, 6000, 9000);
  const dusk = triangularPulse(timeOfDay, DAY_END, 12600, SUNSET_END);
  const midnight = triangularPulse(timeOfDay, NIGHT_END, 18000 + 2400, SUNRISE_START);

  // Normalize so weights roughly sum to 1 in transitions; we won't be strict.
  // Build sky color: weighted blend of phase colors.
  let sky: SkyColorRGB = { r: 0, g: 0, b: 0 };
  sky.r += NOON_SKY.r * noon;
  sky.g += NOON_SKY.g * noon;
  sky.b += NOON_SKY.b * noon;

  sky.r += DAWN_SKY.r * dawn;
  sky.g += DAWN_SKY.g * dawn;
  sky.b += DAWN_SKY.b * dawn;

  sky.r += DUSK_SKY.r * dusk;
  sky.g += DUSK_SKY.g * dusk;
  sky.b += DUSK_SKY.b * dusk;

  sky.r += NIGHT_SKY.r * midnight;
  sky.g += NIGHT_SKY.g * midnight;
  sky.b += NIGHT_SKY.b * midnight;

  const w = noon + dawn + dusk + midnight;
  if (w > 0) {
    sky.r /= w;
    sky.g /= w;
    sky.b /= w;
  } else {
    sky = { ...NIGHT_SKY };
  }

  let ambient: SkyColorRGB = { r: 0, g: 0, b: 0 };
  ambient.r += NOON_AMBIENT.r * noon;
  ambient.g += NOON_AMBIENT.g * noon;
  ambient.b += NOON_AMBIENT.b * noon;

  ambient.r += DAWN_AMBIENT.r * dawn;
  ambient.g += DAWN_AMBIENT.g * dawn;
  ambient.b += DAWN_AMBIENT.b * dawn;

  ambient.r += DUSK_AMBIENT.r * dusk;
  ambient.g += DUSK_AMBIENT.g * dusk;
  ambient.b += DUSK_AMBIENT.b * dusk;

  ambient.r += NIGHT_AMBIENT.r * midnight;
  ambient.g += NIGHT_AMBIENT.g * midnight;
  ambient.b += NIGHT_AMBIENT.b * midnight;

  if (w > 0) {
    ambient.r /= w;
    ambient.g /= w;
    ambient.b /= w;
  } else {
    ambient = { ...NIGHT_AMBIENT };
  }

  // Light level: peak at noon (timeOfDay=6000), zero at midnight (18000).
  // cos is 1 at offset 0 and -1 at offset PI, so noon=peak, midnight=trough.
  const sunArc = Math.cos(((timeOfDay - 6000) / TICKS_PER_DAY) * Math.PI * 2);
  let lightLevel = Math.max(0, sunArc);
  // Soft floor at night so the world stays readable.
  lightLevel = NIGHT_FLOOR + (1 - NIGHT_FLOOR) * lightLevel;

  // Directional intensity: 0 at night, peak at noon.
  let directionalIntensity = Math.max(0, sunArc) * NOON_DIRECTIONAL;
  // Tiny moon intensity when sun is below horizon so light still varies.
  if (sunArc < 0) {
    directionalIntensity = Math.abs(sunArc) * MOON_DIRECTIONAL;
  }

  return { sky, ambient, lightLevel, directionalIntensity };
}

export class GameTime {
  worldTime: number;
  doDaylightCycle: boolean;
  readonly ticksPerSecond: number;

  constructor(options: GameTimeOptions = {}) {
    const raw = options.worldTime ?? DEFAULT_WORLD_TIME;
    this.worldTime = Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_WORLD_TIME;
    this.doDaylightCycle = options.doDaylightCycle ?? true;
    this.ticksPerSecond = options.ticksPerSecond ?? TICKS_PER_SECOND;
  }

  update(dtSeconds: number): void {
    if (!this.doDaylightCycle) return;
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    this.worldTime += dtSeconds * this.ticksPerSecond;
  }

  get day(): number {
    return Math.floor(this.worldTime / TICKS_PER_DAY);
  }

  get timeOfDay(): number {
    return ((this.worldTime % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  }

  get dayProgress(): number {
    return this.timeOfDay / TICKS_PER_DAY;
  }

  /**
   * Sun angle in radians. Returns the standard "sky position" angle used to
   * place the sun on a unit circle around the camera (0 = east horizon,
   * PI/2 = zenith, PI = west horizon, -PI/2 = nadir).
   */
  get sunAngle(): number {
    // Map timeOfDay so that noon (6000) is PI/2, midnight (18000) is -PI/2.
    const t = this.timeOfDay / TICKS_PER_DAY;
    return t * Math.PI * 2 - Math.PI / 2;
  }

  get moonAngle(): number {
    return this.sunAngle + Math.PI;
  }

  get lightLevel(): number {
    return computeSkyAndLight(this.timeOfDay).lightLevel;
  }

  get skyColor(): SkyColorRGB {
    return computeSkyAndLight(this.timeOfDay).sky;
  }

  get skyColorHex(): number {
    return rgbToHex(this.skyColor);
  }

  get ambientColor(): SkyColorRGB {
    return computeSkyAndLight(this.timeOfDay).ambient;
  }

  get ambientColorHex(): number {
    return rgbToHex(this.ambientColor);
  }

  get directionalIntensity(): number {
    return computeSkyAndLight(this.timeOfDay).directionalIntensity;
  }

  /**
   * Deterministic cloud drift offset. Pure function of worldTime so cloud
   * position survives save/load without persisting any extra state.
   */
  get cloudOffset(): number {
    // Roughly one tile per ~1200 game ticks (1 minute of real time at 20 t/s).
    return this.worldTime / 1200;
  }

  snapshot(): GameTimeSnapshot {
    const computed = computeSkyAndLight(this.timeOfDay);
    return {
      worldTime: this.worldTime,
      day: this.day,
      timeOfDay: this.timeOfDay,
      dayProgress: this.dayProgress,
      doDaylightCycle: this.doDaylightCycle,
      sunAngle: this.sunAngle,
      moonAngle: this.moonAngle,
      lightLevel: computed.lightLevel,
      skyColor: computed.sky,
      skyColorHex: rgbToHex(computed.sky),
      ambientColor: computed.ambient,
      ambientColorHex: rgbToHex(computed.ambient),
      directionalIntensity: computed.directionalIntensity,
      cloudOffset: this.cloudOffset,
    };
  }
}

// Internal helpers exposed for unit tests only.
export const __internals = {
  computeSkyAndLight,
  triangularPulse,
};