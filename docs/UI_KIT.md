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
| Board canvas | `asc-ui-asset-card` (cards) + `asc-ui-segmented` (toolbar — default size, no modifier); search `<input>` lives inside the segmented as the last child, styled via block-scoped `.board__search` |
| Color-search control | `asc-ui-dropdown` + `asc-ui-color-picker` (input + presets) |
| Notification toast | `asc-ui-toast-region` + `asc-ui-toast` — rendered by `scripts/asc/notifications.js`, never hand-built in a block |

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
Accessible on/off toggle built on a native checkbox. Always include `role="switch"` and `aria-checked` on the `<input>` so assistive technology announces on/off state correctly.
```html
<label class="asc-ui-switch">
  <input type="checkbox" role="switch" aria-checked="false">
  <span class="asc-ui-switch__track"><span class="asc-ui-switch__thumb"></span></span>
  <span>Include subfolders</span>
</label>
```

### Search — `@kit search` · `styles/ui-kit.css`
Pill input that grows on focus. Width via `--asc-ui-search-width`. Wrap in `role="search"` so AT users can navigate to the search landmark.
```html
<div class="asc-ui-search" role="search"><input type="search" placeholder="Search assets…" aria-label="Search assets"></div>
```

**In-field action button** — `.asc-ui-search__action`, an optional slot for a single button/dropdown
inside the pill (right-aligned, vertically centered). Its presence auto-reserves input padding via
a `:has()` rule, so plain search inputs elsewhere are unaffected. Put your own positioned trigger
(e.g. an `.asc-ui-dropdown`) *inside* the slot rather than on it directly — the slot owns the
absolute positioning, and layering another `position` on the same element would fight it. Used by
the search-bar color-search control.
```html
<div class="asc-ui-search">
  <input type="search" placeholder="Search assets…" aria-label="Search assets">
  <div class="asc-ui-search__action">
    <div class="asc-ui-dropdown">
      <button type="button" aria-expanded="false">…</button>
      <div class="asc-ui-dropdown__panel" hidden>…</div>
    </div>
  </div>
</div>
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

**Native popover mode** — where supported (`'popover' in HTMLElement.prototype`), the panel can
use `popover="auto"` + a `popovertarget` trigger instead of a manual `hidden` toggle, getting
native open/light-dismiss/Escape handling for free; `styles/ui-kit.css` resets just the UA
popover positioning defaults so the panel keeps its usual `.asc-ui-dropdown__panel` look. Fall
back to the manual `hidden`-attribute pattern above on unsupported browsers. See the search-bar
color-search control for the feature-detected implementation.

### Segmented control — `@kit segmented` · `styles/ui-kit.css`
Single-choice toggle. Sizes: `--sm` / (default) / `--lg`. Mark the active option with
`aria-pressed="true"` (or `.is-active`).
```html
<div class="asc-ui-segmented asc-ui-segmented--sm" role="group" aria-label="View">
  <button class="asc-ui-segmented__option is-active" type="button" aria-pressed="true">Grid</button>
  <button class="asc-ui-segmented__option" type="button" aria-pressed="false">List</button>
</div>
```

**Embedding an input** — place a bare `<input>` as the last child of the segmented container (no `asc-ui-segmented__option`). Style it with `border: none; border-left: 1px solid var(--color-border); background: transparent` so it reads as part of the bar. The board block uses this pattern for its inline search field (`.board__search`).

**Icon variant** — add `asc-ui-segmented--icon` for icon-only controls. Each option renders as a bordered circle: inactive = white, active = muted grey. Use square padding (or override at block level) so the options are circular. The `search-bar` block uses this pattern.
```html
<div class="asc-ui-segmented asc-ui-segmented--sm asc-ui-segmented--icon" role="group" aria-label="View">
  <button class="asc-ui-segmented__option is-active" type="button" aria-pressed="true" aria-label="Masonry view"><!-- svg --></button>
  <button class="asc-ui-segmented__option" type="button" aria-pressed="false" aria-label="Cards view"><!-- svg --></button>
  <button class="asc-ui-segmented__option" type="button" aria-pressed="false" aria-label="List view"><!-- svg --></button>
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

**Header row** — `.asc-ui-menu__header`, a light-grey uppercase label above the items (a sibling
before the `<ul class="asc-ui-menu">`, inside the same panel). Used by the rendition picker
(`scripts/asc/rendition-download-menu.js`) to label what the menu's choices apply to, e.g.
"Downloads" or "Copy URL".
```html
<div class="asc-ui-menu__header">Downloads</div>
<ul class="asc-ui-menu">…</ul>
```

