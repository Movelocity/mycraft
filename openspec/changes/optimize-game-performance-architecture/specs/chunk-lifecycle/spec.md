# Chunk Lifecycle Specification Delta

## ADDED Requirements

### Requirement: Chunk Mesh Disposal on Unload

The game engine SHALL remove and dispose Three.js resources for every chunk that leaves the loaded region.

#### Scenario: Chunk exits unload distance

- **GIVEN** a chunk mesh named `chunk_{x}_{z}` exists in the scene
- **WHEN** `ChunkManager.update()` marks that chunk as unloaded
- **THEN** the engine SHALL remove the mesh group from the scene
- **AND** the engine SHALL dispose all child `BufferGeometry` instances
- **AND** shared materials SHALL NOT be disposed

#### Scenario: Game session ends

- **GIVEN** the player exits gameplay or the canvas unmounts
- **WHEN** `GameEngine.dispose()` or equivalent cleanup runs
- **THEN** all `chunk_*` mesh groups SHALL be removed and their geometries disposed

### Requirement: Player Changes Replay on Chunk Regeneration

The game SHALL re-apply saved block diffs whenever a chunk is generated or re-loaded into memory.

#### Scenario: Player returns to a previously edited area

- **GIVEN** the player placed or destroyed blocks at world coordinates `(x, y, z)`
- **AND** those changes are recorded in `ChangesIndex`
- **WHEN** the chunk containing `(x, z)` is generated via `getOrGenerateChunk`
- **THEN** the engine SHALL apply all diffs for that chunk before mesh build
- **AND** the resulting world state SHALL match the last saved diff for each coordinate

#### Scenario: Diff applies to generated terrain

- **GIVEN** procedural terrain would place stone at `(x, y, z)`
- **AND** the player previously destroyed that block (diff = `air`)
- **WHEN** the chunk regenerates
- **THEN** `getBlock(x, y, z)` SHALL return `air`

### Requirement: Diff-Aware Unload Policy

Chunks with player modifications SHALL NOT lose block data when the player moves away.

#### Scenario: Unload chunk without player edits

- **GIVEN** a loaded chunk has no entries in `ChangesIndex`
- **WHEN** the chunk exceeds `UNLOAD_DISTANCE`
- **THEN** the chunk data SHALL be removed from `ChunkManager`
- **AND** the chunk mesh SHALL be disposed

#### Scenario: Unload chunk with player edits

- **GIVEN** a loaded chunk has one or more entries in `ChangesIndex`
- **WHEN** the chunk exceeds `UNLOAD_DISTANCE`
- **THEN** the chunk block data SHALL remain in memory
- **AND** the chunk mesh SHALL be disposed
- **AND** the chunk SHALL NOT appear in the scene until the player returns within render distance

### Requirement: Dirty Chunk Tracking

The chunk manager SHALL track dirty chunks incrementally without scanning all loaded chunks each frame.

#### Scenario: Block change marks chunk dirty

- **GIVEN** a block is placed or destroyed via `setBlock`
- **WHEN** the owning chunk and any border-adjacent chunks are marked dirty
- **THEN** their chunk keys SHALL be added to `dirtySet`

#### Scenario: Mesh rebuild clears dirty flag

- **GIVEN** a chunk key is in `dirtySet`
- **WHEN** the chunk mesh is successfully rebuilt
- **THEN** the chunk key SHALL be removed from `dirtySet`
- **AND** `chunk.dirty` SHALL be `false`

## MODIFIED Requirements

### Requirement: Render Distance Decoupled from Generate Distance

The engine SHALL keep chunk **data** and chunk **meshes** at different distance thresholds.

#### Scenario: Chunk within generate distance but outside render distance

- **GIVEN** a chunk is within `GENERATE_DISTANCE` of the player
- **AND** the chunk is outside `RENDER_DISTANCE`
- **WHEN** the frame updates
- **THEN** chunk block data SHALL be available for physics and raycasts
- **AND** no mesh for that chunk SHALL be present in the scene

#### Scenario: Chunk enters render distance

- **GIVEN** chunk data exists for `(chunkX, chunkZ)`
- **AND** the chunk is within `RENDER_DISTANCE`
- **WHEN** no mesh is attached
- **THEN** the engine SHALL build and attach a mesh for that chunk

#### Scenario: Chunk exits render distance

- **GIVEN** a chunk mesh is visible in the scene
- **WHEN** the player moves such that the chunk exceeds `RENDER_DISTANCE` but remains within `GENERATE_DISTANCE`
- **THEN** the mesh SHALL be removed and its geometry disposed
- **AND** chunk block data SHALL remain loaded

## REMOVED Requirements

### Requirement: Legacy World Map Generation

**Reason:** `world.ts` duplicated terrain logic and is unused at runtime.

**Migration:** All terrain access goes through `ChunkManager`. `buildWorldMesh` is deleted.

### Requirement: Flat Changes Array Only at Runtime

**Reason:** Flat arrays require full scans on chunk reload.

**Migration:** Runtime block edits use `ChangesIndex`; persistence uses per-chunk buckets in Save v2.
