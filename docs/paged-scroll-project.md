# StackedScroll — Project Planning Doc

> **Status:** Early planning / not yet started.
> **Not part of the RotYounges client codebase** — this file is gitignored and lives here only for convenience while it's fresh in mind from building the RotYounges site. Move it to its own repo once work actually begins.

---

## 1. Problem Statement & Prior Art

Certain portfolio/agency/editorial sites use a "stacked-pages" scrolling effect: the page is divided into full-viewport-ish sections. As you scroll, the **current section's header stays pinned/sticky** while its body content scrolls underneath it. Only once you've scrolled all the way through that section's content does the **next section slide up from below and take over**, bringing its own header with it. Scrolling back up reverses the whole thing symmetrically. Done well, it feels like flipping through a stack of papers rather than a normal continuous-scroll page.

This is a recognizable pattern on award-site-style portfolios (Awwwards/FWA-adjacent agency sites), but:

- **There's no standard, ready-made library for it.** GSAP's `ScrollTrigger` provides the low-level pinning primitive, but nothing packages the *specific* "pin until content fully read, then hard-cut to next section" behavior end-to-end.
- Searching GSAP forums / CodePen / Stack Overflow turns up **partial** answers and one-off CodePens, but not a hardened, edge-case-aware implementation.
- The RotYounges project spent **three iterations** getting the deep-linking (jump-to-section) behavior fully robust — see §3. That's exactly the kind of "invisible until it breaks" complexity that makes this worth packaging: most people build the *happy path* version of this effect and only discover the edge cases in production, the way we did.

**Conclusion:** there's a real, narrow niche here — not a "build a SaaS" opportunity, but a legitimate small open-source/paid-template opportunity (see §7 for realistic sizing).

---

## 2. Core Technique (Generic, Framework-Agnostic Description)

Independent of any particular codebase, the effect requires:

1. **Sections stacked normally in document flow** (no absolute/fixed layout trickery upfront) — each section is just a normal full-height-ish block.
2. **Each section's header pins to the top of the viewport** for the duration the user is "inside" that section, using `position: fixed` (via GSAP `ScrollTrigger`'s `pin: true`) rather than plain CSS `position: sticky` — `sticky` alone can't reliably do the "hold, then hard release exactly when the next section takes over" handoff; you need JS-driven pin start/end control.
3. **Two different pin-`start` rules depending on section height relative to viewport:**
   - **Tall section** (taller than the viewport): pin should only engage once the user has scrolled all the way to the section's own bottom (`start: "bottom bottom"`) — i.e., let them read/scroll through it normally first, *then* freeze that final view while the next section slides up over it.
   - **Short section** (shorter than the viewport, fully visible without scrolling): pin engages immediately (`start: "top top"`) — there's no content to scroll through first, so it pins as soon as it reaches the top.
4. **`pinSpacing: false`** — critical. Default GSAP pin behavior reserves extra scroll-space equal to the pin's duration (like normal `position: sticky` reserving layout space). We explicitly do **not** want that — we want the *next* section to be able to slide up and visually cover the pinned one immediately, not wait for reserved empty space to scroll past first.

This is the "generic 80%" — straightforward once you know the two rules above. The genuinely hard part is the **20% edge cases**, covered next.

---

## 3. The Hard Bugs We Solved (This Is the Real IP)

This section is the actual differentiated value of a potential package — the stuff that isn't obvious until you hit it in production.

The README and demo present these in the order users experience them: **deep links → short last panel → final transition → adjacent-short constraint**. This section keeps the detailed analysis in that same order.

### 3.1 Deep-Link / "Scroll To Section" Breaks Because of `position: fixed`'s Effect on `offsetParent`

**Symptom (the big one — took 3 attempts to fully solve on RotYounges):** Clicking a nav link / logo / anchor meant to jump to a specific section sometimes (or, in one specific adjacent-short-sections case, *consistently*) scrolled all the way to the very top of the page instead of the intended target.

