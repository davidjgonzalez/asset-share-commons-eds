/** @owner user */
import services from '../../scripts/asc/core/services/services.js';

/**
 * Collection-bar (stub) block — shows the current cart state and a link
 * to the download sheet page.
 *
 * Renders:
 *   - A "Go to sheet" link with the current cart's assets and selected renditions
 *     compressed into URL params.
 *   - A list of all collections with their asset counts.
 *
 * Re-renders when any collection changes via the asc:collection:update event.
 */
export default async function decorate(block) {
  block.innerHTML = await buildHtml();

  document.addEventListener('asc:collection:change', async () => {
    block.innerHTML = await buildHtml();
  });

  return block;
}

async function buildHtml() {
  return `
    <div class="stub__sheet">
      ${await htmlSheet()}
    </div>
    <div class="stub__collections">
      ${await htmlCollections()}
    </div>`;
}

async function htmlSheet() {
  const cart = await services.collections.getActive();
  const assetIds = cart?.assetIds || [];

  if (!assetIds.length) {
    return '<p class="stub__sheet-empty">Your cart is empty.</p>';
  }

  const renditions = ['web', 'original'];
  const assetsParam = await services.url.compressArray(assetIds);
  const renditionsParam = await services.url.compressArray(renditions);

  return `
    <h4>Download Sheet</h4>
    <p>${assetIds.length} asset${assetIds.length !== 1 ? 's' : ''} in cart</p>
    <a href="/sheet?assets=${assetsParam}&renditions=${renditionsParam}" class="stub__sheet-link">
      Go to download sheet
    </a>`;
}

async function htmlCollections() {
  const collections = await services.collections.getAll();

  return `
    <h4>Collections</h4>
    <ul class="stub__collection-list">
      ${collections.map((c) => `
        <li class="stub__collection-item">
          ${c.name || c.id}
          <span class="stub__collection-count">(${c.assetIds?.length ?? 0})</span>
        </li>`).join('')}
    </ul>`;
}
