/**
 * details-actions — action buttons for the asset details view.
 *
 * Place this block on any details fragment page (`/details/default`, etc.).
 * It reads the current asset via the `data-asc-asset` attribute set by the
 * details modal on the enclosing `<main>` element.
 *
 * Supported actions (space-separated):
 *   add-to-cart  — adds asset to the default cart collection
 *   download     — direct download link for the original asset
 *   share        — dispatches `asc:asset:share` for a custom share handler
 *
 * Authoring (da.live table):
 *   | actions | add-to-cart download |   (optional; defaults shown; order controls button order)
 *
 * Example authored content:
 *   | actions | add-to-cart download share |
 */
import Asset from '../../scripts/asc/models/asset.js';
import { readBlockConfig } from '../../scripts/aem.js';

export default async function decorate(block) {
  const config = {
    actions: 'add-to-cart download',
    ...readBlockConfig(block),
  };

  const asset = await Asset.create(block);
  if (!asset) {
    block.innerHTML = '';
    return;
  }

  const actions = String(config.actions).trim().split(/\s+/);
  block.innerHTML = html(asset, actions);
}

function html(asset, actions) {
  const buttons = actions.map((action) => htmlButton(asset, action)).filter(Boolean).join('');
  return `<div class="details-actions__buttons">${buttons}</div>`;
}

function htmlButton(asset, action) {
  switch (action) {
    case 'add-to-cart':
      return `
        <button class="details-actions__btn details-actions__btn--primary"
                data-asc-action="collection:add@click"
                data-asc-asset="${asset.uuid}"
                data-asc-collection="cart">
          Add to Cart
        </button>`;

    case 'download':
      return `
        <a class="details-actions__btn details-actions__btn--secondary"
           href="${asset.url}"
           download="${asset.filename || asset.title}">
          Download
        </a>`;

    case 'share':
      return `
        <button class="details-actions__btn details-actions__btn--secondary"
                data-asc-action="asset:share@click"
                data-asc-asset="${asset.uuid}">
          Share
        </button>`;

    default:
      return '';
  }
}
