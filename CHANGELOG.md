# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-11-11

### Added

- Built-in fullscreen & orientation-rotation protection (`protectFullscreen: true`
  by default, plus `setFullscreenGuard(active)` for CSS pseudo-fullscreen
  fallbacks such as iOS Safari). Wraps each ScrollTrigger instance's `revert()`
  and `refresh()` so GSAP (including its internal portrait/landscape
  `matchMedia` listener) never detaches/re-parents pinned sections while a video
  or `<iframe>` is fullscreen, preventing fullscreen exit and iframe reloads.
  Runs an automatic catch-up refresh after fullscreen exits if the viewport size
  changed.
- Expanded `README.md` with the two-phase sticky + pin mental model, the
  newspaper page-turn shadow CSS recipe, dynamic content `refresh()` guidance,
  and fullscreen protection documentation.

### Fixed

- `init()` now sizes the scroll-end spacer and settle buffers **before**
  creating `ScrollTrigger` instances so initial `end` clamping sees the true
  `documentElement.scrollHeight`.
- `refresh()` now recalculates synthetic settle buffers (`_insertBuffers()`) in
  addition to compact state and the end spacer.
- `_insertBuffers()` reuses existing `.stacked-scroll-buffer` DOM nodes across
  resizes instead of removing and recreating them on every resize.
- `_computeEnd()` now uses the stable viewport height (`_getViewportHeight()`)
  consistently.
- Mobile `visualViewport` resize events triggered purely by the browser URL bar
  showing/hiding (height change with identical `innerWidth`) now update the
  non-destructive spacer without forcing a full DOM-reparenting
  `ScrollTrigger.refresh()`.

## [1.0.2] - 2026-08-19

### Changed

- Added the rotyounges page-turn shadow to the demo header (`::before` gradient
  band with rounded top corners), replicating the exact overlapping-pages
  effect used on rotyounges.com.

## [1.0.1] - 2026-08-19

### Changed

- Unified intro copy across README, package description, type definitions,
  and demo to describe the effect as sections that become a stack of pages
  with pinned headers.

## [1.0.0] - 2026-08-18

First stable release, extracted and hardened from the production scroll
implementation on [rotyounges.com](https://rotyounges.com).

### Added

- `StackedScroll` class with GSAP ScrollTrigger-based pinning of full-viewport
  sections (`pinSpacing: false`, height-aware `start` rules).
- Deep-link-safe `scrollTo()` that avoids the `offsetTop`/`offsetParent` trap
  caused by `position: fixed` pinned panels — targets are computed from summed
  natural section heights plus a same-tick `getBoundingClientRect()` delta.
- Automatic end-spacer so a last section shorter than the viewport can still
  scroll flush to the top.
- Pin-end clamping so the previous panel always releases on the final
  transition (headers never overlap at the bottom of the page).
- Synthetic settle buffers between consecutive short sections
  (`viewportHeight - sectionHeight`) so two adjacent short panels hand off
  cleanly without their pin windows overlapping. Recalculated on resize and
  orientation change, removed on `destroy()`.
- Compact-mode support: `hideHeadersBelow` + `compactClassName` collapses
  section headers below a viewport-height threshold.
- `refresh()` for recalculating geometry after dynamic content changes, and
  `destroy()` for full teardown.
- `prefers-reduced-motion` support — smooth scrolling falls back to instant
  jumps when the user prefers reduced motion.
- Mobile `visualViewport` handling for stable measurements when the URL bar
  shows/hides.
- Playwright e2e suite (10 tests) covering deep links, the short last panel,
  the final transition, hamburger navigation, resize behavior, and the
  adjacent-short-panels regression.

### Known constraints

- The settle buffer fixes the scroll handoff between adjacent short panels,
  but a panel genuinely shorter than the viewport does not physically fill
  the screen while pinned — the previous section can show through the gap.
  Keep panels at `min-height: 100vh` (as the demo does) and this never
  comes up.
