# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Asset Share Commons (ASC) is an AEM Edge Delivery Services (EDS) front-end for a digital asset management and sharing platform. It connects to AEM DAM for asset search, details, renditions, and collection/cart management. Built on the AEM EDS boilerplate — no build step, vanilla JS ES modules, deployed via AEM's CDN.

## Commands

```bash
npm run lint        # Lint JS (ESLint) and CSS (StyleLint)
npm run lint:js     # JS only
npm run lint:css    # CSS only
npm run lint:fix    # Auto-fix lint issues
aem up              # Start local dev proxy at http://localhost:3000
```

## Ownership Boundary — Critical

```
scripts/
  asc.js                ← USER-OWNED: ASC integration entry point (lifecycle hooks)
  asc/                  ← USER-OWNED: user-facing ASC files
    configurations.js   ← USER-OWNED: all site configuration
    section-grid.js     ← USER-OWNED: section grid utility
    tokens.js           ← USER-OWNED: content variable resolver
    html.js             ← USER-OWNED: HTML helpers
    core/               ← ASC CORE: do not edit; all files begin with "// ASC Core"
      services/
      models/
      utils/
      parts/
blocks/                 ← USER-OWNED: copy/modify blocks freely
  action-*/             ← USER-OWNED: action blocks loaded by the action-pages service
styles/                 ← USER-OWNED: themes and CSS variables
```

Every file in `scripts/asc/core/` starts with `// ASC Core — do not edit.` as a signal. Users customize via `scripts/asc/configurations.js` and `scripts/asc.js` only.

## Architecture

### Page Lifecycle (scripts/aem.js + scripts/scripts.js)

EDS runs three phases on every page load:
1. **`loadEager()`** — critical path: template/theme decoration, first section
2. **`loadLazy()`** — remaining sections, header/footer, lazy styles
3. **`loadDelayed()`** — runs after 3s; analytics, non-critical work

ASC services auto-initialize when `scripts/asc.js` is imported; no explicit init calls needed.

> **`scripts/scripts.js` is boilerplate, but ASC modifies it** — re-apply these after any EDS
> boilerplate upgrade:
>
> - `import { ascEager, ascDecorateMain, ascLazy, ascDelayed } from './asc.js';`
> - `loadEager()` calls `ascEager(doc)` — applies theme class and loads theme CSS, and sets the
>   `is-chromeless` body class (see below) as early as possible
> - `decorateMain()` calls `ascDecorateMain(main)` **after `decorateBlocks`** — runs token
>   substitution and wires the named-area `_layout: grid` section grid
> - `loadLazy()` calls `ascLazy()` and `loadDelayed()` calls `ascDelayed()` (hooks for future use)
> - `addPageTypeClasses(main)` (called from `loadEager()`) adds `page-search` / `page-collections`
>   / `page-sheet` / `page-board` body classes based on which blocks are present
> - `loadLazy()` gates `loadHeader()`/`loadFooter()` on `import { isChromeless } from
>   './asc/chrome.js'` rather than loading them unconditionally — see "Chrome Duality" below

### Chrome Duality (Branded vs. Standalone Shares)

Any share/sheet/board page can render **branded** (full site header/footer/nav) or
**standalone** (none of it — reads as a discrete microsite, no way back into the site via the
UI). Presentational only — it hides navigation, not AEM/DAM permissions. Resolution logic lives
in `scripts/asc/chrome.js` (`isChromeless()`): `?chrome=full`/`?chrome=none` override anything;
otherwise `<meta name="chrome" content="none">` (authored, for fixed/authored shares) or a
`.sheet` block / `?sheet=` param (ad hoc personal shares — this has always been their default)
decide it. The "Share as a standalone page" switch in `blocks/action-share` makes that default an
explicit per-share choice by appending `&chrome=none`/`&chrome=full` to the generated URL. Any
custom "back to X" link authored into share-page content should carry `data-asc-nav-link` (see
`docs/starter-kit/sheet.html`) so it's hidden the same way header/footer are. Full authoring
details in `docs/starter-kit/README.md`.

### Core Layers

