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
  - label: General
    items:
      - title: Responsive
        url: "#responsive"
      - title: Combining layouts
        url: "#combining"
---

# Section Layouts

Structural layout helpers applied via section-metadata — no custom blocks needed.

---

## Grid {#grid}

Adding `style: grid` to a section's section-metadata turns that section into a CSS Grid container. Every block wrapper inside the section becomes a grid cell.

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
| `columns` | integer | `2` | Number of equal-width columns |
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
| `colspan-4` | Block spans 4 columns |
| `rowspan-2` | Block spans 2 rows |
| `rowspan-3` | Block spans 3 rows |

Apply these by adding the style to the **block's wrapper** via a section-metadata in the same section. Because EDS section-metadata applies to the section, this typically means using a nested section or applying the style directly in `configurations.js` for programmatic cases.

> **Practical tip:** For most layouts, uniform cells with different block types are sufficient. Cell spanning is most useful for hero-style layouts where one block (e.g. a preview image) should take up more space.

---

## Responsive behavior {#responsive}

The grid uses `grid-template-columns: repeat(N, 1fr)` — a fixed column count at all viewport widths. On narrow screens, consider using fewer columns.

To override for mobile, add a theme CSS rule:

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
| sidebar-width   | 320px       |
```

```
style: aside, right    content (1fr) | sidebar (sidebar-width)
style: aside, left     sidebar       | content (1fr)
```

**`aside, right` — content left, sidebar right:**
```
┌───────────────────────┐ ┌──────────┐
│                       │ │          │
│      main content     │ │ sidebar  │
│                       │ │          │
└───────────────────────┘ └──────────┘
```

**`aside, left` — sidebar left, content right:**
```
┌──────────┐ ┌───────────────────────┐
│          │ │                       │
│ sidebar  │ │      main content     │
│          │ │                       │
└──────────┘ └───────────────────────┘
```

On viewports narrower than 768px, the columns stack vertically — the sidebar moves below (or above) the main content depending on its DOM order.

## Options {#aside-options}

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `style` | `aside, left` \| `aside, right` | `aside, right` | Required. `left`/`right` sets sidebar position. Omitting both defaults to `right`. |
| `sidebar-width` | Any CSS length | `300px` | Width of the sidebar column — `px`, `%`, `rem`, or `clamp(…)` all work. |

The `gap` between columns defaults to `var(--aside-gap, var(--spacing-md, 1rem))`.

---

## Full-width {#full-width}

`full-width` removes the default 1200px max-width constraint and horizontal padding from all blocks in the section. Each block fills the entire viewport width and controls its own internal layout.

```
| section-metadata |            |
|-----------------|------------|
| style           | full-width  |
```

Useful for hero sections, image strips, full-bleed banners, or any block that needs edge-to-edge control.

> **Combining:** `full-width` can be combined with other styles. `style: grid, full-width` gives you a full-width grid section.

---

## Responsive {#responsive}

| Layout | Mobile behaviour |
|--------|-----------------|
| `grid` | Columns stay fixed — add a custom CSS override for mobile |
| `aside` | Stacks to single column below 768px automatically |
| `full-width` | No change — always full viewport width |

---

## Combining layouts {#combining}

Style values are comma-separated — multiple classes apply simultaneously:

```
| section-metadata |                    |
|-----------------|--------------------|
| style           | full-width, aside, right |
| sidebar-width   | 280px               |
```

→ Full-viewport-width aside layout with an `aside right` column structure.
