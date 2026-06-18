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

> **`scripts/scripts.js` is boilerplate, but ASC modifies it** — it imports ASC services and
> calls `resolvePageTokens()` + `decorateGridLayouts()` in `decorateMain()`. Re-apply these
> modifications after any EDS boilerplate upgrade.

---

### ASC Core — do not edit

The ASC framework layer. Every file begins with `// ASC Core — do not edit.` as a signal.
These files are maintained by the ASC project and will be replaced wholesale when upgrading
ASC. Customise behaviour via `configurations.js` only — not by editing core files directly.

```
scripts/asc/
  services/       — business logic (search, AEM, collections, renditions, users, …)
  models/         — Asset, Rendition, User data models
  utils/          — shared utilities (events, blocks, search, fragments)
  parts/          — reusable UI components (AssetTeaser, …)
```

---

### User-owned — customize freely

Everything here is yours. Copy, modify, and extend without worrying about upstream conflicts.
These files are intentionally outside `scripts/asc/` so you can change them.

#### Configuration

| File | Purpose |
|------|---------|
| `scripts/configurations.js` | **Start here.** AEM host, search provider, themes, renditions, collections, custom properties, asset details templates — all user config lives here |

#### Blocks

```
blocks/
  <block-name>/
    <block-name>.js    — exports default decorate(block)
    <block-name>.css   — block styles, rooted at .block.<block-name>
```

Copy a block from the ASC starter kit or create your own. The only rule: export
`default function decorate(block)` and follow the kit-first CSS conventions.

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
| `scripts/section-grid.js` | Named-area CSS grid for section metadata. Call `decorateGridLayouts(main)` in `decorateMain()` after `decorateBlocks` |
| `scripts/tokens.js` | `{{ accessor \| fallback }}` content variable resolver. Called as `resolvePageTokens(main)` before `decorateBlocks` |
| `scripts/html.js` | Shared HTML helpers: `escHtml`, `escAttr`, `formatUpdated` — import into any block that builds HTML strings |
| `scripts/extract-design-tokens.js` | Dev utility — extracts token values for tooling/docs |

#### Content pages and demos

| File | Purpose |
|------|---------|
| `details.html` | ASC default asset details page template |
| `*-demo.html` | Local dev demo pages for blocks and themes |
| `search-example.html`, `header-test.html` | Dev test pages |

---

## File-by-File Quick Reference

```
/
├── scripts/
│   ├── aem.js                  EDS boilerplate
│   ├── scripts.js              EDS boilerplate (ASC-modified)
│   ├── delayed.js              EDS boilerplate
│   ├── configurations.js       USER — only config file you need
│   ├── section-grid.js         USER — section grid utility
│   ├── tokens.js               USER — content variable resolver
│   ├── html.js                 USER — escHtml / escAttr / formatUpdated
│   ├── extract-design-tokens.js USER — dev tooling
│   └── asc/                    ASC CORE — do not edit
│       ├── services/
│       ├── models/
│       ├── utils/
│       └── parts/
│
├── blocks/                     USER — all blocks live here
│   └── <block>/
│       ├── <block>.js
│       └── <block>.css
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
| Lives in `scripts/asc/` | ASC Core |
| Named `aem.js`, `scripts.js`, `delayed.js` | EDS boilerplate |
| Lives in `blocks/` | User-owned |
| Lives in `styles/themes/` or `styles/sections/` | User-owned |
| `scripts/configurations.js` | User-owned |

---

## Upgrading

**EDS boilerplate upgrade:** Pull the latest `scripts/aem.js`, `scripts/scripts.js`,
`styles/styles.css`, etc. from the EDS boilerplate template. Then re-apply the ASC
modifications to `scripts/scripts.js` (imports and `decorateMain` calls — documented in
`CLAUDE.md` and `AGENTS.md`).

**ASC Core upgrade:** Replace `scripts/asc/` wholesale. Your customizations live outside
that directory, so they are safe.
