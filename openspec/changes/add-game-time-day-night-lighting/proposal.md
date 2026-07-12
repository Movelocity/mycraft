# Change: Add Game Time, Day-Night Cycle, and Ambient Lighting

## Why

The sky feature needs a persistent in-game clock before adding sun, moon, clouds, and lighting. If time is introduced only as a render detail, later systems such as save/load, sleep, moon phases, weather, crop growth, mob spawning, and light-dependent gameplay will need rework.

This change makes `worldTime` a first-class world state value, adds a dedicated `GameTime` module, and defines how the renderer derives day-night visuals and ambient light from that time.

## What Changes

- Introduce Save Format v3 with `world.worldTime: number`.
- Make v3 the only supported save format. Version mismatch is an explicit load failure; the UI should tell the player to delete the slot and recreate the world.
- Add `GameTime` as the single owner of in-game time progression and derived day-night values.
- Default new worlds to daytime.
- Drive sun, moon, sky color, directional light, ambient light, and cloud offset from `worldTime`.
- Introduce an air-light baseline so exposed air blocks can carry a brightness value derived from time of day.
- Keep cloud position deterministic by deriving cloud drift from `worldTime` rather than persisting separate cloud state.

## Out of Scope

- No compatibility or migration for v1/v2 saves.
- No sleep/bed gameplay.
- No weather simulation beyond leaving time-derived cloud drift room for it.
- No block-emitted light sources such as torches or lava.
- No mobs, spawning rules, crop growth, or calendar events.
- No advanced global illumination, shadow maps, or physically based sky model.

## Target Architecture

```
SaveDataV3
  └── world.worldTime

GameEngine
  ├── GameTime              # owns worldTime, pause/cycle settings, derived values
  ├── ChunkManager
  └── SkySystem             # consumes GameTimeSnapshot; owns sun/moon/cloud visuals

Renderer / mesh builder
  └── uses light values derived from GameTime, including air brightness
```

`worldTime` is the source of truth. Sky positions, moon phase, cloud offset, light strength, and sky colors are derived values and SHALL NOT be persisted separately.

## Time Model

- One full day is `24000` game ticks.
- New worlds start at `worldTime = 6000` by default, representing bright daytime.
- Runtime time advances while the game is running and the daylight cycle is enabled.
- The initial real-time day length target is 20 minutes, so time advances at 20 game ticks per real second.

Derived values:

```ts
const TICKS_PER_DAY = 24000;
const day = Math.floor(worldTime / TICKS_PER_DAY);
const timeOfDay = worldTime % TICKS_PER_DAY;
const dayProgress = timeOfDay / TICKS_PER_DAY;
```

## Save Behavior

Saving records the current `worldTime` together with seed, changed blocks, player state, and hotbar state.

Loading requires `version: 3`. If a save has any other version, load should fail with a clear reason so the home screen can present a delete/recreate prompt.

## Lighting Direction

The first lighting pass should stay simple and Minecraft-like:

- Sky/directional lighting changes continuously with time.
- Minimum nighttime ambient light remains nonzero so the game stays playable.
- Air blocks can expose a time-derived brightness baseline used by nearby visible faces.
- Opaque blocks still block sky/air light for later expansion, but full light propagation is not required in the first implementation.

## Risks

- Rebuilding chunk meshes every frame for light changes would be too expensive. The first implementation should avoid per-frame chunk rebuilds for smooth day-night transitions unless light data is quantized and rebuilds are throttled.
- A full per-voxel lighting engine can grow quickly. Start with global/time-derived air brightness and leave block light propagation for a later change.
- Save v3 is intentionally breaking; the home screen must explain unsupported saves instead of silently treating them as empty.
