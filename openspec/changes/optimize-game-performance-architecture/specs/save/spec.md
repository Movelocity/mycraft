# Save System Specification Delta

## ADDED Requirements

### Requirement: Save Format v2 Only

The application SHALL persist games exclusively in Save Format v2.

#### Scenario: New game is saved

- **GIVEN** the player saves a game to a slot
- **WHEN** `saveGame` writes to IndexedDB
- **THEN** the stored record SHALL have `version: 2`
- **AND** block changes SHALL be stored as `changesByChunk: Record<string, [lx, ly, lz, BlockType][]>`
- **AND** world coordinates in each entry SHALL be chunk-local (0–15 for x/z)

#### Scenario: Game is loaded

- **GIVEN** a v2 save exists in the slot
- **WHEN** `loadGame` is called
- **THEN** the loader SHALL decompress and parse the v2 payload
- **AND** `ChangesIndex` SHALL be populated from `changesByChunk`
- **AND** player pose and hotbar state SHALL be restored

### Requirement: Gzip Compression for Save Blobs

Save payloads SHALL be gzip-compressed before IndexedDB storage.

#### Scenario: Save with many block changes

- **GIVEN** the player has made hundreds of block edits
- **WHEN** the save is written
- **THEN** the serialized bytes SHALL be compressed with `pako` gzip
- **AND** load SHALL decompress before JSON parse

### Requirement: IndexedDB Connection Reuse

The save module SHALL reuse a database connection across operations within a session.

#### Scenario: Multiple saves in one session

- **GIVEN** the player triggers manual save and auto-save in the same session
- **WHEN** each save operation runs
- **THEN** the module SHALL NOT open and close a new IDB connection for every call
- **AND** a shared connection promise or singleton SHALL be used

## REMOVED Requirements

### Requirement: Save Format v1

**Reason:** v1 flat `changes[]` and `radius` field are replaced; no migration is required.

**Migration:** Old saves are ignored. Slots containing v1 data are treated as empty or cleared on first v2 write.

### Requirement: World Radius in Save Data

**Reason:** Chunk streaming replaced fixed-radius world generation.

**Migration:** Remove `radius` from `SaveData`, `extractSaveData`, and `Home.tsx` load paths.

## MODIFIED Requirements

### Requirement: Changes Tracked Per Chunk

Runtime and persisted changes SHALL use the same per-chunk bucket structure.

#### Scenario: Player places a block

- **GIVEN** the player places a block at world `(x, y, z)`
- **WHEN** the change is recorded
- **THEN** `ChangesIndex` SHALL store it under the chunk key for `(x, z)` using local coordinates
- **AND** `extractSaveData` SHALL serialize `ChangesIndex` directly to `changesByChunk`
