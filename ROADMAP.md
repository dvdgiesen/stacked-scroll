# Roadmap — stacked-scroll

Internal roadmap. This file is committed in the repo for reference, but it is
not shipped to npm.

## Phase A — Pre-launch / repo foundation

Most of this is already done. The remaining open item is the GitHub Actions
release token.

- [x] `package.json` filled (`author`, `repository`, `homepage`, `bugs`,
      `keywords`, `license`)
- [x] Git remote configured (`github.com/dvdgiesen/stacked-scroll`)
- [x] `CHANGELOG.md` created
- [x] TypeScript declarations (`index.d.ts`)
- [x] `LICENSE` copyright line filled
- [x] GitHub Actions CI (`test.yml`)
- [x] `RELEASING.md` created
- [ ] **Open:** wire the npm token into `.github/workflows/release.yml`
  - Currently `NODE_AUTH_TOKEN: ''` is empty.
  - To enable automatic publish on `v*` tags, add the npm token as a GitHub
    repository secret (e.g. `NPM_TOKEN`) and change the workflow to use
    `${{ secrets.NPM_TOKEN }}`.

## Phase B — Promotion / discoverability

These are the next concrete things to consider once the foundation above is
solid. Kept in the original priority order.

### Tier 1 — Foundation (must do)

1. **GitHub**
   - [ ] Add README badges: npm version, CI status, license.
   - [ ] Set GitHub repo About / topics.
   - [ ] Enable GitHub Pages for the demo (or link to watsturen.nl).
2. **npm**
   - [ ] Confirm README, description, and keywords reflect the current tagline.
   - [ ] Add a screenshot or GIF of the effect to the README (helps npm page).
3. **watsturen.nl portfolio page**
   - [ ] Live demo embed.
   - [ ] Install snippet (`npm install stacked-scroll`).
   - [ ] Link to GitHub, npm, CodePen, contact.

### Tier 2 — Audience channels

1. **GSAP Forums**
   - [ ] Create a showcase thread telling the deep-link / `offsetTop` bug story.
   - [ ] Include the CodePen(s) and a link to the library.
2. **CodePen — 3 pens**
   - [ ] Minimal starter (3 sections, copy-paste HTML).
   - [ ] Full newspaper demo (same styling as rotyounges).
   - [ ] Before/after the deep-link bug — with and without the library.
3. **Dev.to / Medium**
   - [ ] Blog post hook: "The bug in every naive ScrollTrigger stacked-pages
         implementation."
   - [ ] Cross-post between Dev.to and Medium.
   - [ ] Link back to GitHub, npm, CodePen, watsturen.nl.

### Tier 3 — Ongoing / passive

- [ ] StackOverflow: answer relevant GSAP ScrollTrigger questions where the
      library fits.
- [ ] Twitter/X / Mastodon / Bluesky: post the CodePen demos, tag @greensock.
- [ ] awesome-lists: PR into `awesome-gsap`, `awesome-javascript`,
      `awesome-web-animation`.

## Notes

- The rotyounges-specific styling (paper background, ink color, page-turn
  shadow) stays in the **demo**. The npm package is styling-agnostic.
- Only publish when a change matters to installers or the npm page. See
  `RELEASING.md` for the version-bump rules.
