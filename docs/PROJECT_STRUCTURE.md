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
    aem/          — AEM host/URL management + auth headers
    collections/  — cart/collection state
    renditions/   — rendition resolver registry
    search/       — search orchestration + providers
    …             — other singleton services
  models/         — Asset, Rendition, User data models
  utils/          — shared utilities (events, blocks, search, fragments)
  parts/          — reusable UI components (AssetTeaser, …)
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

#### Scripts

| File | Purpose |
|------|---------|
| `scripts/asc/section-grid.js` | Named-area CSS grid for section metadata — called internally by `ascDecorateMain` |
| `scripts/asc/tokens.js` | `{{ accessor \| fallback }}` content variable resolver — called internally by `ascDecorateMain` |
| `scripts/asc/html.js` | Shared HTML helpers: `escHtml`, `escAttr`, `formatUpdated` — import into any block that builds HTML strings |
| `scripts/asc/board-item.js` | Default board/collection card renderer — swap via `configurations.board.itemRenderer` |
| `scripts/asc/notifications.js` | Toast feedback; edit the `LISTENERS` array directly to add/remove/reword triggers |
| `scripts/asc/color-search.js` | Color-picker palette + nearest-match algorithm for `search-bar`'s color search |
| `scripts/asc/analytics.js` | Analytics bridge — normalizes the `asc:{noun}:{verb}` event bus into `trackEvent()` calls |
| `scripts/asc/asset-navigation.js` | Derives the Prev/Next asset list for the details modal from the current page DOM |
| `scripts/asc/speculation-rules.js` | Registers a Speculation Rules script for same-origin link prefetching |
| `scripts/asc/rendition-download-menu.js` | Shared floating rendition-picker menu (download / copy-url / copy-image triggers) |
| `scripts/asc/chrome.js` | Branded-vs-standalone page chrome resolution — see "Chrome Duality" in `CLAUDE.md` |
| `scripts/extract-design-tokens.js` | Dev utility — extracts token values for tooling/docs |

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
│   ├── extract-design-tokens.js USER — dev tooling
│   └── asc/                    USER — user-facing ASC files
│       ├── configurations.js   USER — all site configuration
│       ├── section-grid.js     USER — section grid utility (called by asc.js)
│       ├── tokens.js           USER — content variable resolver (called by asc.js)
│       ├── html.js             USER — escHtml / escAttr / formatUpdated
│       ├── … more flat USER files — see the "Scripts" table above
│       └── core/               ASC CORE — do not edit
│           ├── services/
│           │   └── action-pages/   — /actions/* link interceptor + loadBlock runner
│           ├── models/
│           ├── utils/
│           └── parts/
│
├── blocks/                     USER — all blocks live here
│   ├── <block>/
│   │   ├── <block>.js
│   │   └── <block>.css
│   └── action-<name>/          USER — action dialog blocks
│       ├── action-<name>.js
│       └── action-<name>.css
│
├── styles/
│   ├── styles.css              EDS boilerplate
│   ├── fonts.css               EDS boilerplate
│   ├── lazy-styles.css         EDS boilerplate
│   ├── tokens.css              EDS boilerplate
│   ├── ui-kit.css              USER — ASC UI Kit primitives
│   ├── themes/                 USER — theme CSS variables
│   └── sections/               USER — section layout helpers
│
└── docs/                       Reference documentation
    ├── UI_KIT.md               Kit catalog (agent + developer reference)
    ├── ui-kit.html             Kit visual gallery (open in browser)
    ├── CSS_CONVENTION.md       CSS naming and coding standards
    ├── CONTENT_VARIABLES.md    {{ }} token syntax reference
    ├── GRID_LAYOUT.md          Section grid variable reference
    ├── DEV_SETUP.md            Local dev environment guide
    ├── MCP_SETUP.md            AEM DA MCP tool reference
    └── QUICKSTART.md           Zero-to-running-site guide
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
