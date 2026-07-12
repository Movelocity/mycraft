# Save System Specification Delta

## ADDED Requirements

### Requirement: Save Format v3 Stores World Time

The application SHALL persist games exclusively in Save Format v3, and v3 SHALL include the world's current in-game time.

#### Scenario: New game is saved

- **GIVEN** the player saves a game to a slot
- **WHEN** `saveGame` writes to IndexedDB
- **THEN** the stored record SHALL have `version: 3`
- **AND** `world.worldTime` SHALL be written as a finite non-negative number
- **AND** `world.seed` and `world.changesByChunk` SHALL remain part of the world payload

#### Scenario: Game is loaded

- **GIVEN** a v3 save exists in the slot
- **WHEN** `loadGame` and `restoreFromSave` run
- **THEN** the restored game load data SHALL include `worldTime`
- **AND** `GameEngine` SHALL initialize `GameTime` from that value

### Requirement: New Worlds Default to Daytime

New worlds SHALL start at the default daytime value.

#### Scenario: Empty slot starts a new game

- **GIVEN** the player selects an empty slot
- **WHEN** the game starts without saved `worldTime`
- **THEN** `GameTime` SHALL initialize to `DEFAULT_WORLD_TIME`
- **AND** `DEFAULT_WORLD_TIME` SHALL be `6000`

### Requirement: Unsupported Save Versions Are Rejected Explicitly

The application SHALL NOT migrate or silently load save versions other than v3.

#### Scenario: Old save exists

- **GIVEN** a slot contains a save with `version` other than `3`
- **WHEN** the player attempts to load that slot
- **THEN** loading SHALL fail with an unsupported-version result
- **AND** the home screen SHALL inform the player that the slot must be deleted and recreated
- **AND** the game SHALL NOT start from that save data

#### Scenario: Corrupt save exists

- **GIVEN** a slot contains unreadable, invalid, or corrupt save data
- **WHEN** the player attempts to load that slot
- **THEN** loading SHALL fail safely
- **AND** the home screen SHALL offer deletion or recreation instead of crashing

## MODIFIED Requirements

### Requirement: Save Extraction Includes Engine Time

Save extraction SHALL read in-game time from `GameEngine` / `GameTime`, not from wall-clock time.

#### Scenario: Manual save

- **GIVEN** the game has advanced to `worldTime = 9000`
- **WHEN** the player presses the manual save key
- **THEN** the saved payload SHALL include `world.worldTime = 9000`
- **AND** the existing `timestamp` field SHALL remain a real-world save timestamp only

#### Scenario: Auto-save

- **GIVEN** an auto-save is triggered after block edits
- **WHEN** the save data is extracted
- **THEN** `world.worldTime` SHALL match the current in-game time at extraction

## REMOVED Requirements

### Requirement: Save Format v2 Only

**Reason:** v3 replaces v2 by adding persistent world time.

**Migration:** No migration is required. v2 saves are unsupported and should prompt deletion/recreation.