### Badge — `@kit badge` · `styles/ui-kit.css`
Status label. Default is muted. Modifiers: `--primary` `--success` `--warning` `--danger`.
```html
<span class="asc-ui-badge">Default</span>
<span class="asc-ui-badge asc-ui-badge--primary">Active</span>
<span class="asc-ui-badge asc-ui-badge--danger">Failed</span>
```

### Corner ribbon — `@kit corner-ribbon` · `styles/ui-kit.css`
Diagonal one-word banner across a container's top-left corner (e.g. flagging a card with a
status). Host element needs `position: relative` (or `absolute`) and `overflow: hidden` to
clip the ribbon's overhang — most cards already have both. Purely decorative: mark it
`aria-hidden="true"`.
```html
<article class="asc-ui-card" style="position: relative; overflow: hidden;">
  <span class="asc-ui-corner-ribbon" aria-hidden="true">Notes</span>
  ...
</article>
```

### Toast — `@kit toast` · `styles/ui-kit.css`
Notification feedback, rendered by `scripts/asc/notifications.js` — don't hand-build this markup
in a block; call `notify(message, { type })` or dispatch `asc:notification:show` on `document`
instead (see AGENTS.md's event table). `.asc-ui-toast-region` is a fixed corner anchor (one of 6
position modifiers); toasts stack inside it, newest nearest the screen edge for bottom regions.
Modifiers on `.asc-ui-toast`: `--success` `--warning` `--danger` (omit for the neutral/info style).
The message is also mirrored onto `data-asc-message` on the toast root (in addition to the
`.asc-ui-toast__message` text node) — for tests/automation or analytics hooks that want the
message without walking into child nodes.
```html
<div class="asc-ui-toast-region asc-ui-toast-region--bottom-right" role="status" aria-live="polite">
  <div class="asc-ui-toast asc-ui-toast--success" data-asc-message="Download ready">
    <span class="asc-ui-toast__icon" aria-hidden="true">…</span>
    <span class="asc-ui-toast__message">Download ready</span>
    <button type="button" class="btn btn--ghost btn--icon btn--sm asc-ui-toast__dismiss" aria-label="Dismiss">…</button>
  </div>
</div>
```

### Chip — `@kit chip` · `styles/ui-kit.css`
Static tag / token (asset tag, active facet label).
```html
<span class="asc-ui-chip">Campaign</span>
```

**Removable variant** — use a `<button>` element; set `aria-label` to describe the remove action:
```html
<button type="button" class="asc-ui-chip asc-ui-chip--removable" aria-label="Remove Campaign">
  Campaign
  <span class="asc-ui-chip__remove" aria-hidden="true">&#x2715;</span>
</button>
```

**"View more" disclosure** — for a long chip list, generated by `renderPropertyValue()`
(`scripts/asc/html.js`) and consumed by `details-asset-metadata` / `details-rendition-metadata`;
neither block needs its own CSS for this. `display: contents` on `__chip-extras` keeps the extra
chips participating in the parent's own `flex-wrap` layout rather than boxed in a sub-container:
```html
<span class="asc-ui-chip-list">
  <span class="asc-ui-chip">outdoors</span>
  <span class="asc-ui-chip">travel</span>
  <span class="asc-ui-chip-extras is-hidden">
    <span class="asc-ui-chip">mountain</span>
    <span class="asc-ui-chip">sunset</span>
  </span>
</span>
<button class="asc-view-more-btn" type="button" aria-expanded="false" data-extras-count="2">View more (2)</button>
```

Toggle: flip `is-hidden` on `.asc-ui-chip-extras`, flip `aria-expanded` on the button, and swap
its label between `View more (N)` and `View less` — see the click handler in either consuming
block's JS for the exact wiring.

### Count pill — `@kit count` · `styles/ui-kit.css`
Small numeric pill (e.g. active-collection count on the switcher trigger). Modifier: `--muted`.
```html
<span class="asc-ui-count">3</span>
<span class="asc-ui-count asc-ui-count--muted">0</span>
```

