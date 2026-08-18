# stacked-scroll

A small, hardened library for the "stacked-pages" scroll effect: full-viewport sections that pin while you read their content, then hand off cleanly to the next section as it slides up from below.

Built on top of [GSAP ScrollTrigger](https://greensock.com/scrolltrigger/).

## Status

Early extraction from the RotYounges website. API and packaging are not yet stable.

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
- Use `min-height: 100vh` (or `100dvh`) on sections so the pin-start logic can distinguish tall vs short panels.

See `demo/index.html` for a working example.

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
  compactClassName: 'stacked-scroll-compact'
});
```

## API

### `init()`

Set up ScrollTriggers, the scroll-end spacer, and event listeners. Returns the instance.

```js
scroller.init();
```

### `scrollTo(target, options)`

Scroll to a section or to a specific element within a section.

```js
// Scroll to a section by id
scroller.scrollTo('work');

// Scroll to a custom element inside the section
scroller.scrollTo('work', { offsetElement: '#work .lead' });

// Override the scroll behavior for this call
scroller.scrollTo('work', { behavior: 'auto' });
```

### `refresh()`

Recalculate spacer sizing and refresh ScrollTrigger measurements. Call this after your content changes height.

```js
scroller.refresh();
```

### `destroy()`

Kill all ScrollTriggers, remove listeners, and remove the auto-created spacer.

```js
scroller.destroy();
```

## Why this exists

GSAP ScrollTrigger provides the low-level `pin` primitive, but packaging the specific "read the whole section, then hard-cut to the next" behavior involves several non-obvious edge cases:

1. **Short last panel** — when the last section is shorter than the viewport, the browser physically cannot scroll it flush to the top. `stacked-scroll` adds an invisible spacer sized to exactly the missing height.
2. **Deep links under pinned sections** — `offsetTop`/`offsetParent` become unreliable when GSAP sets `position: fixed` on the active panel. `scrollTo()` avoids them entirely by summing natural panel heights and using a same-tick `getBoundingClientRect()` difference.
3. **Adjacent short panels** — two consecutive sections both shorter than the viewport do not get a clean handoff. This is a documented v1 constraint; the demo avoids it by design.
4. **Previous panel never releases on the final transition** — when the last section is shorter than the viewport, the previous panel's pin `end` can land on the document's maximum scroll position, so GSAP can never scroll past it and the panel stays `position: fixed`. StackedScroll clamps every non-final pin end to just below `maxScroll` so the handoff always completes.

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

