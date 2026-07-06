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
import { escHtml as esc } from '../../scripts/html.js';

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
    .map(({ label, key }) => {
      const pv = asset.getProperty(key);
      if (!pv.html) return '';
      return `<div class="asc-ui-metadata__row">
      <dt class="asc-ui-metadata__term">${esc(label)}</dt>
      <dd class="asc-ui-metadata__value">${pv.html}</dd>
    </div>`;
    })
    .filter(Boolean)
    .join('');

  if (!rows) {
    block.innerHTML = '';
    return;
  }

  const variant = display === 'grid' ? ' asc-ui-metadata--grid' : '';
  block.innerHTML = `<dl class="asc-ui-metadata${variant}">${rows}</dl>`;
}

