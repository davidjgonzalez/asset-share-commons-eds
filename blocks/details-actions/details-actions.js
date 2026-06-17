/** @owner user */
/**
 * details-actions — action buttons for the asset details view.
 *
 * Place this block on any details fragment page (`/details`, `/details/image`, etc.).
 * It reads the current asset via the `data-asc-asset` attribute set by the
 * details modal on the enclosing `<main>` element.
 *
 * Supported actions (space-separated):
 *   collection-toggle — add/remove the asset from the active collection (reactive)
 *   download          — direct download link for the original asset
 *   share             — dispatches `asc:asset:share` for a custom share handler
 *
 * Authoring (da.live table):
 *   | actions | collection-toggle download |   (optional; defaults shown; order controls button order)
 *
 * Example authored content:
 *   | actions | collection-toggle download share |
 */
import Asset from '../../scripts/asc/models/asset.js';
import { readBlockConfig } from '../../scripts/aem.js';
import collectionToggle from '../../scripts/asc/parts/collection-toggle/collection-toggle.js';

export default async function decorate(block) {
  const config = {
    actions: 'collection-toggle download',
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
    case 'collection-toggle':
      return collectionToggle(asset);

    case 'download':
      return `
        <a class="btn btn--secondary"
           href="${asset.url}"
           download="${asset.filename || asset.title}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </a>`;

    case 'share':
      return `
        <button class="btn btn--secondary"
                data-asc-action="asset:share@click"
                data-asc-asset="${asset.uuid}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share
        </button>`;

    default:
      return '';
  }
}