### Card — `@kit card` · `styles/ui-kit.css`
Generic surface. Modifiers: `--interactive` (hover), `--active` (selected), `--compact`
(tighter `--spacing-sm` padding instead of the default `--spacing-md` — for dense grids of
small cards, e.g. `details-renditions`' format-picker cards).
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
Adaptive mosaic for collection preview, bounded to 5 columns × 3 rows (15 visible thumbnails
max). Row/column counts are computed per-instance from the actual asset count (never a fixed
bucket) and passed in as inline custom properties: `--collection-card-mosaic-height` on
`__thumbs`, `--collection-card-row-cols` on each `__thumb-row`. Each row is its own mini-grid
sized to exactly the thumbnails it holds, so a trailing partial row never leaves empty cells —
those thumbnails just render wider instead. Fewer assets overall → taller mosaic → bigger
thumbnails (1–5 assets render as a single row). Collections with more than 15 assets show a
`__thumb-more` "+N" overlay on the last visible thumbnail.

Cells are `asc-ui-skeleton` while loading; remove the class and append an `<img>` once the thumbnail URL is available.
Children: `__thumbs` → one or more `__thumb-row` → `__thumb` (last one optionally holding `__thumb-more`).
```html
<!-- 4 assets: single row, big thumbnails -->
<div class="asc-ui-collection-card__thumbs" style="--collection-card-mosaic-height: 260px">
  <div class="asc-ui-collection-card__thumb-row" style="--collection-card-row-cols: 4">
    <div class="asc-ui-collection-card__thumb asc-ui-skeleton"></div>
    <div class="asc-ui-collection-card__thumb asc-ui-skeleton"></div>
    <div class="asc-ui-collection-card__thumb asc-ui-skeleton"></div>
    <div class="asc-ui-collection-card__thumb asc-ui-skeleton"></div>
  </div>
</div>

<!-- 7 assets: 4 + 3, no empty cells — the 3-item row's thumbnails render wider -->
<div class="asc-ui-collection-card__thumbs" style="--collection-card-mosaic-height: 220px">
  <div class="asc-ui-collection-card__thumb-row" style="--collection-card-row-cols: 4">
    <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
    <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
    <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
    <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
  </div>
  <div class="asc-ui-collection-card__thumb-row" style="--collection-card-row-cols: 3">
    <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
    <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
    <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
  </div>
</div>

<!-- 20 assets: capped at 15 visible, "+5" badge on the last thumbnail -->
<div class="asc-ui-collection-card__thumb">
  <img src="…" alt="">
  <span class="asc-ui-collection-card__thumb-more">+5</span>
</div>
```

### Asset row — `@kit asset-row` · `styles/ui-kit.css`
Compact horizontal asset row (list view). Children: `__thumb` `__title` `__meta`.

### Asset card — `@kit asset-card` · `styles/ui-kit.css`
Vertical asset tile: thumbnail + title + metadata. Modifiers: `--interactive`, `--natural`,
`--horizontal`, `--lg`, `--hero`.
Slots: `__thumb` (put `<img>`, `.asc-ui-filetype`, or a collection-card mosaic inside), `__badge`,
`__overlay` (hover actions, top-right) / `__overlay--bottom` (a second slot, bottom-right — e.g.
pairing a top-right remove action with a bottom-right secondary one), `__body` / `__title` /
`__meta`, `__footer`.

`--natural` shows the thumb image at its own native aspect ratio, never cropped — no
fixed `aspect-ratio` on the thumb, no `object-fit` crop. Use for preview-first contexts
where items don't share a uniform shape (e.g. the board canvas); typically paired with
no `__body`/`__footer` at all so the card is just the image.

`--horizontal` turns `__thumb` into a fixed-width column (42%, `min-height: 150px`) on the
left, with `__body` filling the rest and centering vertically — a wide teaser format where
the description needs room. `--lg` bumps title/body sizing for a bigger, more prominent
tile; combine the two for a wide featured teaser. Put a **collection-card mosaic** (below)
in `__thumb` instead of a single `<img>` to preview several assets at once — this is the
pattern used for `teaser` teasers. A single `<img>` fills the thumb completely
(width + height); a mosaic only has its *width* forced to 100% — its height stays whatever
its own inline `--collection-card-mosaic-height` says, so the **whole card's height is free
to grow with it**. `teaser` deliberately computes that height per row count itself
(rather than reusing the collection-card's own, much milder height table) specifically so
a 2-asset press kit and a 40-asset photo library don't read as the same size — drop cards
built this way into a plain grid with `align-items: start` (not the default `stretch`) so
each keeps its own natural height instead of being stretched to match taller neighbors.

`--hero` goes further still than `--lg` — a bigger thumb proportion (58%; no extra
`min-height` of its own beyond `--horizontal`'s 150px floor, so a mosaic's own row-count
height determines the box exactly, with no empty space letterboxing it top/bottom), a
larger title (`heading-font-size-l`), and roomier body copy/padding. It's meant for the one
"here's the headline share" tile at the top of a directory, combined with `--horizontal`
(`--hero` only tunes proportions/typography; it doesn't redefine the thumb/body layout).
Spanning the full row/grid width is a *layout* decision for whatever container the card
sits in — not part of the card itself. A `Teaser (Hero)` renders one plain teaser (see the
block's own header comment); arranging it full-width **before** a grid of regular `Teaser`
blocks is a page-authoring decision, not a CSS class — put the hero teaser in its own
section, and the rest in a following section with `style: grid` metadata (see
`docs/GRID_LAYOUT.md`). Don't make the hero card a spanning item inside that same grid
(`grid-column: 1 / -1`) — that keeps `auto-fit`/equal-column grids from collapsing the other
rows' unused tracks, so 2 regular cards below it would get stuck at half-width plus an empty
gap instead of stretching to fill the row; a separate section avoids that interaction
entirely, and a taller per-row mosaic height is what makes the size boost visible, not a
grid-spanning CSS rule.

`--zoom-hover` — opt-in editorial flourish: the thumb's single cover image scales up
slightly on card hover. Combine with `--interactive`. Targets only a **direct-child** `img`
(a manually authored cover image) — a collection-card mosaic nested in the same thumb is
deliberately excluded, since zooming every individual mosaic cell at once on hover reads as
busy/chaotic rather than polished. Kept as an opt-in modifier rather than folded into
`--interactive` itself, since that base modifier is shared by every asset card site-wide
(search results, collections, board) and this flourish is only meant for editorial/teaser
contexts like `teaser`.

`--overlay-on-hover` hides `__overlay`/`__overlay--bottom` slots (opacity: 0) until the card
is hovered *or* focused (`:focus-within`, not just `:hover` — so a keyboard-focused button is
visible before it's activated, not just technically reachable). Use for a canvas of many
cards where always-visible action buttons would be too busy (the `board` block's canvas is
the only current consumer). Most contexts (search results, collections) should keep actions
plainly visible instead of reaching for this. A consuming block can layer its own extra
reveal states on top — e.g. `board` also reveals on its own `.board__item--selected` class —
by adding `opacity: 1` for that state in the block's own CSS.

**Alt text rules for `<img>` inside cards:**
- Meaningful image (asset thumbnail shown to user): `alt="<asset title or description>"` — use `asset.description || asset.title || asset.name`
- Decorative / duplicate (same title is nearby in the card): `alt=""`
- Never omit the `alt` attribute.
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

`--natural`, preview-only (board canvas pattern):
```html
<article class="asc-ui-asset-card asc-ui-asset-card--natural">
  <div class="asc-ui-asset-card__thumb">
    <div class="asc-ui-asset-card__overlay">
      <button class="asc-ui-icon-btn asc-ui-icon-btn--sm" type="button" aria-label="Remove">✕</button>
    </div>
    <img src="…" alt="…">
  </div>
</article>
```

`--horizontal --lg` with a mosaic thumb (`Teaser (Horizontal Card)` pattern):
```html
<article class="asc-ui-asset-card asc-ui-asset-card--interactive asc-ui-asset-card--zoom-hover asc-ui-asset-card--horizontal asc-ui-asset-card--lg">
  <div class="asc-ui-asset-card__thumb">
    <div class="asc-ui-collection-card__thumbs" style="--collection-card-mosaic-height: 180px">
      <div class="asc-ui-collection-card__thumb-row" style="--collection-card-row-cols: 2">
        <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
        <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
      </div>
    </div>
  </div>
  <div class="asc-ui-asset-card__body">
    <p class="asc-ui-asset-card__title">Press Kit</p>
    <p class="asc-ui-asset-card__meta">Logos, product shots, and boilerplate for media</p>
  </div>
</article>
```

`--horizontal --hero` — the one featured tile (`Teaser (Hero)`), authored in its
own section **before** a following section of regular cards laid out with `style: grid` (not
a `grid-column: 1 / -1` item inside that grid — see the note above for why):
```html
<article class="asc-ui-asset-card asc-ui-asset-card--interactive asc-ui-asset-card--zoom-hover asc-ui-asset-card--horizontal asc-ui-asset-card--hero">
  <div class="asc-ui-asset-card__thumb">
    <div class="asc-ui-collection-card__thumbs" style="--collection-card-mosaic-height: 320px">
      <div class="asc-ui-collection-card__thumb-row" style="--collection-card-row-cols: 5">
        <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
        <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
        <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
        <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
        <div class="asc-ui-collection-card__thumb"><img src="…" alt=""></div>
      </div>
    </div>
  </div>
  <div class="asc-ui-asset-card__body">
    <p class="asc-ui-asset-card__title">Spring 2026 Campaign</p>
    <p class="asc-ui-asset-card__meta">Curated hero shots for the spring launch</p>
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

`__glyph` also accepts an inline SVG icon instead of an emoji — sized via `.asc-ui-filetype__glyph svg` (2rem square) rather than `font-size`. Use for a state that isn't really "a file type" (e.g. "no access") where an emoji would misread as decorative rather than informational:
```html
<div class="asc-ui-filetype" title="You don't have access to this asset">
  <span class="asc-ui-filetype__glyph"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
  <span class="asc-ui-filetype__ext">No access</span>
</div>
```
Used by the board canvas (`scripts/asc/board-item.js`) for items a viewer's AEM session can't read — see the `AssetAccessError` model and `.board__item--locked` in `blocks/board/board.css`.

### Labeled action bar — `@kit actions` · `styles/ui-kit.css`
Stacked icon + text so each option is self-explanatory. Action variants: `--primary`, `--danger`.
A row of standalone action buttons is a **toolbar**, not a list — use `role="toolbar"` +
`aria-label` rather than `<ul><li>` (a list announces "list, N items" for what's really a group
of controls; save `<ul>`/`asc-ui-menu` for actual enumerable content/menus).
```html
<div class="asc-ui-actions" role="toolbar" aria-label="Asset actions">
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

### Color picker popover — `@kit color-picker` · `styles/ui-kit.css`
Freehand native color input + a small preset swatch grid, dropped inside an
`.asc-ui-dropdown__panel` popover (anchor with `.asc-ui-dropdown` on the wrapper, trigger button
+ `data-dropdown-trigger` pattern — see Filter dropdown / Popover menu above). Used by the
search-bar color-search control (`blocks/search-bar/search-bar.js`). Presets are plain buttons
with `--asc-ui-swatch-color` set inline; give each a `title`/`aria-label` since there's no visible
text label at this size.
```html
<div class="asc-ui-dropdown" data-dropdown>
  <button class="asc-ui-control-btn" type="button" aria-expanded="false" data-dropdown-trigger>…</button>
  <div class="asc-ui-dropdown__panel asc-ui-color-picker" hidden>
    <input type="color" class="asc-ui-color-picker__input" value="#2980b9" aria-label="Pick a color">
    <div class="asc-ui-color-picker__presets">
      <button class="asc-ui-color-picker__preset" type="button" style="--asc-ui-swatch-color:#c0392b" title="Red"></button>
      <button class="asc-ui-color-picker__preset" type="button" style="--asc-ui-swatch-color:#2980b9" title="Blue"></button>
    </div>
    <button class="btn btn--ghost btn--sm asc-ui-color-picker__clear" type="button">Clear color</button>
  </div>
</div>
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
Use `<section>` so AT users can navigate to it as a landmark. Always add `aria-hidden="true"` to decorative icons.
Modifier: `--plain` drops the dashed border/background — use when the empty state
fills its whole containing section (e.g. a full results grid) rather than sitting
as a small inset placeholder within other content.
```html
<section class="asc-ui-empty-state">
  <span class="asc-ui-empty-state__icon" aria-hidden="true">📁</span>
  <p class="asc-ui-empty-state__title">No collections yet</p>
  <p class="asc-ui-empty-state__hint">Create a collection to start building a set of assets.</p>
  <div class="asc-ui-empty-state__actions"><button class="btn btn--primary btn--sm" type="button">New</button></div>
</section>

<section class="asc-ui-empty-state asc-ui-empty-state--plain">
  <span class="asc-ui-empty-state__icon" aria-hidden="true">🔍</span>
  <p class="asc-ui-empty-state__title">No results found</p>
  <p class="asc-ui-empty-state__hint">Try adjusting your search terms or filters.</p>
</section>
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

### Bubble — `@kit bubble` · `styles/ui-kit.css`
Speech / message bubble with rounded corners and a directional tail. Default tail: bottom-left.
Modifiers: `--bl` (same as default) `--br` `--tl` `--tr`.
```html
<!-- Bottom-left tail (default) -->
<div class="asc-ui-bubble">Looks good — approved for campaign use.</div>

<!-- Bottom-right tail -->
<div class="asc-ui-bubble asc-ui-bubble--br">Reply from the right side.</div>

<!-- Top-left tail (annotation above a target) -->
<div class="asc-ui-bubble asc-ui-bubble--tl">Note attached below this bubble.</div>
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
