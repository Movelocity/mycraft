# Tasks

Tasks are ordered **easy → hard**. Complete each section before moving on; later items depend on earlier foundations.

---

## 1. Cleanup (Easy)

- [x] 1.1 Delete `client/src/lib/minecraft/world.ts`.
- [x] 1.2 Remove `buildWorldMesh` and all `world.ts` imports from `renderer.ts`.
- [x] 1.3 Remove unused `RENDER_DISTANCE` import side-effects; keep the constant in `chunk.ts` for later use.
- [x] 1.4 Remove `radius` from runtime game state and save extraction where it no longer applies.
- [x] 1.5 Remove debug `console.log` calls from `textures.ts` `getCachedTexture`.

## 2. Hot-Path Micro-Optimizations (Easy)

- [x] 2.1 Replace `getDirtyChunks()` full-scan with a `dirtySet: Set<string>` on `ChunkManager`; add on `setBlock`/`markDirty`, remove after rebuild.
- [x] 2.2 Replace `Array.from(this.chunks)` in `ChunkManager.update()` unload loop with direct `for..of` iteration.
- [x] 2.3 Create module-level shared `MeshLambertMaterial` instances (opaque + transparent) in `renderer.ts`; per-chunk code only creates/disposes `BufferGeometry`.
- [x] 2.4 Remove `computeVertexNormals()` from chunk mesh build (axis-aligned cubes do not need it).
- [x] 2.5 Reuse `THREE.Vector3` instances in `getTargetBlock` instead of per-step `clone()`.

## 3. Chunk Lifecycle Correctness (Easy–Medium)

- [x] 3.1 Add `disposeChunkMesh(scene, chunkX, chunkZ)` in `renderer.ts` or a new `mesh-lifecycle.ts` helper.
- [x] 3.2 Handle `ChunkManager.update()` return value `{ unloaded }` in the game loop; call `disposeChunkMesh` for each unloaded chunk.
- [x] 3.3 On game teardown (`initGame` cleanup), traverse scene and dispose all `chunk_*` groups.
- [x] 3.4 Create `ChangesIndex` class: `add(x,y,z,type)`, `getForChunk(chunkX,chunkZ)`, `hasChanges(chunkX,chunkZ)`.
- [x] 3.5 Wire `ChangesIndex` into block place/break handlers (replace flat `changes[]` append).
- [x] 3.6 After `generateChunk` / `getOrGenerateChunk`, call `ChangesIndex.applyToChunk(chunk)` to replay diffs.
- [x] 3.7 Unload policy: chunks **without** diffs → delete data + dispose mesh; chunks **with** diffs → dispose mesh only, retain `Chunk.blocks` in memory.

## 4. React Boundary — Debug HUD (Easy–Medium)

- [x] 4.1 Extract debug overlay into `DebugOverlay.tsx` with DOM refs for each field (x, y, z, fps, flying, target, chunks).
- [x] 4.2 Update debug fields from the game loop via refs (`textContent` / `data-*`), not `setState`.
- [x] 4.3 Add toggle: debug overlay hidden by default, show on `F3` key (persist last preference in `sessionStorage`).
- [x] 4.4 Remove `debugInfo` React state from `MinecraftGame.tsx`.

## 5. Render Distance (Medium)

- [x] 5.1 Add `meshGroup?: THREE.Group` field to `Chunk` interface.
- [x] 5.2 Split chunk lifecycle into **data loaded** (≤ `GENERATE_DISTANCE`) and **mesh visible** (≤ `RENDER_DISTANCE`).
- [x] 5.3 When a chunk is within render distance and has no mesh, build mesh and attach to scene.
- [x] 5.4 When a chunk exits render distance but stays within generate distance, remove mesh from scene and dispose geometry; keep chunk data.
- [x] 5.5 Store `chunk.meshGroup` on the `Chunk` object; `rebuildDirtyChunks` updates in place.

## 6. Raycast and Collision (Medium)

- [x] 6.1 Implement 3D DDA voxel raycast in `player.ts` replacing 0.05 step iteration.
- [x] 6.2 Keep the same `getTargetBlock` return shape so callers are unchanged.
- [ ] 6.3 Add a unit-style inline test or dev assertion for DDA against known block layouts (optional manual dev check documented in tasks PR).

