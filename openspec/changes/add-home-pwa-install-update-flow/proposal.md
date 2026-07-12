# Change: Add Home-Only PWA Install and Manual Update Flow

## Why

The game should be installable as a PWA and should support controlled updates without interrupting active play. Installation and update actions must live on the home screen so the in-game experience, pointer lock, mobile controls, and pause menu remain focused on gameplay.

## What Changes

- Add PWA manifest and service worker support for installability and offline shell loading.
- Add a home-screen-only install button.
- Launch the installed app directly in fullscreen display mode.
- Provide an in-game exit button for fullscreen/app mode.
- Let `Esc` open an exit confirmation panel.
- Add a home-screen-only manual update check button.
- Apply updates only after the player explicitly checks for and confirms an available update from the home screen.

## Out of Scope

- No install prompt during gameplay.
- No install entry in the pause menu.
- No background update checking UI.
- No automatic update prompts while the player is in a world.
- No automatic reload when a new service worker is waiting.
- No save format compatibility or migration work.
- No save backup flow tied to PWA updates.

## User Experience

On the home screen, players can install the game if the browser supports PWA installation. Once installed, the app opens fullscreen and shows an explicit exit control. Pressing `Esc` opens an exit confirmation panel instead of immediately leaving the app/game.

Update checks are manual. The home screen contains a "检查更新" action. If an update exists, the player can choose to apply it. If no update exists, the UI reports that the current version is up to date. While playing, no update banner, toast, or modal appears.

## Risks

- Browser support for install prompts is inconsistent, so unsupported browsers need a simple manual-install fallback on the home screen.
- Fullscreen display behavior depends on platform PWA support; the app should still provide an exit action when fullscreen APIs are available.
- Manual-only updates mean players may stay on older versions until they return home and check.

