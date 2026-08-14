# paged-scroll

A small, hardened library for the "newspaper page-turn" scroll effect: full-viewport sections that pin while you read their content, then hand off cleanly to the next section as it slides up from below.

Built on top of [GSAP ScrollTrigger](https://greensock.com/scrolltrigger/).

## Status

Early extraction from the RotYounges website. API and packaging are not yet stable.

## Install

```bash
npm install paged-scroll gsap
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
import PagedScroll from 'paged-scroll';

const scroller = new PagedScroll({
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

## Configuration

```js
new PagedScroll({
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
  scrollBehavior: 'smooth'
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

1. **Short last panel** — when the last section is shorter than the viewport, the browser physically cannot scroll it flush to the top. `paged-scroll` adds an invisible spacer sized to exactly the missing height.
2. **Deep links under pinned sections** — `offsetTop`/`offsetParent` become unreliable when GSAP sets `position: fixed` on the active panel. `scrollTo()` avoids them entirely by summing natural panel heights and using a same-tick `getBoundingClientRect()` difference.
3. **Adjacent short panels** — two consecutive sections both shorter than the viewport do not get a clean handoff. This is a documented v1 constraint; the demo avoids it by design.

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

