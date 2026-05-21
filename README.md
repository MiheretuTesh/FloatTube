# Universal Floating Video

Turn **any HTML5 video on any website** into a persistent, always-on-top
floating mini-player. Watch tutorials while you code, keep a lecture visible
while you work, or float a movie while you multitask — across tabs, browser
windows, applications and monitors.

Built as a cross-browser **Manifest V3** extension for Chrome, Edge, Brave,
Opera and Firefox.

---

## ✨ Features

| | |
|---|---|
| **Universal detection** | Finds every `<video>` on a page — including ones inside Shadow DOM, same-origin and cross-origin iframes, and content added later by single-page apps. |
| **One-click float** | A hover overlay button, the toolbar popup, or a keyboard shortcut pops any video into a floating Picture-in-Picture window. |
| **Survives everything** | The native PiP window stays visible across tab switches, window switches, fullscreen apps (VS Code, etc.) and multiple monitors. |
| **Auto pop-out** | Optionally float the playing video automatically when you switch away from its tab — and close it again when you return. |
| **Multi-video aware** | Pages with several videos are handled intelligently: the popup lists them all with title, progress and playback state, and you can cycle between them. |
| **Works everywhere** | YouTube, Vimeo, Twitch, Udemy, Coursera, generic streaming sites and embedded players. Netflix and other DRM players work wherever the browser permits. |
| **Lightweight** | No polling. Event-driven detection, debounced observers, a single shared overlay element, and lazy state reporting. |
| **Accessible** | Keyboard-operable controls, ARIA roles/labels, screen-reader friendly, and `forced-colors` / high-contrast support. |

---

## 🧱 Architecture

The extension is split into three runtimes that communicate over the
`runtime`/`tabs` messaging APIs:

```
┌──────────────┐   FRAME_VIDEOS    ┌────────────────┐   GET_STATE    ┌────────────┐
│ content      │ ────────────────► │ background      │ ◄───────────── │ popup      │
│ script       │ ◄──────────────── │ service worker  │ ─────────────► │ (React)    │
│ (every frame)│  TOGGLE_PIP etc.  │ (per-tab aggreg.)│   actions      │            │
└──────────────┘                   └────────────────┘                └────────────┘
```

* **Content script** (`src/content`) — runs in **every frame** of every page.
  Detects videos, draws the overlay button, drives Picture-in-Picture, handles
  auto-PiP, and reports its frame's videos to the background.
* **Background service worker** (`src/background`) — the message bus. It
  **aggregates videos across all frames of a tab** (this is how cross-origin
  iframe videos are supported — frames can't talk to each other, but each can
  talk to the background), routes keyboard commands to the right frame, and
  updates the toolbar badge.
* **Popup** (`src/popup`) — a React + TypeScript + Tailwind UI listing detected
  videos and exposing settings and shortcuts.

Key decisions are documented inline and in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

### Project structure

```
src/
├── background/      MV3 service worker — per-tab aggregator & message router
├── content/         injected scripts
│   ├── video-detector.ts   MutationObserver + shadow DOM + iframe scanning
│   ├── overlay.ts          single shared hover "pop out" button
│   ├── pip-controller.ts   Picture-in-Picture wrapper
│   ├── overlay.css         CSP-safe injected styles
│   └── index.ts            wiring, messaging, auto-PiP
├── popup/           React popup (components / hooks / store)
├── store/  …        Zustand settings store (in popup/store)
├── types/           shared cross-process type contracts
└── utils/           browser polyfill layer, storage, logger, DOM helpers
scripts/             build orchestrator, manifest + icon generators, packager
```

---

## 🌐 Browser compatibility strategy

* **Single codebase, two manifests.** `scripts/manifest.mjs` emits a
  Chromium manifest (`background.service_worker`) and a Firefox manifest
  (`background.scripts` + `browser_specific_settings`).
