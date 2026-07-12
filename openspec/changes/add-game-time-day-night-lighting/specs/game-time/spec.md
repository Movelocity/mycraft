# Game Time and Day-Night Specification Delta

## ADDED Requirements

### Requirement: GameTime Owns In-Game Time

The game SHALL use a dedicated `GameTime` module as the source of truth for in-game time.

#### Scenario: GameTime is created for a new world

- **GIVEN** no saved `worldTime` is provided
- **WHEN** `GameTime` is constructed
- **THEN** `worldTime` SHALL equal `DEFAULT_WORLD_TIME`
- **AND** `DEFAULT_WORLD_TIME` SHALL be `6000`

#### Scenario: GameTime is created from a save

- **GIVEN** a v3 save provides `worldTime`
- **WHEN** `GameEngine` starts
- **THEN** `GameTime` SHALL initialize from the saved value

#### Scenario: Frame tick advances time

- **GIVEN** daylight cycle is enabled
- **WHEN** `GameTime.update(dtSeconds)` is called
- **THEN** `worldTime` SHALL increase by `dtSeconds * TICKS_PER_SECOND`
- **AND** the initial `TICKS_PER_SECOND` value SHALL be `20`

#### Scenario: Day progress is requested

- **GIVEN** any finite non-negative `worldTime`
- **WHEN** derived time values are requested
- **THEN** `timeOfDay` SHALL equal `worldTime % 24000`
- **AND** `day` SHALL equal `Math.floor(worldTime / 24000)`
- **AND** `dayProgress` SHALL be normalized to `[0, 1)`

### Requirement: Day-Night Values Are Derived From worldTime

Sun, moon, sky color, light levels, and cloud offset SHALL be derived from `worldTime`.

#### Scenario: Noon lighting

- **GIVEN** `timeOfDay` is near `6000`
- **WHEN** lighting values are calculated
- **THEN** sun intensity SHALL be near its daytime maximum
- **AND** ambient brightness SHALL be bright enough for normal surface visibility

#### Scenario: Midnight lighting

- **GIVEN** `timeOfDay` is near `18000`
- **WHEN** lighting values are calculated
- **THEN** sun intensity SHALL be near its minimum
- **AND** moon or nighttime ambient light SHALL remain nonzero
- **AND** the world SHALL remain playable without requiring artificial UI brightness

#### Scenario: Moon position

- **GIVEN** a sun angle derived from `worldTime`
- **WHEN** the moon angle is calculated
- **THEN** the moon SHALL be offset from the sun by `Math.PI`

#### Scenario: Cloud drift

- **GIVEN** a saved `worldTime`
- **WHEN** the world is loaded
- **THEN** cloud offset SHALL be derived from `worldTime`
- **AND** cloud offset SHALL NOT require a persisted save field

### Requirement: SkySystem Consumes GameTime Snapshot

The renderer SHALL update sky visuals from a time snapshot rather than owning its own clock.

#### Scenario: Frame render

- **GIVEN** `GameEngine.tick(dt)` has advanced `GameTime`
- **WHEN** sky visuals update
- **THEN** sky color, sun position, moon position, cloud position, and light intensities SHALL be updated from the same `GameTime` snapshot

#### Scenario: Long-distance travel

- **GIVEN** the player moves far from origin
- **WHEN** the sky system updates
- **THEN** sun, moon, clouds, and sky geometry SHALL remain visually centered around the camera or player
- **AND** no sky boundary SHALL become visible

### Requirement: Air Brightness Baseline

Air blocks SHALL have a time-derived brightness value that can be used as the ambient light baseline for visible block faces.

#### Scenario: Bright daytime air

- **GIVEN** the time is daytime
- **WHEN** air brightness is requested
- **THEN** exposed air SHALL report a high brightness value

#### Scenario: Nighttime air

- **GIVEN** the time is nighttime
- **WHEN** air brightness is requested
- **THEN** exposed air SHALL report a lower brightness value
- **AND** the value SHALL remain above complete darkness

#### Scenario: Mesh lighting uses air brightness

- **GIVEN** a visible block face is adjacent to air
- **WHEN** that face is shaded
- **THEN** the face brightness MAY combine its existing face orientation brightness with the current air brightness
- **AND** smooth global day-night changes SHOULD prefer material or light updates over per-frame chunk mesh rebuilds

#### Scenario: Future light propagation

- **GIVEN** block-emitted light or sky-light propagation is added later
- **WHEN** the lighting model expands
- **THEN** the air brightness baseline SHALL remain compatible as the sky/ambient source term

## MODIFIED Requirements

### Requirement: Renderer Lighting Inputs

Renderer lighting SHALL be driven by game time instead of fixed startup-only values.

#### Scenario: Sun is created

- **GIVEN** the scene initializes
- **WHEN** directional, ambient, and hemisphere lights are created
- **THEN** their base objects MAY be created once
- **AND** their intensity/color SHALL be mutable through `SkySystem` or equivalent time-driven update logic

#### Scenario: Existing face brightness

- **GIVEN** chunk mesh vertex colors already encode orientation brightness
- **WHEN** day-night lighting is added
- **THEN** orientation brightness SHALL remain useful for top/side/bottom contrast
- **AND** time-derived ambient brightness SHALL layer on top of it without requiring a new block texture atlas
