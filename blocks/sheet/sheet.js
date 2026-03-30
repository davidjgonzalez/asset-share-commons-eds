import services from '../../scripts/asc/services/services.js';
import assetTeaser from '../../scripts/asc/parts/asset-teaser/asset-teaser.js';

/**
 * Sheet block — a download/rendition selection page.
 *
 * Reads compressed asset IDs and rendition IDs from URL query parameters
 * (set by the collection-bar / stub block) and renders a download sheet.
 *
 * URL params:
 *   assets     — compressed array of asset UUIDs
 *   renditions — compressed array of rendition IDs
 */
export default async function decorate(block) {
  const { assets, renditionDefinitions } = await getDataFromSearchParams(
    new URLSearchParams(window.location.search),
  );

  block.innerHTML = html(assets, renditionDefinitions);
  return block;
}

function html(assets, renditionDefinitions) {
  return `
    <a href="/" class="sheet__back">&#8592; Back to search</a>

    <h1 class="sheet__title">Download Sheet</h1>

    <section class="sheet__renditions">
      <h3>Renditions</h3>
      ${renditionDefinitions.length
    ? renditionDefinitions.map((r) => `
          <div class="sheet__rendition">
            <strong>${r.label || r.id}</strong>
            ${r.description ? `<p>${r.description}</p>` : ''}
          </div>`).join('')
    : '<p>No renditions selected.</p>'}
    </section>

    <hr />

    <section class="sheet__assets">
      <h3>Assets (${assets.length})</h3>
      <div class="sheet__asset-list">
        ${assets
    .filter(Boolean)
    .map((asset) => assetTeaser(asset, { mode: 'list' }))
    .join('')}
      </div>
    </section>
  `;
}

async function getDataFromSearchParams(queryParameters) {
  const assetsCompressed = queryParameters.get('assets');
  const renditionsCompressed = queryParameters.get('renditions');

  const assetIds = assetsCompressed
    ? await services.url.decompressToArray(assetsCompressed)
    : [];
  const renditionIds = renditionsCompressed
    ? await services.url.decompressToArray(renditionsCompressed)
    : [];

  const assets = await Promise.all(
    assetIds.map((id) => services.search.getAssetById(id)),
  );
  const renditionDefinitions = renditionIds
    .map((id) => services.renditions.getRenditionDefinition(id))
    .filter(Boolean);

  return { assets, renditionDefinitions };
}