```
Blocks (UI)          /blocks/
  ↓ uses
Parts (reusable UI)  /scripts/asc/core/parts/
  ↓ uses
Services             /scripts/asc/core/services/   (search, aem, collections, renditions, etc.)
  ↓ uses
Models               /scripts/asc/core/models/     (Asset, Rendition, User)
  ↓ uses
Utils                /scripts/asc/core/utils/      (events, blocks, search, fragments)
```

### Blocks

Each block lives in `blocks/<name>/<name>.js` + `<name>.css`. The JS exports a default `decorate(block)` function called by EDS. Block CSS uses `.block.<block-name>` as the root selector with CSS nesting.

### Parts

Parts (`/scripts/asc/core/parts/`) are reusable UI components shared across blocks (e.g., `AssetTeaser`). Rules:
- Constructor receives `{ block }` — the parent block element for event delegation
- Never bind events directly; always use `delegateEvent(this.block, ...)` to prevent duplicates
- `html()` method returns an HTML string; the block inserts it

### Services

Services handle business logic. Each is a singleton initialized on import. Key services:
- `search` — orchestrates search via a configurable **provider** (`querybuilder` or `openapi`)
- `aem` — AEM host/URL management + auth headers
- `collections` — cart/collection state (persisted in localStorage)
- `assetDetails` — opens URL-addressable modal, resolves MIME-type-based templates
- `users` — IMS/SSO detection, provides `getAuthHeaders()` for AEM API calls
- `renditions` — rendition definition lookup
- `properties` — pluggable asset property handlers
- `actionPages` — intercepts clicks on `/actions/*` links, loads the matching `action-*` block as a modal dialog

### Action Pages

A convention for link-triggered action dialogs. Any `<a href="/actions/foo">` is intercepted by
the `actionPages` service, which:
1. Fetches `/actions/foo.plain.html` (DA-authored dialog content)
2. Creates a detached `action-foo` block element with that content
3. Calls EDS `loadBlock()` — which imports and runs `blocks/action-foo/action-foo.js`
4. The block's `decorate()` builds and opens a `<dialog>` modal

Context is passed via `window.asc.pendingAction` (read at the top of `decorate()`, before any
`await`). The `actionPages` service also collects `data-action-*` attributes from the clicked
element and its ancestors.

From blocks, trigger actions programmatically:
```js
import { triggerAction } from '../../scripts/asc.js';
triggerAction('/actions/download', { collectionId: collection.id });
```

Utilities exported from `scripts/asc.js`:
- `triggerAction(href, ctx)` — trigger an action programmatically
- `parseActionFragment(blockEl, ctx)` — parse DA sections into `{ title, bodyNodes, fields, renditionLabel, renditionIds, actions }`
- `wireDialogClose(dialog)` — wire `[data-dialog-close]` buttons and backdrop click to `dialog.close()`

Configure the root path in `scripts/asc/configurations.js`:
```js
// actions: { root: '/actions' }  // default
```

### Search Provider Abstraction

`SearchService` delegates all API calls to a provider:
- `scripts/asc/core/services/search/providers/querybuilder.js` — AEM QueryBuilder (default)
- `scripts/asc/core/services/search/providers/openapi.js` — AEM Dynamic Media OpenAPI Search

Switch providers in `scripts/asc/configurations.js`: `search: { provider: 'openapi' }`.

### Asset Details Modal

- Opens with URL param: `?asset={uuid}` (shareable deep-link)
- Auto-opens on page load if `?asset` param is present
- On close, removes `?asset` from URL
- Template loaded per MIME type from `configurations.assetDetails.templates`

### Event Convention

All events: `asc:{noun}:{verb}` pattern with colon separators.

| Scope | Where events are delegated |
|-------|---------------------------|
| Search events | `document` |
| Cross-block common | `document.body` |
| Block-specific | The block's `.block` element |
| Part events | Parent block element via `delegateEvent()` |

See `AGENTS.md` for the full event reference table.

### Declarative Actions

Blocks wire up behavior via data attributes — no direct JS coupling:
- `data-asc-action="noun:verb@event"` e.g. `"asset:details:open@click asset:preload@mouseover"`
- `data-asc-asset="<uuid>"` — asset reference passed through the DOM
- `data-asc-collection="<id>"` — collection reference

### Global Cache

```js
window.asc = { cache: { assets: new Map() } }
```

Asset instances are cached by UUID here to avoid redundant fetches.

