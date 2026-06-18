/** @owner user */
/*
 * Named-area section grid — a general "layout: grid" paradigm for EDS sections,
 * modeled on the CSS grid-template-areas property.
 *
 * Authoring (da.live section-metadata):
 *
 *   | Section Metadata |                    |
 *   | layout           | grid               |
 *   | areas            | preview actions    |   ← one line per grid row
 *   |                  | preview metadata   |
 *   | columns          | 1.5fr 1fr          |   (optional track sizing)
 *   | rows             | auto auto          |   (optional)
 *   | gap              | m                  |   (optional: xs|s|m|l|xl token → theme
 *   |                  |                    |    --spacing-*, or a raw length e.g. 2rem)
 *
 * The `areas` value is a set of rows (one per authored line; rows may also be
 * separated by `/`, `|`, or `,`). Each row lists the area name occupying each
 * column — repeat a name to make a cell span. The example above yields a grid
 * where `preview` spans two rows on the left, with `actions` over `metadata`
 * on the right.
 *
 * Each block opts into a cell by declaring an `area` in its block config:
 *
 *   | details-preview |         |
 *   | area            | preview |
 *
 * Section-metadata keys become data-* attributes on the .section (handled by
 * EDS). This module (called from decorateMain, before blocks render) reads them
 * into --grid-* custom properties and pulls each block's `area` row onto its
 * wrapper. styles/sections/grid-layout.css turns those properties into the grid
 * and collapses to a single column on narrow viewports.
 */

/**
 * Apply every `layout: grid` section in `main`.
 * @param {Element} main The container (page main, or a loaded fragment's main).
 */
export default function decorateGridLayouts(main) {
  main.querySelectorAll('.section[data-layout="grid"]').forEach((section) => {
    const { template, cols, rowCount } = parseAreas(section.dataset.areas || '');
    if (template) {
      section.style.setProperty('--grid-areas', template);
      section.style.setProperty('--grid-cols', String(cols));
    }
    // Columns: explicit `columns` wins; otherwise default to equal 1fr tracks.
    if (section.dataset.columns) {
      section.style.setProperty('--grid-columns', section.dataset.columns);
    } else if (cols > 0) {
      section.style.setProperty('--grid-columns', `repeat(${cols}, minmax(0, 1fr))`);
    }

    // Rows: explicit `rows` wins; otherwise default to `auto 1fr` (first row
    // content-sized, the rest flexible) so a block spanning the full column
    // height (e.g. a preview) packs the other column's blocks to the top —
    // the spanning item crosses the flexible track, leaving content rows sized.
    if (section.dataset.rows) {
      section.style.setProperty('--grid-rows', section.dataset.rows);
    } else if (rowCount > 1) {
      section.style.setProperty('--grid-rows', 'auto 1fr');
    }

    if (section.dataset.gap) section.style.setProperty('--grid-gap', resolveGap(section.dataset.gap));

    // Assign each block's wrapper to its named area.
    section.querySelectorAll(':scope > div').forEach((wrapper) => {
      const block = wrapper.querySelector(':scope > .block');
      if (!block) return;
      const area = extractArea(block);
      if (area) wrapper.style.setProperty('--grid-area', area);
    });
  });
}

// Named gap tokens → theme spacing scale (xs, s, m, l, xl).
const GAP_TOKENS = {
  xs: 'xs', s: 'sm', sm: 'sm', m: 'md', md: 'md', l: 'lg', lg: 'lg', xl: 'xl',
};

/**
 * Resolve a `gap` value: a named token (xs|s|m|l|xl) maps to the theme's
 * --spacing-* scale; anything else (e.g. "1.5rem", "12px") passes through.
 */
function resolveGap(value) {
  const raw = value.trim();
  const token = GAP_TOKENS[raw.toLowerCase()];
  return token ? `var(--spacing-${token})` : raw;
}

/**
 * Turn an authored `areas` value into a grid-template-areas string + column count.
 * "preview actions, preview metadata" → { template: '"preview actions" "preview metadata"', cols: 2 }
 */
function parseAreas(raw) {
  const rows = raw
    .split(/\s*[,/|\n]+\s*/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (!rows.length) return { template: '', cols: 0, rowCount: 0 };
  const cols = Math.max(...rows.map((row) => row.split(/\s+/).length));
  const template = rows.map((row) => `"${row}"`).join(' ');
  return { template, cols, rowCount: rows.length };
}

/**
 * Find and remove a block's `area` config row, returning its value.
 * Removing it keeps the area declaration out of the block's own content.
 */
function extractArea(block) {
  const rows = [...block.children];
  for (let i = 0; i < rows.length; i += 1) {
    const cells = [...rows[i].children];
    if (cells.length >= 2 && cells[0].textContent.trim().toLowerCase() === 'area') {
      const value = cells[1].textContent.trim();
      rows[i].remove();
      return value || null;
    }
  }
  return null;
}
