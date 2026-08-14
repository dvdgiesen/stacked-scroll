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
import { PagedScroll } from 'paged-scroll';

const scroller = new PagedScroll({
  sections: '.panel',
  headerSelector: '.header',
  mainSelector: '.main'
});

scroller.init();

// Deep-link to a section
scroller.scrollTo('work');
```

## API

See `docs/paged-scroll-project.md` for the full planning document, including the edge cases this library is designed to handle.

## License

MIT
