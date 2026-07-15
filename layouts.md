---
layout: page
title: Section Layouts
permalink: /layouts
sidebar:
  - label: Grid
    items:
      - title: Overview
        url: "#grid"
      - title: Options
        url: "#grid-options"
      - title: Cell spanning
        url: "#spanning"
  - label: Aside
    items:
      - title: Overview
        url: "#aside"
      - title: Options
        url: "#aside-options"
  - label: Full-width
    items:
      - title: Overview
        url: "#full-width"
  - label: Named-area Grid
    items:
      - title: Overview
        url: "#named-area-grid"
      - title: Authoring
        url: "#named-area-authoring"
      - title: Block placement
        url: "#named-area-placement"
      - title: Worked examples
        url: "#named-area-examples"
  - label: General
    items:
      - title: Responsive
        url: "#responsive"
      - title: Combining layouts
        url: "#combining"
---

# Section Layouts

Structural layout helpers applied via section-metadata — no custom blocks needed. Two independent systems are available: a simple **equal-width** grid (`style: grid`, below), and a more powerful **named-area** grid (`_layout: grid`, see [Named-area Grid](#named-area-grid)) for asymmetric layouts like a preview panel spanning multiple rows.

---

## Grid {#grid}

Adding `style: grid` to a section's section-metadata turns that section into a CSS Grid container with equal-width columns. Every block wrapper inside the section becomes a grid cell.

```
| section-metadata |        |
|-----------------|--------|
| style           | grid   |
| columns         | 3      |
| direction       | row    |
```

The section gets `display: grid` with equal-width columns. Use any block inside — search filters, details panels, download cards — they all become cells automatically.

---

## Options {#grid-options}

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `style` | `grid` | — | Required — activates grid layout |
| `columns` | integer (1–6) | `2` | Number of equal-width columns |
| `direction` | `row` \| `column` | `row` | Fill order for cells |

### direction

| Value | CSS | Behavior |
|-------|-----|----------|
| `row` | `grid-auto-flow: row` | Fills left-to-right, then wraps to next row (default) |
| `column` | `grid-auto-flow: column` | Fills top-to-bottom, then moves to next column |

**`direction: row` (default) — 3 columns, 5 blocks:**
```
┌──────┐ ┌──────┐ ┌──────┐
│  1   │ │  2   │ │  3   │
└──────┘ └──────┘ └──────┘
┌──────┐ ┌──────┐
│  4   │ │  5   │
└──────┘ └──────┘
```

**`direction: column` — 3 columns, 5 blocks:**
```
┌──────┐ ┌──────┐ ┌──────┐
│  1   │ │  3   │ │  5   │
├──────┤ ├──────┤ └──────┘
│  2   │ │  4   │
└──────┘ └──────┘
```

---

## Authoring {#authoring}

In da.live, create a section separator and add a `section-metadata` block as the **last block in the section**:

```
--- (section separator)

[block-1]
[block-2]
[block-3]

| section-metadata |      |
|-----------------|------|
| style           | grid |
| columns         | 3    |
```

Each block in the section automatically becomes a grid cell — no additional configuration needed per block.

---

## Cell spanning {#spanning}

Individual blocks can span multiple columns or rows by adding span style classes to the block's own section-metadata. Use `colspan-N` or `rowspan-N`:

| Style class | Effect |
|-------------|--------|
| `colspan-2` | Block spans 2 columns |
| `colspan-3` | Block spans 3 columns |
| `rowspan-2` | Block spans 2 rows |
| `rowspan-3` | Block spans 3 rows |

> **Practical tip:** For asymmetric layouts (e.g. one preview block that should take up more space than its siblings), the [Named-area Grid](#named-area-grid) below is usually a better fit than colspan/rowspan — it lets each block declare exactly which named cell it occupies.

---

## Responsive behavior {#responsive}

The grid uses `grid-template-columns: repeat(N, 1fr)` — a fixed column count at all viewport widths. On narrow screens, consider using fewer columns, or override for mobile:

```css
/* styles/themes/custom.css or styles/styles.css */
@media (width < 768px) {
  main .section.grid {
    grid-template-columns: 1fr !important;
  }
}
```

The `gap` between cells defaults to `var(--grid-gap, var(--spacing-md, 1rem))`. Override it with a CSS variable in your theme:

```css
:root {
  --grid-gap: 2rem;
}
```

---

## Aside {#aside}

`aside` creates an asymmetric two-column layout: a wide main content area and a narrower sidebar. The `left` or `right` modifier controls which column is the sidebar.

```
| section-metadata |            |
|-----------------|------------|
| style           | aside, right |
```

**`aside, right` — content left, sidebar right (default):**
```
┌───────────────────────┐ ┌──────────┐
│      main content     │ │ sidebar  │
└───────────────────────┘ └──────────┘
```

**`aside, left` — sidebar left, content right:**
```
┌──────────┐ ┌───────────────────────┐
│ sidebar  │ │      main content     │
└──────────┘ └───────────────────────┘
```

On viewports narrower than 768px, the columns stack vertically — the sidebar moves below (or above) the main content depending on its DOM order.

## Options {#aside-options}

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `style` | `aside, left` \| `aside, right` | `aside, right` | Required. `left`/`right` sets sidebar position. |

The sidebar width defaults to `300px` via `--aside-sidebar-width`. Override it in your theme:

```css
:root {
  --aside-sidebar-width: 320px;
}
```

The gap between columns defaults to `var(--aside-gap, var(--spacing-md, 1rem))`.

---

## Full-width {#full-width}

`full-width` removes the default max-width constraint and horizontal padding from all blocks in the section. Each block fills the entire viewport width and controls its own internal layout.

```
| section-metadata |            |
|-----------------|------------|
| style           | full-width  |
```

Useful for hero sections, image strips, full-bleed banners, or any block that needs edge-to-edge control.

> **Combining:** `full-width` can be combined with other styles. `style: grid, full-width` gives you a full-width grid section.

---

## Named-area Grid {#named-area-grid}

A more general, author-driven grid paradigm modeled on CSS `grid-template-areas` — for layouts the equal-width [Grid](#grid) above can't express, like a preview panel spanning two rows next to two stacked blocks. Authors arrange blocks into a 2-D layout from section metadata, and each block declares which named cell it occupies. No per-layout CSS is needed.

Uses a different section-metadata key (`_layout: grid`, note the underscore prefix) so it never collides with the simple `style: grid` system above — both can exist on different sections of the same site.

### Authoring {#named-area-authoring}

```
| Section Metadata |                    |
|------------------|--------------------|
| _layout          | grid               |
| _areas           | preview actions    |
|                  | preview metadata   |
| _columns         | 1.5fr 1fr          |
| _rows            | auto auto          |   (optional)
| _gap             | m                  |   (optional)
```

- **`_areas`** (required) — one line per grid row. Repeat an area name across cells to span them — the example above places `preview` in both rows on the left, with `actions` above `metadata` on the right. Rows may also be separated inline with `/`, `|`, or `,`.
- **`_columns`** (optional) — track sizing passed directly to `grid-template-columns`. **Default:** `repeat(N, minmax(0, 1fr))` derived from the widest areas row.
- **`_rows`** (optional) — track sizing for `grid-template-rows`. **Default:** `auto 1fr` — the first row is content-sized, the rest flexible, so a block spanning the full column height (like `preview`) fills available space while the other column's blocks pack to the top. Set explicitly for equal-height rows.
- **`_gap`** (optional) — a named token (`xs` \| `s` \| `m` \| `l` \| `xl`, mapped to the theme `--spacing-*` scale) or a raw length (e.g. `1.5rem`), passed through unchanged.

### Block placement {#named-area-placement}

Each block claims a cell with an `_area` config row:

```
| details-preview |         |
| _area             | preview |
```

The area value must match one of the names used in the section's `_areas` metadata. `section-grid.js` reads and removes the `_area` row before the block's own `decorate()` runs, so it's never visible to the block's own config reader.

### Responsive behavior

Below 768px, named placement is dropped and blocks stack in source order (single column) — same behavior as the simple grid.

### Worked examples {#named-area-examples}

**Asset details: two-column with spanning preview**

```
| Section Metadata |                    |
|------------------|--------------------|
| _layout          | grid               |
| _areas           | preview actions    |
|                  | preview metadata   |
| _columns         | 1.5fr 1fr          |
```

```
| details-preview |         |    | details-actions |         |    | details-metadata |          |
| _area             | preview |    | _area              | actions |    | _area              | metadata |
```

Result: `preview` spans both rows on the left (1.5fr), `actions` is top-right, `metadata` is bottom-right (both 1fr). On mobile all three stack in source order.

**Three-column equal grid**

```
| Section Metadata |           |
|------------------|-----------|
| _layout          | grid      |
| _areas           | a b c     |
| _gap             | l         |
```

Each block declares `_area: a`, `_area: b`, or `_area: c`. Columns default to `repeat(3, minmax(0, 1fr))`.

**Explicit equal rows**

```
| Section Metadata |                     |
|------------------|---------------------|
| _layout          | grid                |
| _areas           | left right          |
|                  | left footer         |
| _columns         | 2fr 1fr             |
| _rows            | 1fr 1fr             |
```

With `_rows: 1fr 1fr` both rows are equal height. Without it, `left` spanning both rows would make the right column's blocks pack to the top.

> Because `_layout: grid` is applied via the same `decorateMain` pass that runs for fragments loaded via `loadFragment`, named-area grids also work **inside the asset-details modal**. Full implementation notes (the `scripts/scripts.js` wiring, CSS custom properties set by `section-grid.js`) are in the repo's `AGENTS.md` and `docs/GRID_LAYOUT.md`.

---

## Responsive {#responsive-summary}

| Layout | Mobile behaviour |
|--------|-------------------|
| `grid` | Columns stay fixed — add a custom CSS override for mobile |
| `aside` | Stacks to single column below 768px automatically |
| `full-width` | No change — always full viewport width |
| `_layout: grid` (named-area) | Drops named placement, stacks in source order below 768px |

---

## Combining layouts {#combining}

Style values are comma-separated — multiple classes apply simultaneously:

```
| section-metadata |                          |
|-----------------|--------------------------|
| style           | full-width, aside, right |
```

→ Full-viewport-width aside layout with an `aside right` column structure.
