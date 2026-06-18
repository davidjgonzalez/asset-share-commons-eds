/** @owner user */
/**
 * details-similar block — shows assets similar to the current details asset.
 *
 * Uses the QueryBuilder `similar` predicate to find related assets based on
 * shared tags and metadata. QueryBuilder only — not available with the OpenAPI provider.
 *
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates#similar
 *
 * Authorable configuration:
 *   description {string}   Subtext shown above the strip (optional)
 *   max         {number}   Maximum number of similar assets to show (default: 8)
 *   show-empty  {boolean}  Show the block when no similar assets are found (default: false)
 */

import { readBlockConfig } from '../../scripts/aem.js';
import assetTeaser from '../../scripts/asc/parts/asset-teaser/asset-teaser.js';
import services from '../../scripts/asc/services/services.js';
import Asset from '../../scripts/asc/models/asset.js';

const DEFAULTS = {
  description: '',
  max: 8,
  'show-empty': false,
};

export default async function decorate(block) {
  const raw = readBlockConfig(block);
  const config = {
    description: raw.description || DEFAULTS.description,
    max: raw.max ? Number.parseInt(raw.max, 10) : DEFAULTS.max,
    showEmpty: raw['show-empty'] === 'true' || raw['show-empty'] === true,
  };

  // The fragment is loaded with data-asc-asset on its <main> element
  const assetId = block.closest('[data-asc-asset]')?.dataset?.ascAsset;
  if (!assetId) return;

  const asset = window.asc?.cache?.assets?.get(assetId)
    || await services.search.getAssetById(assetId);

  if (!asset) return;

  block.innerHTML = `
    <div class="asc-ui-filmstrip">
      ${Array.from({ length: 4 }).map(() => '<span class="asc-ui-filmstrip__item asc-ui-skeleton asc-ui-skeleton--thumb"></span>').join('')}
    </div>`;

  const similar = await fetchSimilarAssets(asset, config.max);

  if (!similar.length) {
    if (config.showEmpty) {
      block.innerHTML = buildHtml(config, '');
    } else {
      block.closest('.section')?.remove();
    }
    return;
  }

  block.innerHTML = buildHtml(
    config,
    `<div class="details-similar__results asc-ui-filmstrip">
      ${similar.map((a) => assetTeaser(a, { mode: 'card' })).join('')}
    </div>`,
  );
}

function buildHtml(config, resultsHtml) {
  const header = config.description ? `
    <div class="details-similar__header">
      <p class="details-similar__description">${config.description}</p>
    </div>` : '';

  return `${header}${resultsHtml}`;
}

/**
 * Fetch similar assets via the QueryBuilder similar predicate.
 * Compares dc:tags and dc:format; excludes the reference asset itself.
 *
 * @param {Asset} asset  The reference asset
 * @param {number} max   Maximum results to return
 * @returns {Promise<Asset[]>}
 */
async function fetchSimilarAssets(asset, max) {
  const searchUrl = services.aem.getUrl('/bin/querybuilder.json');
  const headers = await services.aem.getHeaders();

  const params = new URLSearchParams({
    type: 'dam:Asset',
    mainasset: 'true',
    similar: asset.path,
    'similar.fields': 'jcr:content/metadata/dc:tags jcr:content/metadata/dc:format',
    'p.limit': max + 1, // fetch one extra in case we need to exclude self
    'p.hits': 'full',
    'p.nodedepth': '10',
  });

  try {
    const response = await fetch(`${searchUrl}?${params}`, { headers });
    if (!response.ok) return [];
    const data = await response.json();

    return (data.hits || [])
      .filter((hit) => hit['jcr:uuid'] !== asset.uuid)
      .slice(0, max)
      .map((hit) => {
        const a = new Asset(hit);
        window.asc.cache.assets.set(a.uuid, a);
        return a;
      });
  } catch {
    return [];
  }
}
