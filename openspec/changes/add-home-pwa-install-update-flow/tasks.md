# Tasks

## 1. PWA Foundation

- [x] 1.1 Add `manifest.webmanifest` with app name, short name, start URL, scope, fullscreen display, landscape orientation, theme/background colors, and required icons.
- [x] 1.2 Add app icons, including maskable 192px and 512px variants.
- [x] 1.3 Register a service worker from the client entry point only in production-compatible browser contexts.
- [x] 1.4 Cache the app shell and hashed static assets.

## 2. Home-Screen Install Flow

- [x] 2.1 Capture `beforeinstallprompt` when supported and expose install availability to the home screen.
- [x] 2.2 Add an install button only on the home screen.
- [x] 2.3 Trigger the browser install prompt only after the player clicks the home-screen install button.
- [x] 2.4 Hide the install button when the app is already installed or running outside browser display mode.
- [x] 2.5 Show a home-screen manual-install hint when automatic install prompting is unavailable.

## 3. Fullscreen App Exit Flow

- [x] 3.1 Configure installed launch mode to fullscreen.
- [x] 3.2 Add an in-game exit button that opens an exit confirmation panel.
- [x] 3.3 Make `Esc` open the same exit confirmation panel.
- [x] 3.4 Confirming exit returns the player to the home screen and exits fullscreen when supported.
- [x] 3.5 Canceling exit closes the panel and resumes the previous state.

## 4. Manual Update Flow

- [x] 4.1 Add a "检查更新" button only on the home screen.
- [x] 4.2 On click, call the service worker registration update check.
- [x] 4.3 If no update is available, show a non-blocking "已是最新版本" result on the home screen.
- [x] 4.4 If an update is available and waiting, show a home-screen confirmation action to apply it.
- [x] 4.5 Apply the update only after confirmation by sending `SKIP_WAITING` to the waiting service worker.
- [x] 4.6 Reload the page after `controllerchange`.

## 5. Verification

- [ ] 5.1 Verify first-time install from the home screen.
- [ ] 5.2 Verify no install prompt or install button appears during gameplay or in the pause menu.
- [ ] 5.3 Verify installed app launches fullscreen.
- [ ] 5.4 Verify exit button opens confirmation and can exit fullscreen.
- [ ] 5.5 Verify `Esc` opens the same exit confirmation panel.
- [ ] 5.6 Verify update checking is not automatic and only runs from the home screen button.
- [ ] 5.7 Verify an available update can be applied manually from the home screen.
- [ ] 5.8 Verify no save migration or compatibility behavior is added.
