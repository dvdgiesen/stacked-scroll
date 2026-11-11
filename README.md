# stacked-scroll

A small, hardened library that turns your sections into a stack of pages: each header stays pinned while you read, then hands off cleanly to the next page as it slides up from below.

Built on top of [GSAP ScrollTrigger](https://greensock.com/scrolltrigger/).

## Status

v1.1.0 — stable and tested. Used in production on [rotyounges.com](https://rotyounges.com).

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
  protectFullscreen: true
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

Recalculate settle buffers, compact mode, spacer sizing, and refresh ScrollTrigger measurements. Call this after your content dynamically changes height (e.g., expanding an accordion or collapsible navigation menu inside a header/section). No-ops automatically while fullscreen protection is active.

```js
scroller.refresh();
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

GSAP `ScrollTrigger` provides the low-level `pin: true, pinSpacing: false` primitive, but a naive 6-line `ScrollTrigger.create()` loop breaks in production across five non-obvious browser/DOM edge cases:

1. **Deep links and anchor jumps break under `position: fixed` (`scrollTo()`)** — When a section is pinned with `pinSpacing: false`, GSAP sets `position: fixed` on it while subsequent sections scroll over it. Per the CSSOM spec, `offsetTop` and `offsetParent` become unreliable the instant any ancestor is `position: fixed` (`offsetParent` returns `null` early, truncating offset walks and jumping near the top of the page). Even `getBoundingClientRect().top + window.scrollY` on a pinned section returns its *pinned* viewport coordinate rather than its natural scroll position. `scrollTo()` avoids both traps by summing natural (unpinned) `offsetHeight`s of preceding sections and adding a same-tick `getBoundingClientRect()` delta within the target section.
2. **Short last panel cannot scroll flush to the top** — Because `pinSpacing: false` reserves no extra scroll space, when the final section is shorter than the viewport (`offsetHeight < viewportHeight`), `maxScroll` physically stops short of bringing that section's top edge to the top of the screen (and browsers silently clamp programmatic scrolls there, confusing ScrollTrigger's active pin state). `stacked-scroll` manages an invisible end-spacer sized to the exact shortfall (`viewportHeight - lastSection.offsetHeight`) outside your sections so the layout inside your final section needs no artificial bottom padding.
3. **Previous panel stays stuck on the final transition** — GSAP only unpins a section once scroll passes its `end` position. When the final section is shorter than the viewport, the second-to-last section's natural handoff point can land right on `maxScroll`, so the browser can never scroll past it and the previous header stays `position: fixed` forever on top of the final section. `stacked-scroll` clamps every non-final pin `end` to `Math.min(nextTop, maxScroll - 1)` so the handoff always completes cleanly.
4. **Adjacent short panels overlap pin windows** — Two consecutive sections both shorter than the viewport (`start: "top top"`) do not provide enough natural scroll distance for the first pin to release before the second engages. `stacked-scroll` injects and reuses a synthetic settle buffer between them so they hand off cleanly. *(Note: keep `min-height: 100vh` on your sections so a pinned section visually covers the viewport behind it.)*
5. **Fullscreen video & `<iframe>` survival on resize and phone rotation** — `ScrollTrigger.refresh()` (and GSAP's internal `matchMedia("(orientation: portrait)")` listener when rotating a phone) temporarily unwraps and re-parents every pinned DOM node. In browsers, detaching a DOM node **immediately exits fullscreen** and **reloads any child `<iframe>` (such as a YouTube or Vimeo embed)**, restarting the video. `stacked-scroll` wraps each trigger's `revert()` and `refresh()` to freeze DOM re-parenting while fullscreen is active, then runs a single catch-up refresh after fullscreen exits if the viewport dimensions changed.

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

