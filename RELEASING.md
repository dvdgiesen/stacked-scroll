# Releasing `stacked-scroll`

This is a personal/internal guide for maintaining this library. It is committed
in the repo for reference, but it is **not** shipped to npm.

## What this project is

A small, framework-agnostic library that creates the "stacked-pages" scroll
effect: sections pin, their headers stay visible while you read, and the next
section slides up from below like a sheet of paper.

The runtime is just the `StackedScroll` class. Everything else — colors, fonts,
shadows, the "paper" look — lives in the **demo CSS** and is **not** part of the
published package.

## Repository layout

```
src/                  # Source code (StackedScroll.js, index.js)
dist/                 # Built files (Vite)
demo/                 # Live demo HTML/CSS (not shipped to npm)
tests/                # Playwright e2e tests
docs/                 # Internal project notes
index.d.ts            # TypeScript declarations
package.json          # Package metadata
.github/workflows/    # CI: test.yml + release.yml
```

The npm package only ships what `package.json` `files` lists:

```json
"files": ["dist", "index.d.ts", "CHANGELOG.md"]
```

So `demo/`, `tests/`, and this file do **not** go to npm.

## When to bump the version

This project follows [SemVer](https://semver.org/):

- **MAJOR (`X.0.0`)**: breaking API change (renaming options, removing public
  methods, changing default behavior).
- **MINOR (`x.Y.0`)**: new backward-compatible feature (new config option, new
  public method, new supported markup pattern).
- **PATCH (`x.y.Z`)**: bug fixes, docs-only updates, copy tweaks, demo
  styling changes, dependency bumps.

### When to publish

You should bump + publish when the change matters to someone installing the
package or reading its npm page:

- Code fix → yes, publish patch.
- README/description change → yes, publish patch (npm only shows the last
  published README).
- Demo-only CSS tweak (e.g. a new shadow) → publish a patch if you want the
  npm page metadata to feel "current"; otherwise it is optional because the
  demo is not in the package.
- Local experiment, work-in-progress, or pure internal docs → do not publish.

### When NOT to publish

- You are just iterating locally.
- You changed only this `RELEASING.md` file or `docs/` notes.
- You have not run the tests.

## The two ways to publish to npm

### Option A — Manual publish (fast, current default)

Use the npm token stored in your npm account. Make sure the token has
**"Bypass 2FA"** active or publishing will fail with a 403.

```bash
# 1. Make sure main is clean and tests pass
npm run test:e2e

# 2. Bump version in package.json
# 3. Add an entry to CHANGELOG.md

# 4. Build and publish
npm run build
npm publish
```

If `npm publish` prompts for 2FA, set `NODE_AUTH_TOKEN` instead:

```bash
NODE_AUTH_TOKEN=<your-token> npm publish
```

The current access token expires **2026-08-26**. Renew it at
https://www.npmjs.com/settings/dvdgiesen/tokens before then.

### Option B — CI publish (release.yml)

`.github/workflows/release.yml` is already configured to publish on every `v*`
tag push. This is the cleaner long-term flow because it builds with provenance
and does not depend on a local token.

**Important:** the workflow currently has an empty `NODE_AUTH_TOKEN`. For it to
work, you must store the npm token as a GitHub repository secret (e.g.
`NPM_TOKEN`) and change the workflow to use `${{ secrets.NPM_TOKEN }}`.

To trigger a release once that is wired:

```bash
git tag v1.x.x
git push --tags
```

## Release checklist (manual)

1. Make the code/docs/demo changes on a branch.
2. Run tests: `npm run test:e2e`.
3. Decide the version bump using SemVer.
4. Update `package.json` `version`.
5. Add a `## [x.y.z] - YYYY-MM-DD` entry to `CHANGELOG.md`.
6. Build: `npm run build`.
7. Smoke-test the demo: `npx serve demo`.
8. Commit everything and push to `main`.
9. Tag: `git tag vx.y.z` and push the tag.
10. Publish: `npm publish` (or let `release.yml` handle it).
11. Verify on npm:
    ```bash
    npm view stacked-scroll version
    ```

## Styling is not part of the package

The rotyounges paper look (colors, fonts, the page-turn shadow) lives in
`demo/index.html`. The library itself is styling-agnostic. If you want a
different look, edit the CSS variables in the demo, not the library.

If you ever decide to ship a default theme, the right place is a separate
optional stylesheet (e.g. `stacked-scroll/theme.css`), not a JavaScript
settings object.