**Root cause:** The naive way to compute "how far down the document is this element" is to walk up the `offsetParent` chain, summing `element.offsetTop` at each level. This is a common, normally-reliable pattern — **except** per spec, both `offsetTop` and `offsetParent` become unreliable the instant *any* element in that ancestor chain has `position: fixed`. `offsetTop` starts reporting the fixed-positioned offset instead of the true document position, and `offsetParent` returns `null` early, silently truncating the walk. Since our pinned sections are set to `position: fixed` by GSAP while pinned, and adjacent short sections' pins can still be active at the moment a link is clicked (see §3.3), this bug bit exactly the "jump to the next short section" case — landing near `top: 0`, which visually looks like "jumped to Home," but is really just what a badly truncated calculation happens to produce.

**Two blind-fix attempts that failed (documented so the package's design avoids repeating them):**
1. Adding a synchronous `ScrollTrigger.refresh()` call inside the scroll function, hoping to force fresh measurements — this actually made things *worse*, because `refresh()` has to temporarily un-pin/re-pin the active section to remeasure, and that revert/reapply cycle could itself corrupt the pin bookkeeping right as the scroll target was being computed.
2. A "same-section vs cross-section" dual strategy that checked `getComputedStyle(targetSection).position === 'fixed'` to decide which measurement method to use — this depended on transient pin state at the exact moment of the click, which is inherently timing-sensitive and broke other previously-working links.

**The actual fix (robust — depends on nothing transient):**
```js
// docTop = (sum of natural offsetHeight of every section BEFORE the target section)
//        + (target's position within its own section, via getBoundingClientRect diff)
let cumulativeHeight = 0;
for (const section of allSections) {
  if (section === targetSection) break;
  cumulativeHeight += section.offsetHeight; // always reliable — fixed positioning never changes an element's own size
}

const offsetWithinSection =
  targetElement.getBoundingClientRect().top - targetSection.getBoundingClientRect().top;
// getBoundingClientRect() on two elements read in the same tick always share the
// same live viewport coordinate space, regardless of any ancestor's position:fixed state.

const docTop = cumulativeHeight + offsetWithinSection;
```
This never needs to know any section's current pin/fixed state at all — which is exactly why it doesn't share the fragility of the two failed attempts above. **This is the single most valuable, hardest-won piece of IP from the RotYounges build**, and should be the headline "we solved the hard part" pitch for the package.

### 3.2 Last Section Shorter Than Viewport → Physically Impossible to Scroll Flush-to-Top

**Symptom:** If the *last* section in the page is shorter than the viewport, on larger screens its top can never reach the top of the browser window — no matter how you fix scroll offsets in JS, there just isn't enough page below it to scroll that far.

**Root cause:** With `pinSpacing: false`, total document scroll height is just the natural stacked height of all sections — nothing reserves extra space for pins. The browser's maximum possible scroll position is `documentHeight - viewportHeight`. If the last section is shorter than the viewport, that maximum falls short of the section's natural top by exactly `viewportHeight - sectionHeight`. This is a **hard physical scrolling limit**, not a timing bug — and it also confuses any "scroll to this section" JS, because the browser silently clamps the requested scroll position.

**Fix:** append an **invisible spacer element** at the very end of the document (outside all sections). Measure the shortfall (`viewportHeight - lastSectionHeight`) on load and on resize, and set the spacer's height to exactly that amount. This gives the browser just enough extra (non-visible, non-layout-affecting) scroll room to reach flush-top on any screen size, without adding visible whitespace inside the section's own design.

**Final transition:** the same short-last-panel scenario can leave the previous panel's pin `end` exactly on the document's maximum scroll position, so GSAP can never scroll past it and the panel stays `position: fixed`. The fix is to clamp every non-final pin end to just below `maxScroll` so the handoff always completes.

### 3.3 Two Consecutive Short Sections "Drag" Each Other Into View

**Symptom:** When two adjacent sections are *both* shorter than the viewport, scrolling from the first into the second doesn't give a clean hard-cut — the first section's pin can still be releasing/overlapping while the second is already becoming visible, so it looks like the first one is being "dragged along" into view rather than cutting away cleanly.

**Root cause:** The "hard cut" effect fundamentally depends on there being a **full viewport-height's worth of scroll distance** between one section's pin release and the next section's pin engagement. A *tall* section naturally provides this (the user scrolls through its full content first). Two back-to-back *short* sections don't — there's no such buffer, so their pin windows can overlap in time.

**Fix implemented in v1:** detect this configuration and insert a synthetic, invisible settle buffer between the two short sections. The buffer's height is `viewportHeight - precedingSectionHeight`, which guarantees a full viewport of scroll distance between the first pin's release and the second pin's engagement. This is handled automatically by `StackedScroll._insertBuffers()` and is recalculated on resize/orientationchange.

---

## 4. Proposed Architecture (GSAP-Based Edition — Build This First)

A generic module, `StackedScroll`, extracted from rotyounges.com, hardcoded `src/index.js` implementation.

### Config shape (draft)
```js
const stackedScroll = new StackedScroll({
  sections: '.panel',       // selector or NodeList/Array of section elements
  headerSelector: '.header',// selector (scoped per-section) for the pinned header, for offset calc
  mainSelector: '.main',    // selector (scoped per-section) for the default scroll target within a section
  minHeightBufferMs: 0,     // (see §3.3) optional synthetic settle buffer between short sections
});
```

### Public API (draft)
- `init()` — sets up `ScrollTrigger.create(...)` for every section using the two-case `start` logic, wires the scroll-end spacer, wires resize/load listeners.
- `scrollTo(sectionNameOrElement, { offsetElement })` — the robust panel-height-sum + rect-diff calculation from §3.1, exposed as the public deep-link API.
- `refresh()` — thin wrapper around `ScrollTrigger.refresh()` for consumers who mutate DOM (add/remove content) and need to force remeasurement — but the module itself should almost never call this internally mid-navigation, per the lesson from §3.1.
- `destroy()` — tears down all created ScrollTriggers and listeners (for SPA/route-change scenarios).

### Internal responsibilities (mapped from today's RotYounges `src/index.js`)
| RotYounges code today | Generic module responsibility |
|---|---|
| `panels.forEach(panel => ScrollTrigger.create(...))` | `init()` |
| `updateScrollEndSpacer()` + load/resize listeners | `init()` (spacer setup) + internal resize handler |
| `window.scrollToMain(name)` | `scrollTo(name)` |
| N/A (not yet built) | §3.3 short-section buffer logic, if pursued |

---

## 5. Extraction Checklist

1. Copy the three relevant blocks out of RotYounges' `src/index.js` (panel `ScrollTrigger.create` loop, scroll-end spacer, `scrollToMain`) into a **new, separate repo** — do not modify the live RotYounges site as part of this work.
2. Generalize hardcoded assumptions:
   - `.header` / `.main` class names → configurable selectors
   - `panels` global array → constructor-provided sections
   - `window.scrollToMain` global → instance method
3. Add the `StackedScroll` class wrapper + public API from §4.
4. Write a handful of automated regression tests (even basic ones) specifically covering §3's three bugs, since they're each the kind of thing that silently regresses:
   - short+short adjacent sections don't visually overlap
   - last section shorter than viewport still reaches flush-top
   - deep-link jump to a target lands within N px of the expected target regardless of any other section's current pin state
5. Build a small **public demo site** (3-4 example sections, some tall, some short, at least one deep-link nav) — hosted free (GitHub Pages / Netlify).
6. Write README + a config API reference + 1-2 copy-paste "starter" snippets.

---

## 6. Standalone / Vanilla (No-GSAP) Edition — Possible v2, Not First Priority

- Would require hand-rolling everything ScrollTrigger currently handles for free: cross-browser pin behavior, resize-safe remeasurement, etc.
- Bundle-size win (no GSAP/ScrollTrigger dependency, ~50-70kb saved) is the main selling point.
- **Recommendation: build only if the GSAP edition shows real demand.** Frame it as a "zero-dependency Pro edition" at a higher price point later, not a parallel initial effort — attempting both at once risks finishing neither well.

---

## 7. Packaging & Monetization Options

| Option | Pros | Cons |
|---|---|---|
| Free, MIT-licensed, published on npm | Max discoverability/reputation, easiest adoption | No direct revenue |
| Free core (npm) + paid polished demo/examples bundle (Gumroad) | Best of both — free drives adoption/reputation, paid bundle captures willingness-to-pay from people who want ready-made examples | Requires maintaining two artifacts |
| Fully paid template (CodeCanyon/ThemeForest-style marketplace) | Direct revenue from day one | Much smaller audience reach than free/npm; marketplace take-rate |

**Recommendation (see §9.5 for hardening rationale):** free, MIT-licensed core on npm for reputation and adoption; treat direct revenue as a bonus experiment, not the primary goal. Drop the "paid examples bundle" and CodeCanyon options — the audience is senior enough to copy free examples, and CodeCanyon buyers expect full visual templates, not headless libraries. If a paid tier is ever built, it should be a genuinely different product (the vanilla/zero-GSAP "Pro" edition from §6), not examples or docs. Until demand for that is proven, prioritize discoverability, portfolio value, and inbound credibility. Realistic expectation: a reputation/portfolio piece with supplemental income possible, not a primary business.

---

## 8. Rough Roadmap

- [x] Check npm name availability for `stacked-scroll` and lock it in.
- [ ] Set up new repo (separate from RotYounges) for the `stacked-scroll` package.
- [ ] Extract & generalize the rotyounges.com code blocks into the `StackedScroll` module (§5.1–5.3).
- [ ] Build public demo site **first** (§5.5) — this is the proof-of-working and the primary marketing asset.
- [ ] Freeze the public API against the working demo.
- [ ] Write regression coverage for the solved hard bugs (§5.4) using **Playwright** (not jsdom/Jest), with real viewport sizes and real scroll interactions.
- [ ] Add mobile viewport handling (`dvh` / `visualViewport`) and `prefers-reduced-motion` support.
- [ ] Write README + API docs + 1–2 copy-paste starter snippets (§5.6). Lead with the §3.1 deep-link story.
- [ ] Publish the MIT-licensed npm package.
- [ ] Distribute: publish the deep-dive writeup on the `offsetParent`/`position: fixed` bug, share a CodePen demo, post to the GSAP forums, and syndicate to Awwwards/r/webdev communities.
- [ ] (Optional, later) evaluate real demand before starting the standalone/vanilla edition (§6).

---

## 9. Hardening — Decisions to Lock In

This section captures the hardening decisions that should guide v1. They resolve the open questions in §10 and supersede the looser options in §7.

### 9.1 §3.3 (two consecutive short sections) is now solved with a synthetic settle buffer

The original plan left §3.3 open: either build a synthetic settle buffer or document it as a known constraint. The RotYounges implementation initially avoided the problem by **authoring content so it does not happen**.

**Decision for v1:** implement the synthetic settle buffer (§3.3b) and remove it as a constraint. `StackedScroll` now inserts an invisible settle buffer between any pair of consecutive short sections, giving the previous pin enough scroll distance to release before the next pin engages. This is fully covered by a Playwright regression test.

**Marketing implication:** the library now genuinely solves the three hard edge cases (§3.1, §3.2, and §3.3). This is a strong, honest differentiator.

### 9.2 Automated tests must use Playwright, not jsdom/Jest

The three hard bugs are all **layout-dependent**: `offsetHeight`, `getBoundingClientRect()`, `position: fixed`, and GSAP's actual pin state inside a real scroll container. jsdom has no layout engine, so it returns zeroed/undefined geometry and cannot exercise ScrollTrigger at all. The "handful of regression tests" item in §5 is therefore **Playwright** by default.

Acceptance tests to write:
- Last section shorter than viewport still reaches flush-top across a range of viewport sizes.
- Deep-link scroll to a target lands within a small tolerance (e.g., ±10 px) regardless of any other section's current pin state.
- Adjacent short sections do not visually overlap (now verified by the synthetic settle buffer, not just by demo configuration).

### 9.3 Mobile viewport handling is a v1 acceptance criterion, not a later bug

The spacer math uses `window.innerHeight`, which changes on mobile as the URL bar collapses and expands. On `pinSpacing: false` pinned pages, this can silently reintroduce the §3.2 clamp.

**Decision:** the spacer must be sized against the stable viewport (`dvh` / `visualViewport`) and recalculated on `orientationchange`. Document which browsers are supported and which are "best-effort." This is not optional polish; it is part of the "any screen size" claim in the original pitch.

### 9.4 `scrollTo()` landing must be acceptance-tested, not just argued from the math

The `offsetHeight`-sum + same-tick `getBoundingClientRect()` diff gives the correct **natural document top**. But `window.scrollTo({behavior:'smooth'})` does not guarantee that ScrollTrigger ends up in the expected state when the target is inside a currently pinned region: scroll distance and page distance diverge while a pin is active, and smooth scrolling can overshoot/undershoot.

**Decision:** expose `scrollTo()` with the existing offsetHeight+rect calc as the default, but add a Playwright test that lands within tolerance from many starting positions and pin states. If the smooth-scroll behavior fails the test, consider falling back to GSAP's `ScrollToPlugin` or a manual scroll-comp for deterministic landings. Do not promise "never breaks" without the test.

### 9.5 Packaging and monetization: reputation-first, free MIT core

The original plan's three options are internally contradictory. A senior-dev audience (the only people who feel §3.1's pain) will copy free MIT code rather than pay $15–35 for examples. CodeCanyon's audience expects complete visual templates, not a headless library. And publishing the MIT core gives away the exact fixes that are the IP.

