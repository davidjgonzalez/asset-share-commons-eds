import services from '../../scripts/asc/services/services.js';

/**
 * Collections block — lists all user collections as summary cards.
 * Shows collection name, asset count, and a thumbnail strip of the first 3 assets.
 *
 * Note: assets are NOT hydrated here to keep it lightweight. Use the
 * collection block (singular) to show a fully hydrated single collection.
 */
export default async function decorate(block) {
  const collections = await services.collections.getCollections(false);
  block.innerHTML = htmlCollections(collections);

  // Re-render when any collection changes
  document.addEventListener('asc:collection:update', async () => {
    const updated = await services.collections.getCollections(false);
    block.innerHTML = htmlCollections(updated);
  });
}

function htmlCollections(collections) {
  if (!collections?.length) {
    return '<p class="collections-empty">No collections yet.</p>';
  }
  return `<ul class="collections-list">
    ${collections.map(htmlCollection).join('')}
  </ul>`;
}

function htmlCollection(collection) {
  const count = collection.assetIds?.length ?? 0;
  return `
    <li class="collection-item"
        data-collection-id="${collection.id}">
      <div class="collection-item__name">${collection.name || collection.id}</div>
      <div class="collection-item__count">${count} asset${count !== 1 ? 's' : ''}</div>
    </li>`;
}
