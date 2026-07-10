# Section Grid Layout — Named-Area Grid Reference

The ASC section grid is a general, author-driven layout paradigm for EDS sections, modeled on
CSS `grid-template-areas`. Authors arrange blocks into a 2-D layout from section metadata, with
each block declaring which cell it occupies — no per-layout CSS required.

---

## How it works

1. An author adds `layout: grid` to a section's metadata table
2. EDS promotes all section metadata keys to `data-*` attributes on the `.section` element
3. `scripts/asc/section-grid.js` runs (called from `decorateMain`, before blocks render) and
   reads those attributes into CSS custom properties on the section
4. Each block wrapper picks up its `--grid-area` from the block's own `area` config row
5. `styles/sections/grid-layout.css` turns those custom properties into the live grid

This means grid layouts work everywhere `decorateMain` runs — including inside the
asset-details modal (loaded via `loadFragment`).

---

## Authoring (section metadata)

```
| Section Metadata |                    |
|------------------|--------------------|
| layout           | grid               |
| areas            | preview actions    |
|                  | preview metadata   |
| columns          | 1.5fr 1fr          |   (optional)
| rows             | auto auto          |   (optional)
| gap              | m                  |   (optional)
```

### `areas` (required)

One line per grid row. Each line lists the area name occupying each column — repeat a name
across cells to span them. The example above places `preview` in both rows on the left,
with `actions` above `metadata` on the right.

Row separators: authored newlines are the primary separator. You may also use `/`, `|`, or `,`
as inline separators (e.g. `preview actions / preview metadata` on a single authored line).

### `columns` (optional)

Track sizing string, passed directly to `grid-template-columns`.

**Default:** `repeat(N, minmax(0, 1fr))` where N is the widest row's column count.

Examples: `1.5fr 1fr`, `300px 1fr`, `repeat(3, 1fr)`

### `rows` (optional)

Track sizing string, passed directly to `grid-template-rows`.

**Default:** `auto 1fr` (when there is more than one row). The first row is content-sized;
the second is flexible. This means a block that spans both rows (like a preview) fills the
available height, while the other column's blocks pack to the top — the spanning item crosses
the flexible track, so content rows stay content-sized.

Set `rows` explicitly when you want equal-height rows or custom track sizing.

### `gap` (optional)

Either a **named token** or a **raw length**.

Named tokens map to the theme spacing scale:

| Author value | CSS variable |
|---|---|
| `xs` | `var(--spacing-xs)` |
| `s` or `sm` | `var(--spacing-sm)` |
| `m` or `md` | `var(--spacing-md)` |
| `l` or `lg` | `var(--spacing-lg)` |
| `xl` | `var(--spacing-xl)` |

Raw lengths (e.g. `1.5rem`, `24px`) pass through unchanged.

---

## Block placement

Each block claims its grid cell via an `area` config row in its authored block table:

```
| details-preview |         |
| area              | preview |
```

The area value must match one of the names used in the section's `areas` metadata.

`section-grid.js` reads and **removes** the `area` row before the block's own `decorate()`
function runs — so the area declaration is never visible to the block's own config reader.

---

## CSS custom properties set by `section-grid.js`

These are set as inline styles on the `.section` element and on each block wrapper:

| Property | Set on | Value |
|---|---|---|
| `--grid-areas` | `.section` | `grid-template-areas` string (e.g. `"preview actions" "preview metadata"`) |
| `--grid-columns` | `.section` | Resolved `columns` value or computed `repeat(N, minmax(0, 1fr))` |
| `--grid-cols` | `.section` | Raw column count (integer string) |
| `--grid-rows` | `.section` | Resolved `rows` value or `auto 1fr` |
| `--grid-gap` | `.section` | Resolved `gap` value (token → `var(--spacing-*)` or raw length) |
| `--grid-area` | Block wrapper `div` | The block's area name |

`styles/sections/grid-layout.css` applies these properties to produce the live grid.

---

## Responsive behavior

Below 768px, named placement is dropped and blocks stack in source order (single column).
The grid properties are only active at `@media (width >= 768px)`.

---

## Worked examples

### Asset details: two-column with sticky preview

```
| Section Metadata |                        |
|------------------|--------------------|
| layout           | grid               |
| areas            | preview actions    |
|                  | preview metadata   |
| columns          | 1.5fr 1fr          |
```

Block config for `details-preview`:
```
| details-preview |         |
| area              | preview |
```

Block config for `details-actions`:
```
| details-actions |         |
| area            | actions |
```

Block config for `details-metadata`:
```
| details-metadata |          |
| area             | metadata |
```

Result: `preview` spans both rows on the left (1.5fr), `actions` is top-right, `metadata`
is bottom-right (both 1fr). On mobile all three stack in source order.

---

### Three-column equal grid

```
| Section Metadata |           |
|------------------|-----------|
| layout           | grid      |
| areas            | a b c     |
| gap              | l         |
```

Each block declares `area: a`, `area: b`, or `area: c`. Columns default to `repeat(3, minmax(0, 1fr))`.

---

### Explicit equal rows

```
| Section Metadata |                     |
|------------------|---------------------|
| layout           | grid                |
| areas            | left right          |
|                  | left footer         |
| columns          | 2fr 1fr             |
| rows             | 1fr 1fr             |
```

With `rows: 1fr 1fr` both rows are equal height. Without it, `left` spanning both rows
would make the right column's blocks pack to the top.

---

## Implementation notes

**Boilerplate modification required.** `scripts/asc/section-grid.js` must be imported and called
in `scripts/scripts.js` `decorateMain()`. This call must come **after** `decorateBlocks` and
**before** blocks render:

```js
import decorateGridLayouts from './section-grid.js';

export function decorateMain(main) {
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateGridLayouts(main);   // ← ASC addition — must stay after decorateBlocks
}
```

Re-apply this edit after any EDS boilerplate upgrade. The logic lives in the user-owned
`scripts/asc/section-grid.js`; the styling in `styles/sections/grid-layout.css` (imported by
`styles.css`).

---

## Related files

| File | Purpose |
|---|---|
| `scripts/asc/section-grid.js` | Reads section metadata, sets CSS custom properties |
| `styles/sections/grid-layout.css` | Applies custom properties to produce the grid |
| `scripts/scripts.js` | Must import and call `decorateGridLayouts` in `decorateMain` |
| `AGENTS.md` → "Section Layouts" | Shorter summary for AI assistant context |
