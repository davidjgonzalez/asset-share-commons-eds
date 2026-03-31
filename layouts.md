---
layout: page
title: Section Layouts
permalink: /layouts
sidebar:
  - label: Grid Layout
    items:
      - title: Overview
        url: "#grid"
      - title: Options
        url: "#options"
      - title: Authoring
        url: "#authoring"
      - title: Cell spanning
        url: "#spanning"
      - title: Responsive
        url: "#responsive"
---

# Section Layouts

Structural layout helpers applied via section-metadata — no custom blocks needed.

---

## Grid layout {#grid}

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

## Options {#options}

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
