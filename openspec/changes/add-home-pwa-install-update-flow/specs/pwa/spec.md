# PWA Specification Delta

## ADDED Requirements

### Requirement: Home-Screen PWA Installation

The application SHALL expose PWA installation only from the home screen.

#### Scenario: Supported browser shows install action

- **GIVEN** the browser fires `beforeinstallprompt`
- **AND** the player is on the home screen
- **WHEN** the install prompt is available
- **THEN** the home screen SHALL show an install button
- **AND** the application SHALL NOT show the install button in gameplay UI
- **AND** the application SHALL NOT show the install button in the pause menu

#### Scenario: Player starts installation

- **GIVEN** the install button is visible on the home screen
- **WHEN** the player clicks the install button
- **THEN** the application SHALL call the saved install prompt
- **AND** the browser SHALL decide whether installation succeeds or is dismissed

#### Scenario: App is already installed

- **GIVEN** the application is running in installed display mode
- **WHEN** the home screen is shown
- **THEN** the install button SHALL be hidden

#### Scenario: Browser does not support install prompt

- **GIVEN** the browser does not provide `beforeinstallprompt`
- **AND** the player is on the home screen
- **WHEN** the app is not running in installed display mode
- **THEN** the home screen MAY show a manual installation hint
- **AND** gameplay UI SHALL NOT show any installation hint
- **AND** the pause menu SHALL NOT show any installation hint

### Requirement: Fullscreen Installed Experience

The installed PWA SHALL launch directly into fullscreen display mode where supported.

#### Scenario: Installed app launches

- **GIVEN** the player has installed the PWA
- **WHEN** the player opens the installed app
- **THEN** the app SHALL request fullscreen-style display through the manifest
- **AND** the game SHALL remain usable if the platform falls back to another installed display mode

#### Scenario: Exit button is available during gameplay

- **GIVEN** the player is in gameplay
- **WHEN** fullscreen or installed app mode is active
- **THEN** the gameplay UI SHALL provide an exit button

### Requirement: Exit Confirmation

The application SHALL confirm before leaving gameplay or fullscreen/app mode.

#### Scenario: Player clicks exit button

- **GIVEN** the player is in gameplay
- **WHEN** the player clicks the exit button
- **THEN** the game SHALL open an exit confirmation panel
- **AND** gameplay SHALL wait for the player's choice

#### Scenario: Player presses Esc

- **GIVEN** the player is in gameplay
- **WHEN** the player presses `Esc`
- **THEN** the game SHALL open the exit confirmation panel

#### Scenario: Player confirms exit

- **GIVEN** the exit confirmation panel is open
- **WHEN** the player confirms exit
- **THEN** the game SHALL return to the home screen
- **AND** the app SHALL exit fullscreen when the Fullscreen API allows it

#### Scenario: Player cancels exit

- **GIVEN** the exit confirmation panel is open
- **WHEN** the player cancels
- **THEN** the panel SHALL close
- **AND** the player SHALL remain in the previous gameplay state

### Requirement: Manual Home-Screen Update Check

The application SHALL check for PWA updates only after an explicit player action on the home screen.

#### Scenario: Home screen shows update check

- **GIVEN** the player is on the home screen
- **WHEN** service workers are supported
- **THEN** the home screen SHALL show a manual update check action

#### Scenario: Gameplay does not check for updates

- **GIVEN** the player is in gameplay
- **WHEN** a new service worker version may exist
- **THEN** the game SHALL NOT automatically check for updates
- **AND** the game SHALL NOT show update banners, toasts, or modals

#### Scenario: Pause menu does not check for updates

- **GIVEN** the pause menu is open
- **WHEN** a new service worker version may exist
- **THEN** the pause menu SHALL NOT show update controls
- **AND** the pause menu SHALL NOT trigger an update check

#### Scenario: Player manually checks and no update exists

- **GIVEN** the player is on the home screen
- **WHEN** the player clicks "检查更新"
- **AND** no waiting service worker is available after the update check completes
- **THEN** the home screen SHALL report that the app is already up to date

#### Scenario: Player manually checks and an update exists

- **GIVEN** the player is on the home screen
- **WHEN** the player clicks "检查更新"
- **AND** a waiting service worker becomes available
- **THEN** the home screen SHALL show an apply-update confirmation action
- **AND** the app SHALL NOT apply the update until the player confirms

#### Scenario: Player applies update

- **GIVEN** an update is waiting
- **AND** the player is on the home screen
- **WHEN** the player confirms applying the update
- **THEN** the app SHALL send `SKIP_WAITING` to the waiting service worker
- **AND** the app SHALL reload after `controllerchange`

### Requirement: No Save Compatibility Work

The PWA install and update flow SHALL NOT introduce save format compatibility or migration behavior.

#### Scenario: PWA update implementation changes

- **GIVEN** the PWA install or update flow is implemented
- **WHEN** the change is delivered
- **THEN** existing save data structures SHALL remain unchanged
- **AND** no save migration SHALL be added as part of this change

