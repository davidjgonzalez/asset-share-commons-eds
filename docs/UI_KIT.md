# ASC UI Kit — Component Catalog

The UI Kit is the set of reusable, theme-driven UI primitives that blocks, parts, and
templates build from. **Reuse a kit primitive before writing new block CSS.**

| Resource | What it is |
|----------|-----------|
| [`/docs/ui-kit.html`](ui-kit.html) | Themed visual gallery. Toggle a theme; toggle **Show code & usage** to reveal canonical markup per element. |
| [`styles/ui-kit.css`](../styles/ui-kit.css) | The `.asc-ui-*` component primitives. Each is tagged `@kit <name>` for grepping. |
| [`styles/styles.css`](../styles/styles.css) | Foundational layer: `.btn`, form fields, `.asc-panel`, `.asc-dialog`. |
| [`styles/tokens.css`](../styles/tokens.css) | Structural tokens (radius, shadow, spacing, transitions). |

All primitives consume **semantic tokens only** (`--color-*`, `--spacing-*`,
`--border-radius-*`, `--shadow-*`, `--transition-*`), so they re-theme for free.

---

## Workflow: building / updating a block from the kit

1. **Pick primitives.** Open `/ui-kit.html`, or scan the catalog below. Decide which
   primitives compose the block (e.g. "a card grid of `asc-ui-card` with an
   `asc-ui-badge`, falling back to `asc-ui-empty-state`").
2. **Copy canonical markup** from the catalog entry (or the gallery's Copy button).
   Keep the `.asc-ui-*` / `.btn` classes; add a block-scoped class only for
   block-specific layout (grid columns, spacing between primitives).
3. **Do not restyle the primitive.** If a block needs a primitive to look different,
   that's a signal to add a variant *to the kit* (new `--modifier` in `ui-kit.css`,
   document it here, add a gallery tile) — not to override it inside the block.
4. **Workshop new primitives in the kit first.** Add the CSS to `ui-kit.css`, a tile to
   `ui-kit.html`, and an entry here; verify across themes; then deploy into blocks.

> When asked to "build block X using `asc-ui-card` + `asc-ui-empty-state`", read those
> entries here for the exact markup and class names, then assemble.

### Common compositions — block type → kit primitives

Use this table as the first lookup before reading the full catalog.

| Block type | Typical primitives |
|---|---|
| Asset grid / list results | `asc-ui-asset-card` / `asc-ui-asset-row` + `asc-ui-empty-state` + `asc-ui-skeleton` |
| Collection management | `asc-ui-card` + `asc-ui-badge` + `asc-ui-empty-state` |
| Filter dropdown | `asc-ui-control` + `asc-ui-dropdown` + `asc-ui-dropdown__list` / `__item` |
| Asset details modal | `.asc-dialog --wide` + `asc-ui-detail` + `asc-ui-actions` + `asc-ui-metadata` |
| Switcher / popover menu | `asc-ui-dropdown` + `asc-ui-menu` + `asc-ui-count` |
| Download sheet rows | `asc-ui-asset-row` + `.btn` |

---

## Catalog

Conventions: root class `.asc-ui-<name>`, BEM children `__child`, modifiers `--variant`.
"Location" is the stylesheet that defines it.

### Typography — `@kit typography` · `styles/ui-kit.css`
```html
<p class="asc-ui-heading-eyebrow">Eyebrow</p>
<h2 class="asc-ui-heading-xl">Heading XL</h2>
<h3 class="asc-ui-heading-l">Heading L</h3>
<h4 class="asc-ui-heading-m">Heading M</h4>
<p class="asc-ui-copy">Muted secondary copy.</p>
<p class="asc-ui-label">FIELD LABEL</p>
```

### Button — `.btn` · `styles/styles.css`
Variants: `--primary` `--secondary` `--ghost` `--danger`. Sizes: `--lg` / (default) / `--sm`.
Shapes: `--circle` / `--icon` (square, pair with a size). Use on `<button>` or `<a>`.
```html
<button class="btn btn--primary" type="button">Primary</button>
<button class="btn btn--secondary btn--sm" type="button">Small secondary</button>
<button class="btn btn--ghost btn--icon" type="button" aria-label="Close">✕</button>
```

### Form field — `@kit field` · `styles/ui-kit.css`
Wraps a label + control + optional hint/error. Controls inherit the global input baseline.
```html
<label class="asc-ui-field">
  <span class="asc-ui-field__label">Collection name</span>
  <input type="text" placeholder="e.g. Q1 campaign">
  <span class="asc-ui-field__hint">Shown to anyone you share with.</span>
  <!-- or: <span class="asc-ui-field__error">Required.</span> -->
</label>
```

### Switch — `@kit switch` · `styles/ui-kit.css`
Accessible on/off toggle built on a native checkbox.
```html
<label class="asc-ui-switch">
  <input type="checkbox">
  <span class="asc-ui-switch__track"><span class="asc-ui-switch__thumb"></span></span>
  <span>Include subfolders</span>
</label>
```

### Search — `@kit search` · `styles/ui-kit.css`
Pill input that grows on focus. Width via `--asc-ui-search-width`.
```html
<div class="asc-ui-search"><input type="search" placeholder="Search assets…" aria-label="Search assets"></div>
```

### Filter control + dropdown — `@kit control / dropdown` · `styles/ui-kit.css`
```html
<div class="asc-ui-control-set">
  <div class="asc-ui-control asc-ui-dropdown" data-dropdown>
    <button class="btn btn--secondary asc-ui-control-btn" type="button" aria-expanded="false" aria-controls="dd-fmt" data-dropdown-trigger>
      Format <span class="asc-ui-chevron">▾</span>
    </button>
    <div class="asc-ui-dropdown__panel" id="dd-fmt" hidden>
      <ul class="asc-ui-dropdown__list">
        <li><label class="asc-ui-dropdown__item"><input type="checkbox"> JPEG</label></li>
      </ul>
    </div>
  </div>
</div>
```

### Segmented control — `@kit segmented` · `styles/ui-kit.css`
Single-choice toggle. Sizes: `--sm` / (default) / `--lg`. Mark the active option with
`aria-pressed="true"` (or `.is-active`).
```html
<div class="asc-ui-segmented asc-ui-segmented--sm" role="group" aria-label="View">
  <button class="asc-ui-segmented__option is-active" type="button" aria-pressed="true">Grid</button>
  <button class="asc-ui-segmented__option" type="button" aria-pressed="false">List</button>
</div>
```

### Popover menu — `@kit menu` · `styles/ui-kit.css`
Menu of selectable rows / actions. Drop inside an `.asc-panel --no-pad` or
`.asc-ui-dropdown__panel`; anchor with `.asc-ui-dropdown` for a real popover. Items can be
`<button>`, `<a>`, or `<li>`. Mark the current row with `--active`. (The collection-switcher dropdown.)
```html
<ul class="asc-ui-menu">
  <li><button class="asc-ui-menu__item asc-ui-menu__item--active" type="button">
    <span class="asc-ui-menu__item-label">All Assets</span>
    <span class="asc-ui-menu__item-meta">128</span>
    <span class="asc-ui-menu__item-check">✓</span>
  </button></li>
  <li><button class="asc-ui-menu__item" type="button"><span class="asc-ui-menu__item-label">Spring Launch</span><span class="asc-ui-menu__item-meta">18</span></button></li>
</ul>
<hr class="asc-ui-menu__separator">
```

### Badge — `@kit badge` · `styles/ui-kit.css`
Status label. Default is muted. Modifiers: `--primary` `--success` `--warning` `--danger`.
```html
<span class="asc-ui-badge">Default</span>
<span class="asc-ui-badge asc-ui-badge--primary">Active</span>
<span class="asc-ui-badge asc-ui-badge--danger">Failed</span>
```

### Chip — `@kit chip` · `styles/ui-kit.css`
Static tag / token (asset tag, active facet label). Not removable.
```html
<span class="asc-ui-chip">Campaign</span>
```

### Count pill — `@kit count` · `styles/ui-kit.css`
Small numeric pill (e.g. active-collection count on the switcher trigger). Modifier: `--muted`.
```html
<span class="asc-ui-count">3</span>
<span class="asc-ui-count asc-ui-count--muted">0</span>
```

### Card — `@kit card` · `styles/ui-kit.css`
Generic surface. Modifiers: `--interactive` (hover), `--active` (selected).
Slots: `__header` `__title` `__body` `__footer`.
```html
<article class="asc-ui-card asc-ui-card--interactive">
  <div class="asc-ui-card__header">
    <h3 class="asc-ui-card__title">Spring Launch</h3>
    <span class="asc-ui-badge asc-ui-badge--primary">Active</span>
  </div>
  <div class="asc-ui-card__body"><p class="asc-ui-copy">18 assets · updated 2h ago</p></div>
  <div class="asc-ui-card__footer">
    <a class="btn btn--primary btn--sm" href="#">Open</a>
    <button class="btn btn--ghost btn--sm" type="button" style="margin-inline-start:auto;">Delete</button>
  </div>
</article>
```

### Collection card — `@kit collection-card` · `styles/ui-kit.css`
Preview tile with name row + 4-up thumb grid. Children: `__row` `__meta` `__thumbs` `__thumb`.

### Asset row — `@kit asset-row` · `styles/ui-kit.css`
Compact horizontal asset row (list view). Children: `__thumb` `__title` `__meta`.

### Asset card — `@kit asset-card` · `styles/ui-kit.css`
Vertical asset tile: thumbnail + title + metadata. Modifier: `--interactive`.
Slots: `__thumb` (put `<img>` or `.asc-ui-filetype` inside), `__badge`, `__overlay`
(hover actions), `__body` / `__title` / `__meta`, `__footer`.
```html
<article class="asc-ui-asset-card asc-ui-asset-card--interactive">
  <div class="asc-ui-asset-card__thumb">
    <span class="asc-ui-asset-card__badge"><span class="asc-ui-badge asc-ui-badge--primary">In collection</span></span>
    <img src="…" alt="…">
  </div>
  <div class="asc-ui-asset-card__body">
    <p class="asc-ui-asset-card__title">Summer Campaign Hero</p>
    <p class="asc-ui-asset-card__meta">JPEG · 4.2 MB · 1200 × 800</p>
  </div>
</article>
```

### Thumbnail — `@kit thumb` · `styles/ui-kit.css`
Small fixed-size asset thumbnail for dense contexts (table cells, list rows, menus).
Size via `--asc-ui-thumb-size` (default 2.5rem). Put an `<img>` inside, or leave empty as a placeholder.
```html
<span class="asc-ui-thumb"><img src="…" alt="…"></span>
```

### File-type placeholder — `@kit filetype` · `styles/ui-kit.css`
Stand-in for assets with no image preview (PDF, video, doc). Drop inside a thumb.
```html
<div class="asc-ui-filetype"><span class="asc-ui-filetype__glyph">📄</span><span class="asc-ui-filetype__ext">PDF</span></div>
```

### Labeled action bar — `@kit actions` · `styles/ui-kit.css`
Stacked icon + text so each option is self-explanatory. Action variants: `--primary`, `--danger`.
```html
<div class="asc-ui-actions">
  <button class="asc-ui-action asc-ui-action--primary" type="button">
    <span class="asc-ui-action__icon"><!-- svg icon --></span>
    <span>Download</span>
  </button>
  <button class="asc-ui-action" type="button">
    <span class="asc-ui-action__icon"><!-- svg icon --></span>
    <span>Add to collection</span>
  </button>
</div>
```

### Metadata — `@kit metadata` · `styles/ui-kit.css`
Asset property pairs. Default = stacked rows (sidebar); `--grid` = responsive cells (wide panel).
Markup is a `<dl>` with each pair wrapped in a `__row` div.
```html
<dl class="asc-ui-metadata">
  <div class="asc-ui-metadata__row"><dt class="asc-ui-metadata__term">Format</dt><dd class="asc-ui-metadata__value">JPEG</dd></div>
  <div class="asc-ui-metadata__row"><dt class="asc-ui-metadata__term">Size</dt><dd class="asc-ui-metadata__value">4.2 MB</dd></div>
</dl>
```

### Color swatch — `@kit swatch` · `styles/ui-kit.css`
Pill-shaped color tags — a color circle on the left, label on the right, fully rounded border.
Used to display `dam:colorDistribution` dominant colors. Set `--asc-ui-swatch-color` inline
on each `.asc-ui-swatch`. The `colors` custom property in `configurations.js` returns the
ready-to-render HTML string.
```html
<span class="asc-ui-swatch-list">
  <span class="asc-ui-swatch" style="--asc-ui-swatch-color:#a5d9e3"><span class="asc-ui-swatch__dot"></span><span class="asc-ui-swatch__label">Cyan</span></span>
  <span class="asc-ui-swatch" style="--asc-ui-swatch-color:#0b5c5b"><span class="asc-ui-swatch__dot"></span><span class="asc-ui-swatch__label">Dark green</span></span>
</span>
```

### Filmstrip — `@kit filmstrip` · `styles/ui-kit.css`
Horizontal scroll-snap strip of related assets. Each `__item` holds a fixed-width tile/card.
```html
<div class="asc-ui-filmstrip">
  <div class="asc-ui-filmstrip__item"><article class="asc-ui-asset-card">…</article></div>
</div>
```

### Detail layout — `@kit detail` · `styles/ui-kit.css`
Two-pane asset layout (large preview + metadata aside). Use inside `.asc-dialog__body`
(asset overlay) or a details page section. Stacks on mobile, two-column ≥768px. Add
stacked `__section` blocks (with `__section-title`) below for renditions, similar, etc.
```html
<div class="asc-dialog__body">
  <div class="asc-ui-detail">
    <div class="asc-ui-detail__preview"><img src="…" alt="…"></div>
    <div class="asc-ui-detail__aside"><!-- asc-ui-actions + asc-ui-metadata --></div>
  </div>
  <section class="asc-ui-detail__section">
    <h3 class="asc-ui-detail__section-title">Renditions</h3>
    <!-- e.g. asc-ui-table of download options -->
  </section>
  <section class="asc-ui-detail__section">
    <h3 class="asc-ui-detail__section-title">Similar assets</h3>
    <!-- e.g. asc-ui-filmstrip -->
  </section>
</div>
```

### Table — `@kit table` · `styles/ui-kit.css`
```html
<div class="asc-ui-table-wrap">
  <table class="asc-ui-table"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>…</td></tr></tbody></table>
</div>
```

### Masonry — `@kit masonry` · `styles/ui-kit.css`
Column-flow gallery. `__item` > `__photo` (`--tall` / `--wide` / `--square`) + `__actions` (`asc-ui-icon-btn`).

### Empty state — `@kit empty-state` · `styles/ui-kit.css`
```html
<div class="asc-ui-empty-state">
  <span class="asc-ui-empty-state__icon">📁</span>
  <p class="asc-ui-empty-state__title">No collections yet</p>
  <p class="asc-ui-empty-state__hint">Create a collection to start building a set of assets.</p>
  <div class="asc-ui-empty-state__actions"><button class="btn btn--primary btn--sm" type="button">New</button></div>
</div>
```

### Spinner — `@kit spinner` · `styles/ui-kit.css`
Size via `--asc-ui-spinner-size`. Add `role="status"` + `aria-label`.
```html
<span class="asc-ui-spinner" role="status" aria-label="Loading"></span>
```

### Skeleton — `@kit skeleton` · `styles/ui-kit.css`
Shimmer placeholder. Modifiers: `--text` `--title` `--thumb` `--circle`.
```html
<span class="asc-ui-skeleton asc-ui-skeleton--thumb"></span>
<span class="asc-ui-skeleton asc-ui-skeleton--title"></span>
<span class="asc-ui-skeleton asc-ui-skeleton--text"></span>
```

### Panel — `.asc-panel` · `styles/styles.css`
Floating popover/sheet. Modifiers: `--scroll` `--no-pad`. Slots: `__header` `__body` `__footer`.

### Dialog — `.asc-dialog` · `styles/styles.css`
Native `<dialog>` modal. Modifiers: `--narrow` (compact) and `--wide` (large asset overlay —
pair with `asc-ui-detail`). Slots: `__header`/`__header-main`/`__title`/`__description`/`__close`,
`__body`, `__footer`/`__footer-end`. See AGENTS.md → Modal Pattern.

### Icon button — `@kit icon-btn` · `styles/ui-kit.css`
Circular icon-only button for card/photo overlays. (For form/toolbar buttons use `.btn--circle`.)

---

## Adding a primitive (checklist)

- [ ] CSS in `styles/ui-kit.css`, tagged `@kit <name>`, tokens only — no raw values.
- [ ] Tile in `ui-kit.html` (rendered demo + `data-snippet` so the code panel auto-fills).
- [ ] Catalog entry above (markup + variants + location).
- [ ] Verify across all themes via the gallery theme switcher.
- [ ] Run `npm run lint:css`.
