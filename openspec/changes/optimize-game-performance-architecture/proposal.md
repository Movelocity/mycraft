# Change: Optimize Game Performance and Architecture

## Why

The chunk-based world system is directionally correct, but several design-doc commitments are incomplete and the React/Three.js boundary leaks high-frequency state into the render tree. Together this causes correctness bugs (player edits lost after chunk reload), GPU memory leaks (unloaded chunk meshes remain in the scene), and avoidable frame drops (per-frame React updates, redundant mesh/material allocation, brute-force raycasting).

This change delivers a coherent performance and architecture pass without backward-compatibility constraints, so the codebase can adopt the intended target design in one sweep.

## What Changes

- Remove legacy `world.ts` and dead `buildWorldMesh` code; unify all terrain logic in `chunk.ts`.
- Fix chunk lifecycle: dispose meshes on unload, replay player changes when chunks regenerate, and defer-unload chunks that still have diffs.
- Implement `RENDER_DISTANCE` so data generation and mesh rendering are decoupled.
- Optimize rendering: shared materials, typed-array mesh buffers, optional per-frame mesh rebuild budget, and later greedy meshing.
- Optimize hot paths: dirty-chunk set, 3D DDA raycast, column-level noise cache during generation.
- Re-establish the React boundary: debug HUD and mobile controls update via refs/DOM, not per-frame `setState`.
- Merge mobile break progress into the main game loop.
- Extract a `GameEngine` class to separate game loop logic from `MinecraftGame.tsx`.
- Replace save format with v2: per-chunk bucketed changes + gzip compression (no v1 migration).
- Optionally move chunk terrain generation to a Web Worker.

## Out of Scope

- Multiplayer or networking.
- New gameplay features (new blocks, mobs, inventory).
- Greedy meshing and Web Worker generation are optional late-phase items; they are specified but not required for the initial merge.
- Save v1 compatibility or automatic migration.
- iOS PWA / fullscreen quirks beyond current scope.
- Visual redesign of HUD or mobile controls.

## Target Architecture

```
Home.tsx
  └── MinecraftGame.tsx          # React shell: mount, HUD, pause, mobile overlays
        └── GameEngine             # Pure TS: loop, chunks, input, mesh lifecycle
              ├── ChunkManager
              ├── ChangesIndex     # Map<chunkKey, BlockChange[]>
              ├── MeshLifecycle    # create / dispose / visibility by render distance
              └── SaveManager v2
```

**Boundary rule:** React state updates only on discrete events (pause, save toast, underwater toggle, hotbar change). Continuous values (coordinates, FPS, break progress, joystick knob) use refs or direct DOM/CSS.

## User Experience

Players should not notice feature regressions. After this change:

- Block edits persist when leaving and returning to an area.
- Frame rate is more stable on desktop and mobile, especially with debug overlay and touch controls active.
- Long exploration sessions do not accumulate GPU memory from orphaned chunk meshes.
- Existing saves from before this change are not supported; players start fresh or re-create worlds.

## Risks

- `GameEngine` extraction is a large touch surface; land smaller lifecycle/rendering fixes first.
- Greedy meshing adds cross-chunk boundary complexity; defer until baseline mesh pipeline is stable.
- Web Worker chunk generation requires structured-clone-friendly block data; only pursue if main-thread generation remains a bottleneck after noise caching.
- Save v2 is a breaking change; communicate clearly in release notes.
