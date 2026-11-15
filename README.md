# stacked-scroll

[![npm version](https://img.shields.io/npm/v/stacked-scroll.svg)](https://www.npmjs.com/package/stacked-scroll)
[![E2E Tests](https://github.com/dvdgiesen/stacked-scroll/actions/workflows/test.yml/badge.svg)](https://github.com/dvdgiesen/stacked-scroll/actions/workflows/test.yml)
[![GSAP Peer Dependency](https://img.shields.io/badge/GSAP-%5E3.13.0-88CE02)](https://gsap.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A small, hardened library that turns your sections into a physical stack of pages: each header stays pinned while you read, then hands off cleanly to the next page as it slides in (`bottom-up`, `from-right`, or `from-left`).

Built 100% idiomatically on top of **[GSAP 3.13+ (`ScrollTrigger` + `Observer`)](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)**.

**[Live Interactive Demo & Feature Playground →](https://dvdgiesen.github.io/stacked-scroll/)** · **[Production Site (`rotyounges.com`) →](https://rotyounges.com)** · **[npm Package →](https://www.npmjs.com/package/stacked-scroll)**

---

## Why We Built & Shared This

When building the editorial website **[rotyounges.com](https://rotyounges.com)**, we wanted a signature tactile effect seen on award-winning agency and editorial sites: **full-viewport sections that behave like a stack of physical newspaper pages**. While you read a long article, its section header stays pinned to the top of the screen; the moment you finish reading that section, the entire section freezes in place and the next section slides over it like a fresh sheet of paper.

GSAP's `ScrollTrigger` (`pin: true, pinSpacing: false`) gives you the exact low-level primitive for this. However, we quickly discovered that **every naive 6-line `ScrollTrigger` loop breaks in real-world production**:
- Clicking a navigation link (`#section` or `scrollTo`) lands hundreds of pixels off whenever an earlier section is `position: fixed`.
- If the final section is shorter than the viewport, it can never scroll flush to the top of the screen, and the second-to-last section's header stays stuck over it forever.
- Two short sections in a row overlap their pin windows.
- Rotating a phone or resizing the browser while a YouTube/Vimeo `<iframe>` or `<video>` is fullscreen inside a pinned section immediately exits fullscreen and reloads the iframe.
- Clicking "Show less" on an accordion at the bottom of a pinned section strands the user inside the next section because GSAP's inline `.pin-spacer` height disables native CSS `overflow-anchor`.

Instead of fighting GSAP or reinventing scroll physics, we solved all six edge cases **using GSAP's own intended primitives** (`ScrollTrigger`, `ScrollTrigger.observe()`, `ScrollTrigger.maxScroll()`, `ScrollTrigger.config({ ignoreMobileResize: true })`, `refreshInit` / `refresh` lifecycle events, and `gsap.utils`) and packaged the result as a tiny, zero-stylesheet, framework-agnostic library so other developers don't have to rediscover these traps from scratch.

---

## Core Features (All Interactive in the [Live Demo](https://dvdgiesen.github.io/stacked-scroll/))

| Feature | How It Works (Idiomatic GSAP) | Interactive Example in `demo/index.html` |
| :--- | :--- | :--- |
| **Two-Phase Sticky + Pin Choreography** | Combines native CSS `position: sticky` headers while reading with height-aware `ScrollTrigger` pinning (`start: "bottom bottom"` for tall panels, `"top top"` for short panels, `pinSpacing: false`). | Scroll through **#cover**, **#longread** (tall), and **#highlight** (short). |
| **3 Page-Turn Directions (`bottom-up`, `from-right`, `from-left`)** | Vertical sheet stack by default, or horizontal newspaper/card page turns driven by `ScrollTrigger` progress and `gsap.utils.clamp()`. Switchable at runtime via `setTransition()`. | **Interactive Feature 01** on `#cover` + floating **Live Controls** toolbar. |
| **Touch-Swipe Page Turns & Ignore Zones** | Uses `ScrollTrigger.observe()` (`Observer` plugin) for axis-locked horizontal touch dragging, swipe velocity completion, and `swipeIgnoreSelector` filtering for nested carousels. | **Interactive Feature 01** & **Interactive Feature 04** (`[data-swipe-ignore]` strip in `#gallery`). |
| **Deep-Link Safe `scrollTo()`** | Bypasses the CSSOM `offsetTop`/`offsetParent` and `getBoundingClientRect()` traps under `position: fixed` by summing natural `offsetHeight`s + same-tick rect deltas + header offset compensation. | Hamburger `☰` menu, section buttons, and mid-section links (`#article-02`, `#article-03`). |
| **Collapsible Content Scroll Anchoring** | Hooks into `ScrollTrigger`'s `refreshInit` and `refresh` events to measure `.pin-spacer` height deltas when an accordion or "show less" block shrinks, anchoring `window.scrollY` automatically. | **Interactive Feature 02** ("Read more / Show less" archival drawer at the bottom of `#longread`). |
| **Fullscreen & Orientation Guard** | Wraps each trigger's `revert()` and `refresh()` while native fullscreen or `setFullscreenGuard(true)` (iOS CSS fallback) is active so pinned DOM nodes & `<iframe>` embeds are never detached or reloaded. | **Interactive Feature 03** (Fullscreen & Rotation Guard sandbox in `#gallery`). |
| **Short Last Panel & Settle Buffers** | Auto-manages an end-spacer (`viewportHeight - lastSection.offsetHeight`), clamps non-final pin ends to `ScrollTrigger.maxScroll(window) - 1`, and injects settle buffers between consecutive short sections. | **#highlight** (short section) and **#contact** (short final section). |
| **Compact Header Mode & Accessibility** | Toggles `compactClassName` below `hideHeadersBelow` viewport height, handles mobile URL bar resizes non-destructively via `visualViewport`, and respects `prefers-reduced-motion: reduce`. | Floating **Live Controls** toolbar (`Compact Headers` toggle). |

## How the effect works (Two-Phase Choreography)

`stacked-scroll` combines native CSS sticky positioning with GSAP `ScrollTrigger` pinning (`pin: true, pinSpacing: false`) in a two-phase handoff:

1. **Phase 1 — Reading a section (`position: sticky`):** While you scroll through a tall section, its `.header` stays stuck to the top of the viewport via CSS `position: sticky; top: 0` while its `.main` content scrolls naturally underneath.
2. **Phase 2 — Turning the page (`pin: true, pinSpacing: false`):** The instant you reach the bottom of the section (`start: "bottom bottom"`, or `"top top"` if the section is shorter than the viewport), GSAP freezes the entire section in place (`position: fixed`). Because `pinSpacing` is `false`, no blank scroll space is reserved — the next section immediately slides up from the bottom of the screen like a physical sheet of paper, covering the frozen section and bringing its own sticky header into place.

## Install

```bash
npm install stacked-scroll gsap
```

`gsap` is a peer dependency.

## Quick start

Your HTML is a stack of sections. Each section needs a header and a main content area.

```html
<section class="panel" id="intro">
  <header class="header">Intro</header>
  <main class="main">…</main>
</section>

<section class="panel" id="work">
  <header class="header">Work</header>
  <main class="main">…</main>
</section>
```

```js
import StackedScroll from 'stacked-scroll';

const scroller = new StackedScroll({
  sections: '.panel',
  headerSelector: '.header',
  mainSelector: '.main'
});

scroller.init();

// Deep-link to a section
scroller.scrollTo('work');
```

## CSS requirements

The library only handles the JavaScript side of pinning. Your CSS must cooperate with GSAP:

- Do **not** add global `position: relative` or `z-index` to your section elements — this breaks GSAP's pinning behavior.
- Headers should use `position: sticky; top: 0` if you want them to stay visible while the section content scrolls.
- Give sections an opaque `background` and `min-height: 100vh` (or `100dvh`) so each incoming page completely covers the pinned section behind it.
- If you need to clip horizontal overflow inside `.header` or `.main`, use `overflow-x: clip` rather than `overflow: hidden` on `body` (which breaks `position: sticky`).

### Optional: Newspaper page-turn shadow recipe

To get the physical "overlapping sheet of paper" look from [rotyounges.com](https://rotyounges.com) and `demo/index.html`, add a subtle upward-facing gradient band above each `.header`:

```css
.header {
  position: sticky;
  top: 0;
  background: #f7f5f0;
  z-index: 10;
}

.header::before {
  content: '';
  position: absolute;
  top: -15px;
  left: 0;
  right: 0;
  height: 15px;
  border-radius: 15px 15px 0 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.18));
  pointer-events: none;
}
```

See `demo/index.html` for a complete working example.

### Hiding headers on short viewports

If you enable `hideHeadersBelow`, StackedScroll adds the configured class to
`<html>` whenever the viewport is shorter than the threshold. You then decide
what happens to the per-section header via CSS. Keep your site's primary
navigation outside the section header so it remains accessible when the header
is hidden.

```css
/* Hide the per-section title bar on short viewports */
.stacked-scroll-compact .header {
  display: none;
}

/* Or collapse it instead of hiding it */
.stacked-scroll-compact .header {
  height: 2rem;
  padding: 0.25rem 1rem;
  font-size: 0.75rem;
}
```

## Configuration

```js
new StackedScroll({
  // Selector string, NodeList, array, or single HTMLElement
  sections: '.panel',

  // Selector for the sticky header inside each section (used for offset compensation)
  headerSelector: '.header',

  // Selector for the default scroll target inside each section
  mainSelector: '.main',

  // Optional: provide your own spacer element instead of the auto-created one.
  // The spacer must be outside all sections.
  spacerSelector: null,

  // Debounce window resize events
  resizeDebounceMs: 200,

  // Default scroll behavior for scrollTo()
  scrollBehavior: 'smooth',

  // Optional: when the viewport height (px) drops below this value, add
  // compactClassName to <html> so you can hide/collapse per-section headers.
  hideHeadersBelow: null,

  // Class added to <html> when the viewport is shorter than hideHeadersBelow.
  compactClassName: 'stacked-scroll-compact',

  // Prevent GSAP ScrollTrigger from re-parenting pinned DOM nodes while
  // fullscreen video/iframes are active (preserves fullscreen on resize/rotate).
  protectFullscreen: true,

  // Direction in which incoming sections enter the viewport during page handoffs:
  // 'bottom-up' (default), 'from-right' (newspaper page turn), or 'from-left' (card swipe).
  transition: 'bottom-up',

  // Enable horizontal touch-swipe dragging to turn pages when transition is
  // 'from-right' or 'from-left'.
  touchSwipe: true,

  // Optional selector for horizontally interactive elements where touch-swipe
  // page turns should be ignored.
  swipeIgnoreSelector: null
});
```

## API

### `init()`

Set up ScrollTriggers, the scroll-end spacer, settle buffers, and event listeners. Returns the instance.

```js
scroller.init();
```

### `scrollTo(target, options)`

Scroll to a section or to a specific element within a section. Use this instead of native `<a href="#section">` anchors, which break whenever an earlier section is pinned (`position: fixed`).

```js
// Scroll to a section by id
scroller.scrollTo('work');

// Scroll to a custom element inside the section
scroller.scrollTo('work', { offsetElement: '#work .lead' });

// Override the scroll behavior for this call
scroller.scrollTo('work', { behavior: 'auto' });
```

### `refresh()`

Recalculate settle buffers, compact mode, spacer sizing, and refresh ScrollTrigger measurements. Call this after your content dynamically changes height (e.g., expanding/collapsing a "read more / show less" block, accordion, or navigation menu inside a section). If a pinned section shrank, `refresh()` automatically anchors `window.scrollY` by the collapsed height delta so the next section does not overlap it. No-ops automatically while fullscreen protection is active.

```js
scroller.refresh();
```

### `setTransition(mode)`

Switch the page-handoff transition direction at runtime (`'bottom-up' | 'from-right' | 'from-left'`).

```js
scroller.setTransition('from-right');
```

### `setFullscreenGuard(active)`

Native fullscreen (`requestFullscreen()`) is detected and protected automatically. If you also implement a CSS pseudo-fullscreen fallback for browsers like iOS Safari (e.g., toggling a `position: fixed; inset: 0` class on a video container), call `setFullscreenGuard(true)` when entering and `setFullscreenGuard(false)` when exiting so `StackedScroll` freezes trigger re-parenting during fallback fullscreen as well.

```js
scroller.setFullscreenGuard(true);  // entering CSS pseudo-fullscreen
scroller.setFullscreenGuard(false); // exiting CSS pseudo-fullscreen
```

### `destroy()`

Kill all ScrollTriggers, remove listeners, and remove the auto-created spacer and settle buffers.

```js
scroller.destroy();
```

## Why this exists (What GSAP alone does not do)

`stacked-scroll` is built idiomatic to **GSAP 3.13+**, leveraging GSAP's built-in primitives wherever possible:
- **`ScrollTrigger`** (`pin: true, pinSpacing: false`, `ScrollTrigger.maxScroll(window)`, `ScrollTrigger.config({ ignoreMobileResize: true })`, and `refreshInit` / `refresh` lifecycle hooks)
- **`ScrollTrigger.observe()` (`Observer`)** for unified touch-swipe axis locking, velocity tracking, and `ignore` selector filtering during horizontal page turns (`transition: 'from-right' | 'from-left'`)
- **`gsap.utils.clamp()` & `gsap.utils.toArray()`**

While GSAP `ScrollTrigger` provides the low-level `pin: true, pinSpacing: false` primitive, a naive 6-line `ScrollTrigger.create()` loop breaks in production across six non-obvious browser/DOM edge cases:

1. **Deep links and anchor jumps break under `position: fixed` (`scrollTo()` vs. `ScrollToPlugin`)** — When a section is pinned with `pinSpacing: false`, GSAP sets `position: fixed` on it while subsequent sections scroll over it. Per the CSSOM spec, `offsetTop` and `offsetParent` become unreliable the instant any ancestor is `position: fixed` (`offsetParent` returns `null` early, truncating offset walks and jumping near the top of the page). Even `getBoundingClientRect().top + window.scrollY` (which is how GSAP's own `ScrollToPlugin` computes element targets in `_getOffset()`) returns a pinned section's *pinned* viewport coordinate rather than its natural scroll position. `scrollTo()` avoids both traps by summing natural (unpinned) `offsetHeight`s of preceding sections and adding a same-tick `getBoundingClientRect()` delta within the target section.
2. **Short last panel cannot scroll flush to the top** — Because `pinSpacing: false` reserves no extra scroll space, when the final section is shorter than the viewport (`offsetHeight < viewportHeight`), `maxScroll` physically stops short of bringing that section's top edge to the top of the screen (and browsers silently clamp programmatic scrolls there, confusing ScrollTrigger's active pin state). `stacked-scroll` manages an invisible end-spacer sized to the exact shortfall (`viewportHeight - lastSection.offsetHeight`) outside your sections so the layout inside your final section needs no artificial bottom padding.
3. **Previous panel stays stuck on the final transition** — GSAP only unpins a section once scroll passes its `end` position (even GSAP's `end: "clamp(...)"` clamps to `maxScroll`, not `maxScroll - 1`). When the final section is shorter than the viewport, the second-to-last section's natural handoff point can land right on `maxScroll`, so the browser can never scroll past it and the previous header stays `position: fixed` forever on top of the final section. `stacked-scroll` clamps every non-final pin `end` to `Math.min(nextTop, ScrollTrigger.maxScroll(window) - 1)` so the handoff always completes cleanly.
4. **Adjacent short panels overlap pin windows** — Two consecutive sections both shorter than the viewport (`start: "top top"`) do not provide enough natural scroll distance for the first pin to release before the second engages. `stacked-scroll` injects and reuses a synthetic settle buffer between them so they hand off cleanly. *(Note: keep `min-height: 100vh` on your sections so a pinned section visually covers the viewport behind it.)*
5. **Fullscreen video & `<iframe>` survival on resize and phone rotation** — `ScrollTrigger.refresh()` (and GSAP's internal `matchMedia("(orientation: portrait)")` listener when rotating a phone) temporarily unwraps and re-parents every pinned DOM node. In browsers, detaching a DOM node **immediately exits fullscreen** and **reloads any child `<iframe>` (such as a YouTube or Vimeo embed)**, restarting the video. `stacked-scroll` wraps each trigger's `revert()` and `refresh()` to freeze DOM re-parenting while fullscreen is active, then runs a single catch-up refresh after fullscreen exits if the viewport dimensions changed.
6. **Collapsible content ("read more / show less", accordions) inside a pinned section** — On a normal unpinned page, when a user expands content, scrolls to the bottom of it, and clicks "show less", native CSS Scroll Anchoring (`overflow-anchor`) automatically shifts `window.scrollY` upward by the collapsed height delta so the user stays in the same section. Under `pin: true, pinSpacing: false`, as soon as the user reaches the bottom of a section (`start: "bottom bottom"`) to click "show less", GSAP has already pinned that section (`position: fixed`) and locked an inline `height` on both the section and its `.pin-spacer`. Because the inline height is locked when the content collapses, native browser Scroll Anchoring never fires; and when `ScrollTrigger.refresh()` subsequently runs, GSAP's internal `_refreshAll()` records `obj.rec = window.scrollY` *before* unpinning, measures the shorter height, and then restores the old pre-collapse `obj.rec` scroll position — stranding the user inside the *next* section's overlap window. `stacked-scroll` hooks into `ScrollTrigger`'s `refreshInit` and `refresh` events to read each section's pre-refresh height from its `.pin-spacer` in the DOM and shift `window.scrollY` upward by the collapsed height delta so the following section never overlaps.

## Developer Gotchas & Production Lessons

While hardening `stacked-scroll` across real production sites and CI browsers, we uncovered four subtle browser + GSAP interactions that are helpful to know when building pinned/stacked layouts:

1. **Web Fonts (`font-display: swap`) can silently drift `.pin-spacer` heights by 10–30px**
   If `init()` runs before `@font-face` WOFF2 files finish downloading and swapping in, GSAP measures each section using the fallback font and locks that height onto `.pin-spacer`. When your custom font swaps in a few milliseconds later, paragraph heights change by 10–30px — causing `scrollTo()` and the final section's `maxScroll` to land slightly off. `stacked-scroll` automatically subscribes to `document.fonts.ready` and runs a non-destructive `refresh()` once web fonts settle.
2. **Waiting for CSS transitions (`el.getAnimations()`) before calling `scroller.refresh()`**
   When animating a menu or drawer with CSS transitions inside a pinned section, two browser event-loop details matter if you use the Web Animations API (`el.getAnimations()`):
   - **Flush styles before `el.getAnimations()`:** In the HTML5 event loop, `requestAnimationFrame` callbacks run *before* the frame's Style & Layout pass. If you toggle a class and immediately call `el.getAnimations()` inside `requestAnimationFrame` without forcing a style flush (`void el.offsetHeight`), the new CSS transition hasn't been created yet and `getAnimations()` returns `[]` — firing `scroller.refresh()` on frame 1 before the element has resized.
   - **Guard against cancelled open transitions:** If a user opens a menu and clicks a link before the open transition reaches 100%, closing the menu aborts the opening transition (`animation.finished` rejects immediately). Always check `if (menu.classList.contains('is-open')) scroller.refresh()` in your open callback so an aborted open transition doesn't trigger a mid-collapse refresh.
3. **Snapshot `window.scrollY` in `refreshInit`, not only in `refresh`**
   When a section shrinks while the user is near the very bottom of the document (`maxScroll`), the browser automatically clamps `window.scrollY` downward *during* `ScrollTrigger.refresh()` as soon as the `.pin-spacer` height decreases — before GSAP fires its `'refresh'` event. `stacked-scroll` snapshots `_preRefreshScrollY` inside `'refreshInit'` so scroll-anchoring always computes against the true pre-refresh scroll coordinate and never double-subtracts.
4. **Interactive buttons at the very bottom of a pinned section (Playwright / E2E tests)**
   Because `start: "bottom bottom"` engages the pin and brings the next section's header into view at the bottom edge of a tall section, avoid placing clickable buttons flush against the 0px bottom edge of a section without bottom padding (`padding-bottom` on `.main`). Otherwise, when automated test runners call `element.scrollIntoViewIfNeeded()`, scrolling the button to the bottom edge of the viewport brings the next section's header right over it. Using `scroller.scrollTo(section, { offsetElement: button })` aligns the element cleanly below the sticky header at the top of the viewport.

## Demo

```bash
npm install
npm run build
npx serve
```

Then open http://localhost:3000/demo/.

## Tests

```bash
npm run test:e2e
```

Playwright regression tests cover the spacer fix and deep-link landing tolerance, including a fixture that reproduces the original pinned-section deep-link bug.

## License

MIT

