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
| `styles/fonts.css` | Web font declarations |
| `styles/lazy-styles.css` | Styles deferred to the lazy phase |
| `head.html` | `<head>` fragment |
| `404.html` | 404 page |

> **Not boilerplate, despite looking like it:** `styles/styles.css` and `styles/tokens.css`
> started from the EDS boilerplate but are now heavily ASC-authored (the `.btn`/`.asc-panel`/
> `.asc-dialog` primitives, the full design-token set, section rules). Treat them as **user-owned**
> — do NOT pull them from the EDS boilerplate on an upgrade, or you will lose that work.

> **`scripts/scripts.js` is boilerplate, but ASC modifies it** — it imports four lifecycle hooks
> from `scripts/asc.js` (`ascEager`, `ascDecorateMain`, `ascLazy`, `ascDelayed`) **plus
> `isChromeless` from `scripts/asc/core/utils/chrome.js`**, and calls them at the matching EDS
> phases. Re-apply these modifications after any EDS boilerplate upgrade — the full list is in the
> "Upgrading" section below and in `CLAUDE.md`.

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

**EDS boilerplate upgrade:** Pull the latest `scripts/aem.js` and `scripts/delayed.js` (and
`head.html`, `404.html`, `styles/fonts.css`, `styles/lazy-styles.css` if you want them refreshed)
from the EDS boilerplate template. Do **not** pull `styles/styles.css` or `styles/tokens.css` —
they are ASC-authored now (see the note above). Then re-apply every ASC modification to
`scripts/scripts.js` (these are the complete set — keep this list identical to `CLAUDE.md`):
```js
// Imports:
import { ascEager, ascDecorateMain, ascLazy, ascDelayed } from './asc.js';
import { isChromeless } from './asc/core/utils/chrome.js';

// loadEager(doc):      ascEager(doc)            // theme class + is-chromeless body class
//                      addPageTypeClasses(main) // ASC-added helper; page-search/-collections/-sheet/-board
// decorateMain(main):  ascDecorateMain(main)    // LAST line, after decorateBlocks(main)
// loadLazy():          ascLazy()
//                      gate loadHeader()/loadFooter() behind `if (!isChromeless(main))`
// loadDelayed():       ascDelayed()             // before the stock delayed import
```

`addPageTypeClasses(main)` is itself an ASC-added function in `scripts.js` — re-add it too.

**ASC Core upgrade:** Replace `scripts/asc/core/` wholesale. Everything you own lives outside it
(`scripts/asc/configurations.js`, `scripts/asc.js`, `blocks/`, `styles/`, `tools/`), so it is safe
— but never overwrite `scripts/asc/configurations.js`. After replacing core, run `npm run lint`,
and confirm the imports in `scripts/asc.js` and `scripts/scripts.js` still resolve against the new
core (a core reorg can rename an export those two user-owned files deep-import).
