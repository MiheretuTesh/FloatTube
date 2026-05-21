# Architecture

This document explains the *why* behind the structure. The *what* is in the
source comments.

## Three runtimes, one message contract

A browser extension is not one program — it is three that share nothing but a
message channel. `src/types/index.ts` is the single source of truth for every
payload that crosses a process boundary, so the content script, background
worker and popup cannot drift apart silently.

```
content script  ──FRAME_VIDEOS──►  background  ◄──GET_STATE / actions──  popup
       ▲                               │
       └────────── TOGGLE_PIP / EXIT_PIP / FOCUS_NEXT ◄┘
```

## Why the background aggregates

A page is a tree of frames. A YouTube embed, a Vimeo player and a course
video can each live in their own **cross-origin iframe**, and the manifest
injects the content script into all of them (`all_frames: true`).

Frames cannot message siblings. They *can* all message the background. So the
background keeps a `tabId → frameId → videos` registry, and the popup asks the
background for one aggregated, de-duplicated list. Each video id is namespaced
`frameId::localId` so an action from the popup can be routed back to the exact
frame that owns the video.

The registry is a **soft cache**. MV3 may suspend the worker at any moment;
content scripts re-report on every relevant event, so a cold registry
self-heals within ~1 second. Navigation and tab-close events evict entries.

## Why detection is event-driven

The performance requirement rules out polling. Detection is:

* an initial scan + one post-`load` scan;
* a `MutationObserver` that triggers a **debounced** (350 ms) re-scan, and only
  when nodes were actually added/removed;
* recursive descent into open shadow roots and same-origin iframes.

The heaviest call is `querySelectorAll('*')` (needed to find shadow hosts);
debouncing keeps it off the hot path. Closed shadow roots are unreachable by
*any* extension and are accepted as a limitation.

## Why the overlay is one shared element

One `<button>` is reused for whichever video is hovered, instead of one node
per video. Page DOM footprint is constant regardless of video count. It is
`position: fixed` and re-anchored by a `requestAnimationFrame` loop that runs
**only while visible**. Styles ship via `content_scripts.css` so they bypass
the page's `style-src` CSP — an injected inline `<style>` would not.

## Why native Picture-in-Picture

The native PiP window is already OS-level always-on-top and survives tab,
window, application and monitor switches — which is exactly the product
requirement. Building a custom always-on-top window would need extra
permissions and platform-specific code for no user-visible gain *today*. The
`PipController` abstraction keeps that door open (see Extensibility).

## State management

The popup uses **Zustand** for settings only — a single flat object. Anything
heavier would be over-engineering. `storage.local` is the source of truth; the
content script subscribes to `storage.onChanged` and reconfigures live, so
editing a setting in the popup needs no reload.

## Security posture

* **Least privilege:** the only API permission is `storage`. Page access is
  `host_permissions` because a *universal* tool must run anywhere — there is no
  narrower honest option.
* **No `eval`, no remote code.** Everything is bundled at build time.
* **CSP-friendly:** overlay styling is delivered as a manifest CSS file; the
  only `innerHTML` use is a static, self-authored SVG on our own element.
* **No host page trust:** the overlay button resets inherited styles with
  `all: initial` so hostile page CSS cannot weaponise it.

## Extensibility roadmap

The seams are already cut for the advanced features:

| Future feature | Where it slots in |
|---|---|
| Custom always-on-top player | New implementation behind `PipController`'s interface; `documentPictureInPicture` API is the natural upgrade. |
| Subtitle extraction | `video-detector` already holds element refs — add a `TextTrack` reader module. |
| AI summaries / notes / bookmarks | New popup tab + a `store/` slice + background storage; the messaging union just gains variants. |
| Playlist queue / playback sync | Background already has a per-tab registry to coordinate from. |
| Multi-monitor placement | Lives entirely in a future custom-window module. |

Adding any of these is *additive*: a new message variant in `src/types`, a new
module, a new popup tab — no restructuring of the three-runtime core.
