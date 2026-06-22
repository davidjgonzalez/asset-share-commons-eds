/** @owner user */
/*
 * Named-area section grid — a general "_layout: grid" paradigm for EDS sections,
 * modeled on the CSS grid-template-areas property.
 *
 * Authoring (da.live section-metadata):
 *
 *   | Section Metadata |                    |
 *   | _layout          | grid               |
 *   | _areas           | preview actions    |   ← one line per grid row
 *   |                  | preview metadata   |
 *   | _columns         | 1.5fr 1fr          |   (optional track sizing)
 *   | _rows            | auto auto          |   (optional)
 *   | _gap             | m                  |   (optional: xs|s|m|l|xl token → theme
 *   |                  |                    |    --spacing-*, or a raw length e.g. 2rem)
 *
 * The `_areas` value is a set of rows (one per authored line; rows may also be
 * separated by `/`, `|`, or `,`). Each row lists the area name occupying each
 * column — repeat a name to make a cell span. The example above yields a grid
 * where `preview` spans two rows on the left, with `actions` over `metadata`
 * on the right.
 *
 * Each block opts into a cell by declaring `_area` in its block config:
 *
 *   | details-preview |         |
 *   | _area           | preview |
 *
 * ## Execution order (see scripts.js)
 *
 * decorateASCSections(main) is called AFTER decorateBlocks. At that point:
 *   - decorateSections() has already run: blocks are wrapped in new divs, and
 *     section-metadata keys (_layout → layout etc.) are stored in section.dataset
 *   - decorateBlocks() has already run: every block is decorated and reachable
 *
 * Reading layout config from section.dataset (not raw section-metadata DOM) is
 * correct because EDS's toClassName() strips the leading underscore:
 *   _layout → layout → section.dataset.layout = 'grid'
 *   _areas  → areas  → section.dataset.areas  = '…'  etc.
 * The _area key in individual block configs is read directly from block DOM text
 * content, so the underscore is preserved and matched explicitly.
 *
 * styles/sections/grid-layout.css turns the --grid-* custom properties into
 * the actual grid and collapses to a single column on narrow viewports.
 */

/**
 * Apply every `_layout: grid` section in `main`.
 * Must be called AFTER decorateBlocks — see scripts.js.
 * @param {Element} main The container element (page main, or a loaded fragment's main).
 */
export function decorateASCSections(main) {
  // After decorateSections, sections are direct .section children of main.
  main.querySelectorAll(':scope > .section').forEach((section) => {
    const meta = readSectionGridMeta(section);
    if (!meta) return;

    const { template, cols, rowCount } = parseAreas(meta._areas || '');
    if (template) {
      section.style.setProperty('--grid-areas', template);
      section.style.setProperty('--grid-cols', String(cols));
    }

    if (meta._columns) {
      section.style.setProperty('--grid-columns', meta._columns);
    } else if (cols > 0) {
      section.style.setProperty('--grid-columns', `repeat(${cols}, minmax(0, 1fr))`);
    }

    if (meta._rows) {
      section.style.setProperty('--grid-rows', meta._rows);
    } else if (rowCount > 1) {
      section.style.setProperty('--grid-rows', 'auto 1fr');
    }

    if (meta._gap) section.style.setProperty('--grid-gap', resolveGap(meta._gap));

    // Assign each block's wrapper to its named area.
    // After decorateSections: section > div(wrapper) > div(block).
    // After decorateBlocks:   section > div.block-wrapper > div.block.
    // block.parentElement is the wrapper — the direct grid item.
    section.querySelectorAll(':scope > div > div').forEach((block) => {
      const area = extractArea(block);
      if (area) block.parentElement.style.setProperty('--grid-area', area);
    });

    // When multiple wrappers share the same area name they would overlap in the
    // grid. Group them into a single flex-column container so they stack instead.
    const areaGroups = new Map();
    section.querySelectorAll(':scope > div').forEach((wrapper) => {
      const area = wrapper.style.getPropertyValue('--grid-area').trim();
      if (!area) return;
      if (!areaGroups.has(area)) areaGroups.set(area, []);
      areaGroups.get(area).push(wrapper);
    });
    areaGroups.forEach((wrappers, area) => {
      if (wrappers.length <= 1) return;
      const stack = document.createElement('div');
      stack.classList.add('grid-area-stack');
      stack.style.gridArea = area;
      wrappers[0].before(stack);
      wrappers.forEach((w) => {
        w.style.removeProperty('--grid-area');
        stack.appendChild(w);
      });
    });
  });
}

/**
 * Read grid config from section.dataset (populated by decorateSections).
 * EDS toClassName() strips leading underscores: _layout→layout, _areas→areas, etc.
 * Returns the meta object if data-layout="grid", else null.
 */
function readSectionGridMeta(section) {
  if (section.dataset.layout?.toLowerCase() !== 'grid') return null;
  return {
    _areas: section.dataset.areas || '',
    _columns: section.dataset.columns || '',
    _rows: section.dataset.rows || '',
    _gap: section.dataset.gap || '',
  };
}

// Named gap tokens → theme spacing scale (xs, s, m, l, xl).
const GAP_TOKENS = {
  xs: 'xs', s: 'sm', sm: 'sm', m: 'md', md: 'md', l: 'lg', lg: 'lg', xl: 'xl',
};

/**
 * Resolve a `_gap` value: a named token (xs|s|m|l|xl) maps to the theme's
 * --spacing-* scale; anything else (e.g. "1.5rem", "12px") passes through.
 */
function resolveGap(value) {
  const raw = value.trim();
  const token = GAP_TOKENS[raw.toLowerCase()];
  return token ? `var(--spacing-${token})` : raw;
}

/**
 * Turn an authored `_areas` value into a grid-template-areas string + column count.
 * "preview actions\npreview metadata" → { template: '"preview actions" "preview metadata"', cols: 2 }
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
 * Find and remove a block's `_area` (or legacy `area`) config row, returning its value.
 * Reads raw textContent so the `_` prefix is preserved (not stripped by toClassName).
 */
function extractArea(block) {
  for (const row of [...block.children]) {
    const cells = [...row.children];
    const areaKey = cells[0]?.textContent.trim().toLowerCase();
    if (cells.length >= 2 && (areaKey === '_area' || areaKey === 'area')) {
      const value = cells[1].textContent.trim();
      row.remove();
      return value || null;
    }
  }
  return null;
}
