# Promoting `stacked-scroll` to GSAP (Showcase & Community Guide)

Because `stacked-scroll` is built 100% idiomatically on **GSAP 3.13+** (`ScrollTrigger` + `Observer` via `ScrollTrigger.observe()` + `gsap.utils`), there are two complementary ways to get it featured by the GSAP team.

---

## 1. Official GSAP Showcase Submission (`https://gsap.com/showcase-submission/`)

The GSAP Showcase features live websites and interactive experiences. You can submit **[rotyounges.com](https://rotyounges.com)** (the live client production site) and/or the **[StackedScroll Interactive Playground](https://dvdgiesen.github.io/stacked-scroll/)**.

### Form Fields & Ready-to-Paste Copy

* **Submission URL:** <https://gsap.com/showcase-submission/>
* **Project Title:** `RotYounges / StackedScroll — Tactile Newspaper Page-Turn Scrolling`
* **Project URL:** `https://rotyounges.com` *(or `https://dvdgiesen.github.io/stacked-scroll/` for the interactive playground)*
* **Cover Image:** `740×400` px (JPEG/WebP, max `100 KB`)
* **Video (for GSAP's social posts):** `16:9` MP4 screen recording (~10 seconds, max `5 MB`) showing:
  1. Reading through a tall section while the sticky header stays pinned.
  2. Hitting the bottom and watching the next section slide over it with the newspaper shadow (`bottom-up` and `from-right` page turn).
  3. Clicking a deep-link in the hamburger menu to jump cleanly across pinned sections.
* **Plugins Used:** `ScrollTrigger`, `Observer` (`ScrollTrigger.observe()`)
* **Tags / Technologies:** `Editorial`, `Portfolio`, `Scrollytelling`, `Open Source`, `JavaScript`
* **Does your site respect `prefers-reduced-motion`?:** **Yes** *(StackedScroll checks `window.matchMedia('(prefers-reduced-motion: reduce)')` and automatically disables horizontal transforms and smooth-scroll animations).*
* **Anything else you'd like us to know? (Copy-paste):**
  > Built for rotyounges.com to give the site the feel of flipping through a physical stack of newspaper pages: each section's header stays pinned while you read, then the entire section freezes via `ScrollTrigger` (`pin: true, pinSpacing: false`) while the next page slides over it (`bottom-up`, `from-right`, or `from-left`).
  >
  > Along the way we solved six tricky DOM/CSSOM edge cases that come up in production with `pinSpacing: false` (deep-linking across `position: fixed` sections where `offsetTop`/`offsetParent` and `getBoundingClientRect()` diverge from natural document coordinates, short final sections, adjacent short sections, collapsible accordions inside pinned sections via `refreshInit`/`refresh`, horizontal touch-swipe via `ScrollTrigger.observe()`, and keeping fullscreen videos/iframes alive across `ScrollTrigger.refresh()` and phone rotations).
  >
  > We open-sourced the engine as an MIT library (`stacked-scroll`) with an interactive playground showing every feature live:
  > - Live Interactive Demo: https://dvdgiesen.github.io/stacked-scroll/
  > - GitHub: https://github.com/dvdgiesen/stacked-scroll
  > - npm: https://www.npmjs.com/package/stacked-scroll


---

## 2. GSAP Community Forum Post (`https://gsap.com/community/forums/`)

Posting a technical write-up + demo in the **GSAP Community Forums** is the best way to get noticed by Cassie Evans, Jack Doyle, and Rodrigo for the **GSAP Newsletter** and community highlights.

### Suggested Forum Title
`[Showcase / Open Source] StackedScroll — Turning sections into a stack of pages with ScrollTrigger + Observer (and 6 edge cases we solved)`

### Suggested Forum Post Body (Copy-paste)

Hey GSAP community!

While building **[rotyounges.com](https://rotyounges.com)**, we wanted a tactile editorial effect where each section behaves like a physical sheet of paper in a stack:
1. **Phase 1 (Reading):** While scrolling through a tall section, its header stays stuck at the top while the body scrolls underneath.
2. **Phase 2 (Turning the page):** The instant you reach the bottom of the section (`start: "bottom bottom"`, or `"top top"` for short sections), `ScrollTrigger` pins the section (`pin: true, pinSpacing: false`) so the next page slides over it — either vertically (`bottom-up`) or horizontally like a newspaper page (`from-right` / `from-left`).

We recently refactored the entire engine to use **idiomatic GSAP 3.13+ primitives** and open-sourced it as **`stacked-scroll`**:
- **Live Interactive Playground:** https://dvdgiesen.github.io/stacked-scroll/
- **GitHub:** https://github.com/dvdgiesen/stacked-scroll
- **npm:** `npm install stacked-scroll gsap`

### How it uses GSAP under the hood
- **`ScrollTrigger` (`pin: true, pinSpacing: false`):** Height-aware `start` callbacks (`"bottom bottom"` vs `"top top"`), dynamic `end` clamping with `ScrollTrigger.maxScroll(window)`, and `ScrollTrigger.config({ ignoreMobileResize: true })`.
- **`ScrollTrigger.observe()` (`Observer`):** Powers horizontal touch-swipe page turns (`from-right` and `from-left`) with `lockAxis: true`, `velocityX` flick completion, and `ignore` selector filtering so horizontal carousels inside a page don't trigger accidental page turns.
- **`ScrollTrigger` `refreshInit` & `refresh` lifecycle events:** Used to implement scroll anchoring when collapsible content ("read more / show less" accordions) shrinks inside a currently pinned section.
- **`gsap.utils.toArray()` & `gsap.utils.clamp()`:** For section resolution and transition progress math.

### The 6 production edge cases it solves
1. **Deep-linking (`scrollTo()`) under `position: fixed`:** Sums natural `offsetHeight`s of preceding sections + a same-tick `getBoundingClientRect()` delta within the target section.
2. **Short final section flush-top:** Automatically sizes an invisible end-spacer to `viewportHeight - lastSection.offsetHeight`.
3. **Final transition pin release:** Clamps non-final pin `end` values to `Math.min(nextTop, ScrollTrigger.maxScroll(window) - 1)` so the second-to-last header always unpins cleanly.
4. **Adjacent short panels:** Injects and reuses synthetic settle buffers between consecutive short sections.
5. **Collapsible content ("Show less") inside a pinned section:** Uses `refreshInit` and `refresh` to measure the `.pin-spacer` height delta (snapshotting both `.pin-spacer` heights and `window.scrollY` in `refreshInit` before browser `maxScroll` clamping occurs) and shift `window.scrollY` upward so the next section never overlaps.
6. **Fullscreen video & `<iframe>` survival on resize/rotate:** Wraps trigger `revert()` and `refresh()` while fullscreen is active so DOM re-parenting never exits fullscreen or reloads embedded iframes.
7. **Bonus browser gotchas handled / documented:** Automatic `document.fonts.ready` refresh so `font-display: swap` web fonts don't leave `.pin-spacer` heights 10–30px stale, plus `void el.offsetHeight` style-flushing before `el.getAnimations()` when waiting on CSS transitions before calling `ScrollTrigger.refresh()`.

All edge cases + the transition switcher are interactive in the [Live Demo](https://dvdgiesen.github.io/stacked-scroll/). Would love any feedback from the GSAP team and community!
