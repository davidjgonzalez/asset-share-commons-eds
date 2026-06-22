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

const SVG_ADD = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const SVG_REMOVE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

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
  injectCollectionToggleIcons(block);
}

function injectCollectionToggleIcons(block) {
  block.querySelectorAll('.asc-collection-toggle__btn').forEach((btn) => {
    const icon = btn.querySelector('.asc-collection-toggle__icon');
    if (!icon) return;
    if (btn.classList.contains('asc-collection-toggle__add')) icon.innerHTML = SVG_ADD;
    else if (btn.classList.contains('asc-collection-toggle__remove')) icon.innerHTML = SVG_REMOVE;
  });
}

function buildHtml(config, resultsHtml) {
  const header = config.description ? `
    <div class="details-similar__header">
      <p class="details-similar__description">${config.description}</p>
    </div>` : '';

  return `${header}${resultsHtml}`;
}

/**
 * Fetch similar assets via SearchService.searchSilent(), which automatically
 * applies basePredicates and sheet-based scoping. QueryBuilder only — the
 * `similar` predicate is not supported by the OpenAPI provider.
 *
 * @param {Asset} asset  The reference asset
 * @param {number} max   Maximum results to return
 * @returns {Promise<Asset[]>}
 */
async function fetchSimilarAssets(asset, max) {
  const results = await services.search.searchSilent(new Map([
    ['similar', asset.path],
    ['similar.fields', 'jcr:content/metadata/dc:tags jcr:content/metadata/dc:format'],
    ['p.limit', String(max + 1)],
  ]));

  return (results.assets || [])
    .filter((a) => a.uuid !== asset.uuid)
    .slice(0, max);
}
