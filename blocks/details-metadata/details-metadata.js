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
 * - Array values (e.g. `tags`) render as .asc-ui-chip pills; past 10 a "View more (N)" toggle
 *   reveals the rest.
 * - Rows whose value resolves empty are skipped.
 * - `display: grid` switches to the responsive cell layout (term over value).
 */
import Asset from '../../scripts/asc/core/models/asset.js';
import { escHtml as esc, renderPropertyValue } from '../../scripts/asc/core/utils/html.js';

const MULTI_VALUE_LIMIT = 10;
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
      <dd class="asc-ui-metadata__value">${renderPropertyValue(pv, { limit: MULTI_VALUE_LIMIT })}</dd>
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

  block.addEventListener('click', (e) => {
    const btn = e.target.closest('.asc-view-more-btn');
    if (!btn) return;
    const extras = btn.closest('.asc-ui-metadata__value')?.querySelector('.asc-ui-chip-extras');
    if (!extras) return;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    extras.classList.toggle('is-hidden', expanded);
    btn.setAttribute('aria-expanded', String(!expanded));
    btn.textContent = expanded ? `View more (${btn.dataset.extrasCount})` : 'View less';
  });
}

