# Hotstar Playback Speed Controller

A lightweight, zero-dependency **Manifest V3** browser extension for **Hotstar** (`*.hotstar.com`) and **JioHotstar** (`*.jiohotstar.com`) that adds YouTube-style playback speed controls (`0.25x` – `4.0x`), customizable keyboard shortcuts, an in-player floating control pill, and persistent speed enforcement across episodes and stream changes.

---

## Features

- **YouTube-Style In-Player Controls**
  - Floating dark-glass pill (`−` / `1.0x` / `+`) rendered inside an isolated **Shadow DOM** overlay so site styles never conflict.
  - Click the speed badge to open a quick popover with **12 presets** (`0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`, `2.5x`, `3.0x`, `3.5x`, `4.0x`), a fine-grained slider (`0.05x` increments), and a one-click `Reset 1.0x` action.
  - Configurable overlay corner (`Top Right`, `Top Left`, `Bottom Right`, `Bottom Left`) and optional auto-hide after inactivity.
- **Full Fullscreen Support**
  - Listens for `fullscreenchange` / `webkitfullscreenchange` and reparents the Shadow DOM host directly inside `document.fullscreenElement` so controls and toasts stay visible in fullscreen mode.
- **Persistent Speed Enforcement**
  - Streaming players frequently reset `video.playbackRate` back to `1.0` on episode transitions, quality/audio changes, or dynamic source swaps.
  - `SpeedEngine` monitors `ratechange`, `play`, `playing`, `loadedmetadata`, `canplay`, DOM mutations, and a 1-second playback heartbeat to keep your chosen speed locked in (with built-in loop protection).
  - Smart primary-video scoring ignores tiny muted hover-preview thumbnails on browse pages and prioritizes active playback or fullscreen elements.
- **YouTube & Custom Keyboard Shortcuts**
  - Supports YouTube-style `Shift + >` / `Shift + <` as well as customizable single-key hotkeys.
  - Automatically suppresses shortcuts while typing inside `<input>`, `<textarea>`, `<select>`, or `contentEditable` elements (such as search bars), or when `Ctrl` / `Cmd` / `Alt` modifiers are held.
  - Displays a brief centered OSD speed toast (`▶▶ 1.5x`) when adjusting speed via keyboard or popup.
- **Extension Popup & Synced Settings**
  - Live speed readout, `−` / `+` step buttons, slider, preset grid, and connection status badge (`Connected to player`, `Hotstar open (no video)`, `Refresh Hotstar tab`, or `Open hotstar.com to control`).
  - Settings sync across devices via `chrome.storage.sync` (with automatic fallback to `chrome.storage.local`).

---

## Default Keyboard Shortcuts

| Action | Default Shortcut | Notes |
| --- | --- | --- |
| Increase speed | `]` or `Shift + .` (`>`) | Steps up by configured Step Size (`0.25x` default) |
| Decrease speed | `[` or `Shift + ,` (`<`) | Steps down by configured Step Size (`0.25x` default) |
| Reset / Toggle `1.0x` | `\` | Pressing at custom speed resets to `1.0x`; pressing again restores your last custom speed |

> All primary hotkeys (`Increase`, `Decrease`, `Reset / Toggle 1.0x`) can be rebound in the extension popup under **Preferences & Shortcuts**.

---

## Installation (Chrome / Edge / Brave / Arc)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/navneetsn18/hotstar-playback-speed-controller.git
   ```
2. Open your Chromium-based browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
3. Toggle **Developer mode** ON (top-right corner).
4. Click **Load unpacked** and select the cloned `hotstar-playback-speed-controller` folder.
5. Open or refresh [`hotstar.com`](https://www.hotstar.com) or [`jiohotstar.com`](https://www.jiohotstar.com) and start watching any video.

---

## Configurable Settings

Open the extension popup from your browser toolbar and expand **Preferences & Shortcuts**:

- **Master Toggle**: Enable or disable speed enforcement and player overlay without uninstalling.
- **Step Size**: `0.05x`, `0.1x`, `0.25x` (default), or `0.5x`.
- **Overlay Corner**: `Top Right` (default), `Top Left`, `Bottom Right`, or `Bottom Left`.
- **Show on-player controls**: Toggle the floating pill/menu while keeping keyboard shortcuts and popup control active.
- **Auto-hide player controls**: Fade out the floating pill after ~2.6s of pointer inactivity.
- **Show speed toast HUD**: Toggle the centered on-screen speed indicator.
- **Remember speed across videos**: Persist your selected speed across episodes and new sessions.
- **Preserve audio pitch**: Keep voices natural (`video.preservesPitch = true`) at higher or lower speeds.
- **Keyboard shortcuts & YouTube keys**: Toggle hotkeys or customize individual key bindings.

---

## Project Structure

```text
.
├── manifest.json                 # Chrome Extension Manifest V3 configuration
├── package.json                  # Project metadata & test runner script
├── assets/
│   └── icons/                    # Extension icons (16, 32, 48, 128 PNG + SVG)
├── src/
│   ├── shared/
│   │   └── constants.js          # Speed math, presets, settings normalization, shortcut matcher, storage helpers
│   ├── content/
│   │   ├── speed-engine.js       # Video discovery, primary-video scoring, rate enforcement
│   │   ├── player-ui.js          # Shadow DOM floating pill, preset menu, toast HUD, fullscreen reparenting
│   │   ├── overlay.css           # Host container reset styles
│   │   └── content.js            # Content script coordinator, shortcut handler, runtime message bridge
│   └── popup/
│       ├── popup.html            # Toolbar popup markup
│       ├── popup.css             # Dark-theme popup styles
│       └── popup.js              # Popup state management, live tab sync, keybind recorder
└── tests/
    ├── dom-mock.js               # Lightweight DOM & HTMLVideoElement mocks
    ├── constants.test.js         # Speed clamping, rounding, settings, URL & shortcut tests
    ├── speed-engine.test.js      # Video scoring, rate-reset enforcement & capture detection tests
    ├── controller.test.js        # Shadow DOM mount, fullscreen reparenting, shortcut & messaging tests
    └── manifest.test.js          # MV3 manifest, asset presence, PNG & JS syntax validation
```

---

## Development & Testing

No build step or external dependencies are required—source files load directly into Chromium browsers.

Run the automated test suite (requires Node.js):

```bash
npm test
```

---

## Disclaimer

This extension is an independent open-source utility for personal playback convenience and is not affiliated with, endorsed by, or associated with Disney+ Hotstar or JioHotstar.
