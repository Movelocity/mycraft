# Player Interaction Specification Delta

## ADDED Requirements

### Requirement: 3D DDA Voxel Raycast

Block targeting SHALL use a 3D DDA algorithm instead of fixed-step ray marching.

#### Scenario: Player aims at a nearby block

- **GIVEN** the camera faces a solid block within 6 blocks
- **WHEN** `getTargetBlock` is called
- **THEN** the result SHALL identify the same block as the previous step-based implementation
- **AND** the algorithm SHALL step once per voxel boundary crossed, not per 0.05 world units

#### Scenario: Player aims at air

- **GIVEN** no solid block intersects the ray within max distance
- **WHEN** `getTargetBlock` is called
- **THEN** the function SHALL return `null` or `{ hit: false }` per existing API contract

### Requirement: Vector Reuse in Raycast

The raycast implementation SHALL avoid per-iteration `Vector3.clone()` allocations.

#### Scenario: Raycast runs every frame

- **GIVEN** the main game loop calls `getTargetBlock` once per frame
- **WHEN** the DDA traversal executes
- **THEN** working vectors SHALL be reused from module-level or function-scoped instances

## MODIFIED Requirements

### Requirement: Column Noise Cache During Generation

`generateChunk` SHALL compute per-column terrain metadata once per column.

#### Scenario: Chunk terrain is generated

- **GIVEN** a new chunk is being generated
- **WHEN** each column `(localX, localZ)` is processed
- **THEN** biome and terrain height SHALL be computed at most once per column
- **AND** tree placement, surface block, and subsurface fills SHALL reuse that cached metadata

## ADDED Requirements (Optional Phase)

### Requirement: Worker-Based Chunk Generation

When Workers are available, terrain generation MAY run off the main thread.

#### Scenario: Worker generates chunk data

- **GIVEN** `Worker` is supported
- **WHEN** a chunk enters the generation queue
- **THEN** the main thread SHALL post `{chunkX, chunkZ, seed}` to the worker
- **AND** the main thread SHALL remain responsive while generation is in flight

#### Scenario: Worker result is applied

- **GIVEN** the worker returns block data for a chunk
- **WHEN** the main thread receives the result
- **THEN** the chunk SHALL be inserted into `ChunkManager`
- **AND** `ChangesIndex.applyToChunk` SHALL run before mesh scheduling
- **AND** the chunk SHALL be marked dirty

#### Scenario: Worker unavailable

- **GIVEN** `Worker` is not supported
- **WHEN** a chunk needs generation
- **THEN** the engine SHALL fall back to main-thread `generateChunk`
