# Tasks

## 1. Save v3 Foundation

- [ ] 1.1 Define `SaveDataV3` with `version: 3` and `world.worldTime: number`.
- [ ] 1.2 Remove v2 load compatibility from the active load path.
- [ ] 1.3 Make `loadGame` return an explicit unsupported-version result for non-v3 saves instead of silently returning `null`.
- [ ] 1.4 Update the home screen to show a delete/recreate prompt when a slot contains an unsupported save version.
- [ ] 1.5 Update `extractSaveData` to include `engine.gameTime.worldTime`.
- [ ] 1.6 Update `restoreFromSave` to return `worldTime`.

## 2. GameTime Module

- [ ] 2.1 Add `client/src/lib/minecraft/time.ts`.
- [ ] 2.2 Export constants: `TICKS_PER_DAY = 24000`, `DEFAULT_WORLD_TIME = 6000`, and initial `TICKS_PER_SECOND = 20`.
- [ ] 2.3 Implement `GameTime` with constructor `{ worldTime?, doDaylightCycle? }`.
- [ ] 2.4 Implement `update(dtSeconds)` to advance `worldTime` only when daylight cycle is enabled.
- [ ] 2.5 Implement derived getters or snapshot: day, timeOfDay, dayProgress, sunAngle, moonAngle, lightLevel, skyColor, ambientColor, directionalLightIntensity, cloudOffset.
- [ ] 2.6 Add unit-style deterministic checks for time wrapping and default daytime.

## 3. Engine Integration

- [ ] 3.1 Add `worldTime?: number` to `GameLoadData`.
- [ ] 3.2 Instantiate `GameTime` in `GameEngine` using loaded `worldTime` or `DEFAULT_WORLD_TIME`.
- [ ] 3.3 Advance `GameTime` from `GameEngine.tick(dt)`.
- [ ] 3.4 Expose current `worldTime` in `GameEngine.getSnapshot()` or a dedicated getter for save extraction.
- [ ] 3.5 Ensure pause behavior is intentional: either time continues while paused or pauses with simulation, and document the chosen behavior in code comments or spec follow-up.

## 4. Sky System

- [ ] 4.1 Add a sky module or extend renderer exports with a `SkySystem` object.
- [ ] 4.2 Generate procedural pixel textures for sun and moon with `CanvasTexture` and nearest filtering.
- [ ] 4.3 Render sun and moon as camera-facing planes or sprites positioned on opposite sides of the same sky orbit.
- [ ] 4.4 Derive sun/moon position from `GameTime` each frame.
- [ ] 4.5 Derive cloud drift from `worldTime` instead of saving cloud state.
- [ ] 4.6 Keep sky objects centered around the player/camera so long-distance movement does not reveal the sky geometry boundary.

## 5. Ambient and Air Light

- [ ] 5.1 Define an air brightness scale for daylight, dusk/dawn, and night.
- [ ] 5.2 Add a lightweight way for visible block faces to receive time-derived ambient brightness without forcing every chunk mesh to rebuild every frame.
- [ ] 5.3 Use global material/light changes for smooth transitions where possible.
- [ ] 5.4 If per-vertex light values are quantized, throttle dirty chunk rebuilds and reuse the existing mesh rebuild budget.
- [ ] 5.5 Leave interfaces open for future block-emitted light and sky-light propagation, but do not implement them in this change.

## 6. Verification

- [ ] 6.1 New game starts during daytime.
- [ ] 6.2 Manual save/load preserves `worldTime`.
- [ ] 6.3 Unsupported v1/v2 save shows a delete/recreate message and does not crash.
- [ ] 6.4 Sun and moon positions are deterministic for the same `worldTime`.
- [ ] 6.5 Clouds continue from the saved time without persisted cloud state.
- [ ] 6.6 Night remains playable with nonzero ambient light.
- [ ] 6.7 `pnpm check` passes.
- [ ] 6.8 `pnpm build` succeeds.
