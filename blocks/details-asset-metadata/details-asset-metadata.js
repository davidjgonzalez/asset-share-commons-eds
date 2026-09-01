/** @owner user */
/**
 * details-asset-metadata — displays static asset properties as a metadata list.
 *
 * Rows are authored as label | property pairs. Property names are resolved via
 * asset.getProperty() and the custom property handlers in configurations.js.
 *
 * Authoring (da.live table):
 *
 *   | details-asset-metadata |                   |
 *   | Title                  | dc:title           |
 *   | Description            | dc:description     |
 *   | Format                 | file-type          |
 *   | File size              | file-size          |
 *   | Uploaded               | uploaded-date      |
 *   | Uploaded by            | uploaded-by        |
 *   | Modified               | last-modified-date |
 *   | Modified by            | last-modified-by   |
 *   | Author                 | author             |
 *   | Keywords               | keywords           |
 *   | Tags                   | tags               |
 *
 * Any property registered in configurations.properties.custom works here.
 * Multi-value arrays are rendered as .asc-ui-chip pills.
 */

import Asset from '../../scripts/asc/core/models/asset.js';
import { escHtml, renderPropertyValue } from '../../scripts/asc/html.js';

const MULTI_VALUE_LIMIT = 10;


export default async function decorate(block) {
  const fields = blockFields(block);

  const asset = await Asset.create(block);
  if (!asset) {
    block.innerHTML = '';
    return;
  }

  const rows = fields
    .map(([label, property]) => {
      const pv = asset.getProperty(property);
      if (!pv.html) return '';
      return metadataRow(label, pv);
    })
    .filter(Boolean)
    .join('');

  block.innerHTML = rows
    ? `<dl class="asc-ui-metadata">${rows}</dl>`
    : '';

  block.addEventListener('click', (e) => {
    const btn = e.target.closest('.asc-view-more-btn');
    if (!btn) return;
    const dd = btn.closest('.asc-ui-metadata__value');
    const extras = dd?.querySelector('.asc-ui-chip-extras');
    if (!extras) return;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    extras.classList.toggle('is-hidden', expanded);
    btn.setAttribute('aria-expanded', String(!expanded));
    btn.textContent = expanded ? `View more (${btn.dataset.extrasCount})` : 'View less';
  });
}

function blockFields(block) {
  return [...block.children].reduce((acc, row) => {
    const cells = [...row.children];
    const label = cells[0]?.textContent.trim();
    const property = cells[1]?.textContent.trim();
    if (label && property) acc.push([label, property]);
    return acc;
  }, []);
}

function metadataRow(label, pv) {
  return `
    <div class="asc-ui-metadata__row">
      <dt class="asc-ui-metadata__term">${escHtml(label)}</dt>
      <dd class="asc-ui-metadata__value">${renderPropertyValue(pv, { limit: MULTI_VALUE_LIMIT })}</dd>
    </div>`;
}