## UI Kit — mandatory, not optional

**Every block must be composed from UI Kit primitives.** Do not write bespoke CSS for
anything already covered by the kit. This is a hard rule, not a preference.

**Three rules — memorize these before touching a block:**

1. Before writing any block CSS, scan `docs/UI_KIT.md` for a matching primitive.
2. Compose blocks from kit primitives; add only layout CSS (grid columns, gaps) at the block level.
3. If a primitive needs to look different in one block, add a variant *to the kit first*
   (CSS + gallery tile + catalog entry), then use it. Never override kit styles inside a block.

The kit is theme-driven (`.asc-ui-*` + `.btn`) and lives in `styles/ui-kit.css` (plus
`.btn`/`.asc-panel`/`.asc-dialog` in `styles.css`).

- **Catalog (agent source of truth):** `docs/UI_KIT.md` — every primitive's class, markup, variants.
- **Gallery (visual workshop):** `docs/ui-kit.html` — themed, with toggleable per-element code/usage.
- **Build-block skill:** use `/build-block` for a structured, kit-first block workflow.

If the user names specific kit elements, read those entries in `docs/UI_KIT.md` for exact markup.
Need a new primitive? Workshop it in the kit first, then deploy into blocks.

## Block Authoring Registration — mandatory

**Every new author-placed block must be registered in the DA.live block library before it's
considered done.** This is a hard requirement, not a nice-to-have — a block that only exists as
code is not authorable by content editors. Authoring in this project is DA.live / Experience
Workspace only — there is no Universal Editor integration (no `component-definition.json` /
`component-models.json` / `component-filters.json`).

Skip this for blocks that are never placed via the section canvas (invoked programmatically, e.g.
`action-*` blocks driven by the actions service) and for stock EDS boilerplate (`columns`,
`content`, `header`, `footer`, `fragment`) — those stay code-only.

**DA.live block library**: add an example document under `/blocks/<block-name>` (DA content, not
this repo) showing the block's real authored markup, then add a `{ name, path }` row for it to
the `library/blocks` sheet. `path` is the `https://content.da.live/{org}/{site}/...` source link.
See `https://docs.da.live/administrators/guides/setup-library` for the full mechanism — the
library sheet is registered once in the site's `config.json` (`library` tab, `Blocks` row pointing
at the published `library/blocks.json`); adding a new block only means adding a row to the
existing sheet and creating its example doc.

New documents/sheets must be **previewed and published** (via Sidekick, or the Admin API) to take
effect — creating the DA source alone does not update the live `.json` the library reads.

This applies even when the block is only used inside a fragment (e.g. the asset-details modal) —
the library needs to know about it regardless of where it's ultimately placed.

## CSS Conventions (see docs/CSS_CONVENTION.md)

- Root selector: `.block.<block-name> { ... }` — never a bare class
- Use CSS nesting for child elements and modifiers
- Use CSS variables for all colors, spacing, typography, shadows, transitions
- Mobile-first responsive: `@media (width >= 768px)` syntax
- Themes in `styles/themes/` override CSS variables only; add new themes there

## Code Style

- JavaScript: 2-space indent, ES6+ modules, airbnb-base ESLint
- CSS: 4-space indent, stylelint-config-standard
- Line endings: Unix (LF)

## Key Reference Files

| File | Purpose |
|------|---------|
| `scripts/asc/configurations.js` | All user configuration — start here |
| `scripts/asc.js` | ASC entry point — lifecycle hooks + action-page utilities |
| `scripts/asc/core/services/services.js` | All service singletons exported together |
| `scripts/asc/core/utils/events.js` | `delegateEvent()` — use for all event binding |
| `AGENTS.md` | Full event/attribute/parts/provider reference for AI assistants |
| `docs/PROJECT_STRUCTURE.md` | Ownership zones — EDS boilerplate vs ASC Core vs user-owned |
| `docs/CSS_CONVENTION.md` | Full CSS coding standards |
| `docs/CONTENT_VARIABLES.md` | `{{ }}` token system — page-wide registry vs per-asset resolution, full API + authoring examples |
| `docs/ANALYTICS.md` | Web analytics plan — event catalog mapping, vendor wiring, `scripts/asc/analytics.js` |
