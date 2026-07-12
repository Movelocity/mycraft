# Game Engine Specification Delta

## ADDED Requirements

### Requirement: GameEngine Class Owns Runtime Loop

All per-frame game logic SHALL live in a `GameEngine` class separate from the React component tree.

#### Scenario: Canvas mounts

- **GIVEN** `MinecraftGame` receives a canvas element and optional load data
- **WHEN** the game starts
- **THEN** `GameEngine.init(canvas, loadData)` SHALL create the Three.js scene, player, chunk manager, and input state
- **AND** `GameEngine` SHALL own the `requestAnimationFrame` loop

#### Scenario: Each frame tick

- **GIVEN** the engine is running
- **WHEN** `GameEngine.tick(dt)` is called
- **THEN** it SHALL execute in order: player physics → camera sync → chunk update → mesh lifecycle → targeting raycast → highlight update → render
- **AND** React SHALL NOT participate in this loop

#### Scenario: Canvas unmounts

- **GIVEN** the player leaves gameplay
- **WHEN** the React cleanup runs
- **THEN** `GameEngine.dispose()` SHALL cancel RAF, dispose chunk meshes, and dispose the renderer

### Requirement: Read-Only Snapshot for HUD

The React layer SHALL read game state through an explicit snapshot or getter, not by mutating `gameRef` fields directly.

#### Scenario: HUD needs player flying state

- **GIVEN** the pause menu or HUD displays flight mode
- **WHEN** a discrete UI refresh is needed
- **THEN** the component SHALL read `engine.getSnapshot().flying` or receive it via callback on change only

### Requirement: Input Adapter Pattern

Desktop and mobile input handlers SHALL write into `GameEngine` input state without owning game logic.

#### Scenario: Desktop key press

- **GIVEN** the player presses `W`
- **WHEN** the keyboard handler fires
- **THEN** it SHALL set `engine.input.forward = true`
- **AND** it SHALL NOT call chunk or player functions directly

#### Scenario: Mobile joystick move

- **GIVEN** the floating joystick outputs normalized `(x, y)`
- **WHEN** touch moves
- **THEN** it SHALL write `engine.input.joystickX` and `engine.input.joystickY`
- **AND** the engine tick SHALL consume those values in `updatePlayer`

## MODIFIED Requirements

### Requirement: MinecraftGame Responsibility

`MinecraftGame.tsx` SHALL be a thin React shell.

#### Scenario: File responsibility split

- **GIVEN** the optimization is complete
- **WHEN** inspecting `MinecraftGame.tsx`
- **THEN** it SHALL contain canvas lifecycle, HUD components, pause/save UI, and input adapter wiring
- **AND** it SHALL NOT contain chunk mesh disposal logic, DDA raycast, or terrain generation

## REMOVED Requirements

### Requirement: Monolithic gameRef in MinecraftGame

**Reason:** A flat mutable ref couples React, Three.js, and all game logic in one component.

**Migration:** Replace with `GameEngine` instance stored in a ref (`engineRef`).
