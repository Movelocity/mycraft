# Rendering Specification Delta

## ADDED Requirements

### Requirement: Shared Chunk Materials

All chunk meshes SHALL reuse global material instances instead of creating per-chunk materials.

#### Scenario: Chunk mesh is built

- **GIVEN** a chunk requires opaque and/or transparent geometry
- **WHEN** `buildChunkMesh` completes
- **THEN** opaque faces SHALL use the shared opaque `MeshLambertMaterial`
- **AND** transparent faces SHALL use the shared transparent `MeshLambertMaterial`
- **AND** only `BufferGeometry` instances SHALL be newly allocated per chunk

#### Scenario: Chunk mesh is disposed

- **GIVEN** a chunk mesh group is being destroyed
- **WHEN** geometries are disposed
- **THEN** shared materials SHALL remain alive for subsequent chunk builds

### Requirement: Typed-Array Mesh Buffers

Chunk mesh construction SHALL use pre-sized typed arrays instead of unbounded `number[]` push growth.

#### Scenario: Building a chunk with known block count

- **GIVEN** a chunk has `N` non-air blocks
- **WHEN** `buildChunkMesh` allocates vertex buffers
- **THEN** position, UV, color, and index buffers SHALL use `Float32Array` / `Uint32Array` (or `BufferAttribute` equivalents)
- **AND** buffer capacity SHALL be estimated from `N` to avoid repeated resizing

### Requirement: Per-Frame Mesh Rebuild Budget

The engine SHALL limit how many dirty chunk meshes are rebuilt in a single frame.

#### Scenario: Many chunks become dirty at once

- **GIVEN** more than `MAX_REBUILDS_PER_FRAME` chunks are dirty (default: 2)
- **WHEN** the frame tick runs
- **THEN** at most `MAX_REBUILDS_PER_FRAME` meshes SHALL be rebuilt
- **AND** remaining dirty chunks SHALL stay queued for subsequent frames

#### Scenario: Player places a single block

- **GIVEN** one block change marks at most two chunks dirty (owner + border)
- **WHEN** the next frame tick runs
- **THEN** affected meshes SHALL be rebuilt within the budget without visible lag

### Requirement: No Vertex Normal Computation for Axis-Aligned Chunks

Chunk mesh geometry SHALL NOT call `computeVertexNormals()` for cube faces.

#### Scenario: Chunk mesh geometry is finalized

- **GIVEN** vertex positions and indices are set on `BufferGeometry`
- **WHEN** the mesh is added to the scene
- **THEN** `computeVertexNormals()` SHALL NOT be invoked
- **AND** face brightness SHALL continue to use per-face `FACE_BRIGHTNESS` vertex colors

## MODIFIED Requirements

### Requirement: Chunk Mesh Ownership

Each `Chunk` SHALL optionally hold a reference to its render group.

#### Scenario: Chunk mesh is created

- **GIVEN** a chunk enters render distance or becomes dirty
- **WHEN** a new mesh group is built
- **THEN** `chunk.meshGroup` SHALL reference that `THREE.Group`
- **AND** the group name SHALL remain `chunk_{x}_{z}`

## REMOVED Requirements

### Requirement: buildWorldMesh for Global World Map

**Reason:** Replaced by per-chunk `buildChunkMesh` exclusively.

**Migration:** Delete `buildWorldMesh` and `WorldData` type usage from `renderer.ts`.

## ADDED Requirements (Optional Phase)

### Requirement: Greedy Meshing

When enabled, the mesh builder SHALL merge adjacent coplanar faces of the same block type within a chunk.

#### Scenario: Flat grass surface in a chunk

- **GIVEN** greedy meshing is enabled
- **AND** a horizontal run of grass blocks shares the same exposed top face
- **WHEN** the chunk mesh is built
- **THEN** the merged mesh SHALL use fewer vertices than naive per-block face emission
- **AND** cross-chunk neighbor culling rules SHALL remain correct