* **`webextension-polyfill`.** All extension API access goes through
  `src/utils/browser.ts`, which re-exports the polyfilled, promise-based
  `browser.*` namespace. No file touches `chrome.*` directly.
* **Graceful degradation.** Firefox does not expose a *scriptable*
  Picture-in-Picture API. The content script detects this
  (`isPipApiAvailable()`) and surfaces a clear message instead of throwing;
  Firefox users can still use Firefox's own built-in PiP toggle.

| Browser | Status | Notes |
|---|---|---|
| Chrome / Edge / Brave / Opera | ✅ Full support | MV3 service worker |
| Firefox | ⚠️ Partial | Detection, popup, settings & overlay work. Scriptable PiP is unavailable; see notes below. |

---

## 🚀 Installation (from source)

```bash
npm install
npm run build          # builds both dist/chrome and dist/firefox
```

### Load in Chrome / Edge / Brave / Opera

1. Open `chrome://extensions` (or `edge://`, `brave://`, `opera://`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the **`dist/chrome`** folder.

### Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select **`dist/firefox/manifest.json`**.
3. Open the extension's **Permissions** and grant *Access your data for all
   websites* — Firefox MV3 treats host permissions as opt-in.

---

## 🛠️ Development setup

```bash
npm install
npm run dev:chrome     # rebuilds dist/chrome on every change
# or
npm run dev:firefox
```

Then load the `dist/<browser>` folder as above. After a rebuild, click the
**reload** icon on the extension card (and reload the page under test so the
fresh content script is injected).

```bash
npm run typecheck      # strict TypeScript check, no emit
```

Useful scripts:

| Script | Purpose |
|---|---|
| `npm run build` | Production build for both browsers |
| `npm run build:chrome` / `build:firefox` | Single-browser production build |
| `npm run dev:chrome` / `dev:firefox` | Watch build for development |
| `npm run package` | Production build **+ store-ready `.zip`** for both browsers |
| `npm run typecheck` | Type-check the whole `src` tree |
| `npm run clean` | Remove `dist/` |

---

## 📦 Packaging for the stores

```bash
npm run package
```

This produces `dist/floattube-chrome-v<version>.zip` and
`dist/floattube-firefox-v<version>.zip`.

**Chrome Web Store** — upload `floattube-chrome-*.zip` at the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole). The
extension requests `storage` plus broad host access, which is required for a
*universal* video tool; the listing should explain this in the privacy
justification.

**Firefox Add-ons (AMO)** — upload `floattube-firefox-*.zip` at
[addons.mozilla.org/developers](https://addons.mozilla.org/developers/). The
add-on id is declared in `browser_specific_settings`. Mozilla also accepts the
source build instructions in this README for review.

> The same Chromium `.zip` works for the Microsoft Edge Add-ons store and the
> Opera add-ons catalogue without modification.

---

## ⌨️ Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+P` | Toggle the floating player |
| `Alt+Shift+O` | Exit the floating player |
| `Alt+Shift+N` | Float the next detected video |

Shortcuts are configurable at `chrome://extensions/shortcuts` (Chromium) or via
the add-on manager (Firefox). The popup links to the right page.

---

## ⚠️ Known limitations

* **Auto-PiP & user gestures.** Browsers require a recent user gesture to enter
  Picture-in-Picture. "Auto pop-out on tab switch" is therefore best-effort: it
  works when a gesture is still in scope and is silently skipped otherwise. Use
  the overlay button, popup or shortcut for a guaranteed pop-out.
* **Firefox PiP** is not scriptable — see the compatibility table.
* **DRM players** (Netflix, etc.) work only where the browser permits PiP on
  protected media; this varies by browser and title.
* Videos inside **closed** shadow roots cannot be discovered by any extension.

---

## 🧭 Roadmap (architecture-ready)

The codebase is intentionally modular so later versions can add: a custom
always-on-top player window, subtitle extraction, AI summaries, timestamp
bookmarks, note-taking, a playlist queue and audio enhancement — without
restructuring. See [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## License

MIT
