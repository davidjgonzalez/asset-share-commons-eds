/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import { Events as CollectionEvents } from '../../scripts/asc/core/services/collections/collections.js';
import { escHtml, formatUpdated } from '../../scripts/asc/html.js';
import { resolveCollectionId } from '../collection-controls/collection-controls.js';

// Sibling of collection-controls (this page's own toolbar block) — split into
// its own block, and its own grid area, rather than folded into
// collection-controls' output, so authors can place/size the stat list
// independently of the action buttons (see docs/starter-kit/collection.html).
export default async function decorate(block) {
  const collectionId = resolveCollectionId();
  await render(block, collectionId);

  document.addEventListener(CollectionEvents.CHANGED, async (e) => {
    if (e.detail?.source === 'block') return;
    await render(block, collectionId);
  });
}

async function render(block, collectionId) {
  const collection = await services.collections.get(collectionId, true);
  if (!collection) {
    block.innerHTML = '';
    return;
  }

  const items = collection.hydratedItems || [];
  const assetCount = items.filter((i) => i.type === 'asset').length;
  const updated = formatUpdated(collection.modifiedAt);

  block.innerHTML = `
    <dl class="asc-ui-metadata asc-ui-metadata--compact">
      <div class="asc-ui-metadata__row"><dt class="asc-ui-metadata__term">Assets</dt><dd class="asc-ui-metadata__value">${assetCount}</dd></div>
      <div class="asc-ui-metadata__row"><dt class="asc-ui-metadata__term">Last updated</dt><dd class="asc-ui-metadata__value">${escHtml(updated?.label || '—')}</dd></div>
    </dl>`;
}
