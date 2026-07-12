# React Boundary Specification Delta

## ADDED Requirements

### Requirement: Debug Overlay Uses Ref-Based Updates

The debug HUD SHALL NOT trigger React re-renders on every animation frame.

#### Scenario: Player moves continuously

- **GIVEN** the debug overlay is visible
- **WHEN** the game loop updates player coordinates and FPS
- **THEN** the overlay SHALL update DOM text via refs
- **AND** `MinecraftGame` SHALL NOT call `setState` for debug fields each frame

#### Scenario: Debug overlay is hidden

- **GIVEN** the debug overlay is toggled off
- **WHEN** the game loop runs
- **THEN** no debug DOM updates are required
- **AND** no React state related to debug info is updated

### Requirement: Debug Overlay Toggle

The debug overlay SHALL be off by default and toggled by the player.

#### Scenario: Player presses H

- **GIVEN** the player is in gameplay on desktop
- **WHEN** the player presses `H`
- **THEN** the debug overlay visibility SHALL toggle
- **AND** the preference MAY persist for the browser session via `sessionStorage`

### Requirement: Mobile Joystick Without Per-Touch React Updates

The floating joystick visual SHALL update without React state on every `touchmove`.

#### Scenario: Player drags the joystick

- **GIVEN** a touch is active on the left half of the screen
- **WHEN** `touchmove` events fire at high frequency
- **THEN** knob position SHALL update via DOM ref and CSS `transform`
- **AND** movement input SHALL still be written to `InputState` immediately
- **AND** `FloatingJoystick` SHALL NOT call `setState` on each `touchmove`

### Requirement: Break Progress Without React Render Propagation

Block break progress on mobile SHALL be rendered without bubbling state to parent components each frame.

#### Scenario: Player long-presses to break a block

- **GIVEN** a valid break target exists
- **WHEN** break progress advances in the game loop
- **THEN** the progress ring SHALL update via ref or CSS variable
- **AND** `MinecraftGame` SHALL NOT receive per-frame `setBreakProgress` updates

#### Scenario: Break progress ring styling

- **GIVEN** the break progress ring is visible
- **WHEN** it renders on mobile
- **THEN** it SHALL NOT use `backdrop-filter` for inversion
- **AND** it SHALL use an SVG stroke, border, or solid overlay suitable for mobile GPUs

### Requirement: Single Game Loop Owns Break Progress

Mobile block breaking SHALL be advanced in the main `GameEngine` tick, not a parallel `requestAnimationFrame`.

#### Scenario: Long-press break is active

- **GIVEN** mobile break input is engaged
- **WHEN** each frame tick runs
- **THEN** `GameEngine` SHALL evaluate break target, progress, and completion
- **AND** `useMobileControls` SHALL NOT run a separate animation loop for breaking

## MODIFIED Requirements

### Requirement: React State Scope in MinecraftGame

`MinecraftGame` React state SHALL be limited to discrete UI events.

#### Scenario: Continuous gameplay values

- **GIVEN** values change every frame (position, FPS, break progress, joystick knob)
- **WHEN** the game is running
- **THEN** those values SHALL live in `GameEngine` or DOM refs
- **AND** React state SHALL NOT mirror them

#### Scenario: Discrete gameplay events

- **GIVEN** underwater state changes, pause toggles, save notifications, or hotbar selection changes
- **WHEN** the event occurs
- **THEN** React state updates are permitted

## REMOVED Requirements

### Requirement: debugInfo React State

**Reason:** Per-frame `setDebugInfo` forces full component re-renders.

**Migration:** Replace with `DebugOverlay` ref-driven component.
