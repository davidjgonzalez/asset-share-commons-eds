/** @owner user */
/**
 * details-metadata — a panel of asset property rows, rendered with the UI Kit
 * .asc-ui-metadata primitive (label + value, ruled rows).
 *
 * Authoring (da.live table) — each row is `Label | property-key`:
 *
 *   | details-metadata |
 *   | display    | grid       |   ← optional, reserved row: list (default) | grid
 *   | Format     | file-type  |
 *   | Dimensions | dimensions |
 *   | Size       | file-size  |
 *   | Tags       | tags       |
 *
 * - Values resolve via Asset.getProperty(key).
 * - Array values (e.g. `tags`) render as .asc-ui-chip pills.
 * - Rows whose value resolves empty are skipped.
 * - `display: grid` switches to the responsive cell layout (term over value).
 */
import Asset from '../../scripts/asc/models/asset.js';

const RESERVED = new Set(['display', 'layout']);

export default async function decorate(block) {
  // Parse rows as [label, propertyKey] before replacing markup; pull out the
  // reserved display/layout row.
  let display = 'list';
  const fields = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const label = cells[0]?.textContent.trim() || '';
    const value = cells[1]?.textContent.trim() || '';
    if (!label) return;
    if (RESERVED.has(label.toLowerCase())) {
      display = value.toLowerCase();
      return;
    }
    fields.push({ label, key: value });
  });

  const asset = await Asset.create(block);
  if (!asset) {
    block.innerHTML = '';
    return;
  }

  const rows = fields
    .map(({ label, key }) => renderRow(asset, label, key))
    .filter(Boolean)
    .join('');

  if (!rows) {
    block.innerHTML = '';
    return;
  }

  const variant = display === 'grid' ? ' asc-ui-metadata--grid' : '';
  block.innerHTML = `<dl class="asc-ui-metadata${variant}">${rows}</dl>`;
}

function renderRow(asset, label, key) {
  const raw = key ? asset.getProperty(key) : null;
  const value = renderValue(raw);
  if (!value) return '';
  return `<div class="asc-ui-metadata__row">
      <dt class="asc-ui-metadata__term">${esc(label)}</dt>
      <dd class="asc-ui-metadata__value">${value}</dd>
    </div>`;
}

/** Arrays → chips; {width,height} → "W × H"; scalars → escaped text; empty → '' (row skipped). */
function renderValue(raw) {
  if (raw == null) return '';
  if (Array.isArray(raw)) {
    const chips = raw
      .map((t) => String(t).trim())
      .filter(Boolean)
      .map((t) => `<span class="asc-ui-chip">${esc(t)}</span>`)
      .join('');
    return `<span class="asc-ui-chip-list">${chips}</span>`;
  }
  const str = stringifyValue(raw);
  if (!str) return '';
  // Custom property functions (e.g. `colors`) may return a trusted HTML string.
  // Strings that begin with '<' are passed through unescaped.
  if (str.startsWith('<')) return str;
  return esc(str);
}

/** Coerce a property value to a display string, formatting known object shapes. */
function stringifyValue(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (raw.width != null && raw.height != null) return `${raw.width} × ${raw.height}`;
    return '';
  }
  return String(raw).trim();
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
