# Project Structure

This project has three distinct ownership zones. Knowing which zone a file lives in tells you
whether you can edit it, copy it, or leave it alone.

---

## Ownership Zones

### EDS Boilerplate — hands off

Files inherited from the AEM EDS boilerplate. Upgrade by pulling from the upstream template;
do not edit them directly, or your changes will be lost on the next upgrade.

| File / Path | Purpose |
|-------------|---------|
| `scripts/aem.js` | Core EDS loader (block discovery, eager/lazy/delayed phases) |
| `scripts/scripts.js` | Page lifecycle entry point — ASC adds hooks here (see below) |
| `scripts/delayed.js` | Post-load analytics and non-critical work |
| `styles/styles.css` | Base EDS styles (reset, body, fonts, layout) |
| `styles/fonts.css` | Web font declarations |
| `styles/lazy-styles.css` | Styles deferred to the lazy phase |
| `styles/tokens.css` | Design tokens (colors, spacing, typography) |
| `head.html` | `<head>` fragment |
| `404.html` | 404 page |

> **`scripts/scripts.js` is boilerplate, but ASC modifies it** — it imports four lifecycle hooks
> from `scripts/asc.js` (`ascEager`, `ascDecorateMain`, `ascLazy`, `ascDelayed`) and calls them
> at the matching EDS phases. Re-apply these modifications after any EDS boilerplate upgrade.

---

### ASC Core — do not edit

The ASC framework layer. Every file begins with `// ASC Core — do not edit.` as a signal.
These files are maintained by the ASC project and will be replaced wholesale when upgrading
ASC. Customise behaviour via `configurations.js` only — not by editing core files directly.

```
scripts/asc/core/
  services/
    action-pages/ — intercepts /actions/* links; loads action-* blocks as modals
    actions/      — declarative data-asc-action event dispatch system
    activity/     — per-user activity timeline (docs/ACTIVITY.md)
    aem/          — AEM host/URL management + auth headers
    analytics/    — asc:{noun}:{verb} event bus → trackEvent() bridge (docs/ANALYTICS.md)
    collections/  — cart/collection state
    notifications/ — toast feedback for actions with a visible system effect
    renditions/   — rendition resolver registry
    search/       — search orchestration + providers
    …             — other singleton services
  models/         — Asset, Rendition, User data models
  utils/          — shared utilities (events, html helpers, tokens, section grid, chrome, icons, dialogs, …)
  parts/          — reusable UI components (AssetTeaser, collection toggle, rendition menu, …)
```

---

### User-owned — customize freely

Everything here is yours. Copy, modify, and extend without worrying about upstream conflicts.
These files are intentionally outside `scripts/asc/core/` so you can change them.

#### Configuration

| File | Purpose |
|------|---------|
| `scripts/asc/configurations.js` | **Start here.** AEM host, search provider, themes, renditions, collections, custom properties, asset details templates — all user config lives here |
| `scripts/asc.js` | **ASC integration entry point.** Exports lifecycle hooks (`ascEager`, `ascDecorateMain`, `ascLazy`, `ascDelayed`) and action-page utilities (`triggerAction`, `parseActionFragment`, `wireDialogClose`). Auto-initializes all ASC services on import. Customize here to add eager/lazy/delayed work. |

#### Blocks

```
blocks/
  <block-name>/
    <block-name>.js    — exports default decorate(block)
    <block-name>.css   — block styles, rooted at .block.<block-name>

  action-<name>/       — action dialog blocks (loaded by the action-pages service)
    action-<name>.js   — decorate() reads window.asc.pendingAction for context
    action-<name>.css  — scoped to .action-<name>.asc-dialog
```

Copy a block from the ASC starter kit or create your own. The only rule: export
`default function decorate(block)` and follow the kit-first CSS conventions.

**Action blocks** are a special convention: any `<a href="/actions/foo">` is intercepted by the
`actionPages` service, which fetches the DA page at that path, creates a detached `action-foo`
block, and runs `loadBlock()` to invoke the block's `decorate()`. The block is responsible for
creating and showing the `<dialog>`. Context (e.g. `collectionId`) is passed via
`window.asc.pendingAction`.

#### Styles

```
styles/
  ui-kit.css          — ASC UI Kit primitives (.asc-ui-*, .btn, .asc-panel, .asc-dialog)
  themes/             — one CSS file per theme; override --color-* variables only
  sections/           — section-level layout helpers (grid, inline, full-width, aside)
```

#### Block helpers

Files used by exactly one block live in that block's folder and are user-owned like the block.

| File | Purpose |
|------|---------|
| `blocks/board/board-item.js` | Default board/collection card renderer — swap via `configurations.board.itemRenderer` |
| `blocks/search-bar/color-search.js` | Color-picker palette + nearest-match algorithm for `search-bar`'s color search |

#### Tooling

| File | Purpose |
|------|---------|
| `tools/extract-design-tokens.js` | Node CLI — generates a theme from a website's colors (see `skills/asc-theme-from-website`) |

#### Content pages and demos

| File | Purpose |
|------|---------|
| `details.html` | ASC default asset details page template |

---

## File-by-File Quick Reference

```
/
├── scripts/
│   ├── aem.js                  EDS boilerplate
│   ├── scripts.js              EDS boilerplate (ASC-modified)
│   ├── delayed.js              EDS boilerplate
│   ├── asc.js                  USER — ASC entry point; lifecycle hooks + action-page utils
│   └── asc/
│       ├── configurations.js   USER — all site configuration (only user file in this folder)
│       └── core/               ASC CORE — do not edit (services, models, utils, parts)
├── blocks/                     USER — blocks and their private helpers
├── styles/                     USER — kit, themes, tokens
└── tools/                      dev tooling (Node), not shipped to the browser
```

---

## How to Identify a File's Zone at a Glance

| Signal | Zone |
|--------|------|
| `// ASC Core — do not edit.` at top of file | ASC Core |
| Lives in `scripts/asc/core/` | ASC Core |
| Named `aem.js`, `scripts.js`, `delayed.js` | EDS boilerplate |
| Lives in `blocks/` | User-owned |
| Lives in `styles/themes/` or `styles/sections.css` | User-owned |
| Lives in `scripts/asc/` (but not `core/`) | User-owned |
| `scripts/asc.js` | User-owned |

---

## Upgrading

**EDS boilerplate upgrade:** Pull the latest `scripts/aem.js`, `scripts/scripts.js`,
`styles/styles.css`, etc. from the EDS boilerplate template. Then re-apply the ASC
modifications to `scripts/scripts.js`:
```js
import { ascEager, ascDecorateMain, ascLazy, ascDelayed } from './asc.js';
// In loadEager: ascEager(doc)
// In decorateMain (after decorateBlocks): ascDecorateMain(main)
// In loadLazy: ascLazy()
// In loadDelayed: ascDelayed()
```

**ASC Core upgrade:** Replace `scripts/asc/` wholesale. Your customizations live outside
that directory, so they are safe.