**Decision:**
- License: **MIT** (max adoption, max portfolio value).
- Direct revenue: **explicitly deprioritized**. The realistic primary return is reputation, inbound credibility, and a portfolio piece.
- Do not sell a "polished examples bundle" — it undermines the free core without creating a defensible product.
- Do not list on CodeCanyon unless you later wrap the library into a full visual template.
- The only defensible paid tier is a **genuinely different product**: the vanilla/zero-GSAP Pro edition from §6. Defer it until real demand (GitHub stars, forum engagement, inbound emails) proves it is worth the effort. Do not build it speculatively.

### 9.6 Distribution, accessibility, and performance are part of the pitch

A free library only works if people find it. The marketing asset is the **story of the §3.1 bug** — most developers have never heard that `offsetTop`/`offsetParent` become unreliable under `position: fixed`. Write that as a blog post / CodePen demo / GSAP forum thread; the library rides along.

Required v1 additions the original plan skipped:
- `prefers-reduced-motion` handling.
- Quantified performance claims (no layout shift, no reserved scroll dead-space, GSAP peer dependency, optional vanilla Pro later).
- Explicit note that GSAP is the peer dependency (free for commercial use since 2023) and should not be bundled into the package.

### 9.7 Roadmap sequencing: demo first, then API freeze, then Playwright tests

The original roadmap put tests before the demo. For a solo side project, the demo is the cheapest way to verify the whole effect end-to-end and the strongest marketing asset. Once the demo works, freeze the API, then write Playwright tests against it. This avoids rewriting tests while the API is still churning.

The updated §8 roadmap reflects this order.

---

## 10. Open Questions / Decisions Still Needed

- Where the new repo will actually live (GitHub org/account, public from day one or private until ready).

