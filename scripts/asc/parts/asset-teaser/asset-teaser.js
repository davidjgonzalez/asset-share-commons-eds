// ASC Core — do not edit. Customize via scripts/configurations.js

import { loadCSS } from '../../../aem.js';

loadCSS('/scripts/asc/parts/asset-teaser/asset-teaser.css');

/**
 * assetTeaser(asset, options) — renders an asset card or list-row HTML string.
 *
 * Display modes:
 *   'card'  — grid card with thumbnail, title, metadata (default)
 *   'list'  — horizontal row with small thumbnail and metadata
 *
 * Usage:
 *   import assetTeaser from '../../scripts/asc/parts/asset-teaser/asset-teaser.js';
 *   container.insertAdjacentHTML('beforeend', assetTeaser(asset));
 *   container.insertAdjacentHTML('beforeend', assetTeaser(asset, { mode: 'list' }));
 *
 * @param {Asset}  asset
 * @param {object} [options]
 * @param {string} [options.mode='card']  'card' | 'list'
 * @returns {string}
 */
export default function assetTeaser(asset, { mode = 'card' } = {}) {
  const assetId = asset.uuid;
  const assetTitle = asset.title;
  const fileType = asset.getProperty('file-type');
  const fileSize = asset.getProperty('file-size');
  const dimensions = asset.getProperty('dimensions');

  const pictureHtml = asset.getPictureHtml({
    ...asset.pictureHtmlConfigurations.card,
    alt: assetTitle,
  });

  return `
    <article class="asc-asset-teaser asc-asset-teaser--${mode}"
             role="button"
             tabindex="0"
             data-asc-action="asset:details:open@click asset:preload@mouseover"
             data-asc-asset="${assetId}">
      <div class="asc-asset-teaser__preview">
        ${pictureHtml}
      </div>
      <div class="asc-asset-teaser__meta">
        <h3 class="asc-asset-teaser__title">${assetTitle}</h3>
        <div class="asc-asset-teaser__file-type">${fileType || 'Unknown'}</div>
        <div class="asc-asset-teaser__file-size">${fileSize || ''}</div>
        ${dimensions ? `<div class="asc-asset-teaser__dimensions">${dimensions.width} &times; ${dimensions.height}</div>` : ''}
      </div>
      <button class="asc-asset-teaser__add-to-cart"
              data-asc-action="collection:add@click"
              data-asc-asset="${assetId}"
              data-asc-collection="cart"
              aria-label="Add ${assetTitle} to cart">Add to Cart</button>
    </article>`;
}