## 7. Mesh Build Pipeline (Medium)

- [x] 7.1 Estimate vertex capacity from `chunk.blocks.size` and pre-allocate `Float32Array` / `Uint32Array` buffers.
- [x] 7.2 Add per-frame mesh rebuild budget (e.g. max 2 dirty chunks per frame); queue remaining dirty chunks.
- [x] 7.3 Cache column metadata during `generateChunk`: one `(biome, terrainHeight)` lookup per column instead of repeated noise calls.

## 8. Mobile UI Performance (Medium)

- [x] 8.1 Refactor `FloatingJoystick` to update knob position via ref + CSS `transform`; remove per-`touchmove` `setState`.
- [x] 8.2 Replace `BreakProgressRing` `backdrop-filter: invert(1)` with a GPU-friendly SVG ring or border stroke.
- [ ] 8.3 Drive break progress from `gameRef` in the main loop; remove independent break `requestAnimationFrame` from `useMobileControls`.
- [x] 8.4 Update break ring visual via ref/CSS variable, not React state bubbling to `MinecraftGame`.

## 9. GameEngine Extraction (Medium–Hard)

- [x] 9.1 Create `client/src/lib/minecraft/engine.ts` with `GameEngine` class: `init`, `tick`, `dispose`, `getSnapshot`.
- [x] 9.2 Move game loop body, chunk update, mesh lifecycle, input read, and render call into `GameEngine.tick(dt)`.
- [x] 9.3 Move `gameRef` fields into `GameEngine` private state; expose read-only snapshot for HUD.
- [x] 9.4 Slim `MinecraftGame.tsx` to: canvas mount, `GameEngine` lifecycle, React HUD, desktop/mobile input adapters.
- [x] 9.5 Move `attachDesktopHandlers` input wiring to accept `GameEngine` or `InputState` from engine.

## 10. Save v2 (Medium–Hard)

- [x] 10.1 Define `SaveDataV2` in `save.ts` with `version: 2`, `changesByChunk: Record<string, [lx,ly,lz,type][]>`.
- [x] 10.2 Remove v1 format and `radius` field entirely.
- [x] 10.3 Serialize with `pako` gzip before IndexedDB write; decompress on read.
- [x] 10.4 Keep a single long-lived IndexedDB connection (or connection promise) instead of open/close per operation.
- [x] 10.5 Update `extractSaveData` / `restoreFromSave` to use `ChangesIndex` bucket format.
- [x] 10.6 Update `Home.tsx` save slot UI to handle empty v2-only slots (no migration path).

## 11. Greedy Meshing (Hard, Optional)

- [ ] 11.1 Implement greedy mesh merger for axis-aligned faces within a single chunk.
- [ ] 11.2 Handle cross-chunk face visibility at chunk borders (neighbor opaque check unchanged).
- [ ] 11.3 Benchmark vertex count before/after on a flat terrain patch; document results.

## 12. Web Worker Generation (Hard, Optional)

- [ ] 12.1 Extract pure terrain functions from `chunk.ts` into `chunk-generate.ts` (no DOM/Three imports).
- [ ] 12.2 Add `chunk-worker.ts` that receives `{chunkX, chunkZ, seed}` and returns block list.
- [ ] 12.3 `ChunkManager` queues generation requests; applies results on main thread and triggers diff replay + dirty flag.
- [ ] 12.4 Fall back to main-thread generation when Workers are unavailable.

---

## Verification

- [ ] V.1 Explore 200+ blocks away and return; edited blocks match saved diffs.
- [ ] V.2 Chrome DevTools → Performance: no `setState` in game loop with debug overlay off.
- [ ] V.3 Chrome DevTools → Memory: scene mesh count stable after repeated load/unload cycles.
- [ ] V.4 Mobile: joystick drag does not trigger React re-render profiler spikes.
- [ ] V.5 `pnpm check` passes; `pnpm build` succeeds.
- [ ] V.6 New game save/load round-trip preserves seed, player pose, and block edits.
- [ ] V.7 Old v1 saves are rejected or treated as empty slots (no migration).
