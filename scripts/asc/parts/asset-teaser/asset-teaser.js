// ASC Core — do not edit. Customize via scripts/configurations.js

import { loadCSS } from '../../../aem.js';
import collectionToggle from '../collection-toggle/collection-toggle.js';
import serviceConfigurations from '../../../configurations.js';

loadCSS('/scripts/asc/parts/asset-teaser/asset-teaser.css');

// Default properties shown per view when searchResults.views is not configured
const DEFAULT_VIEW_PROPS = {
  cards:   ['thumbnail', 'title', 'file-type', 'file-size'],
  masonry: ['thumbnail', 'title'],
};

function getViewProps(view) {
  return serviceConfigurations.searchResults?.views?.[view]
    || DEFAULT_VIEW_PROPS[view]
    || DEFAULT_VIEW_PROPS.cards;
}

// Converts a property value to a renderable string.
// dimensions returns { width, height } — everything else should already be a string.
function propToString(val) {
  if (val == null) return null;
  if (typeof val === 'object' && val.width != null) return `${val.width} \u00d7 ${val.height}`;
  return String(val);
}

/**
 * assetTeaser(asset, options) — renders an asset card HTML string.
 *
 * Which properties are shown is controlled by configurations.searchResults.views.
 * 'thumbnail' always renders as the preview image; all other properties render
 * in the meta section in the order they appear in the view config.
 *
 * @param {Asset}  asset
 * @param {object} [options]
 * @param {string} [options.mode='card']    'card' | 'list'
 * @param {string} [options.view='cards']   View key: 'cards' | 'masonry' (maps to searchResults.views)
 * @returns {string} HTML string
 */
export default function assetTeaser(asset, { mode = 'card', view = 'cards' } = {}) {
  const props = getViewProps(view);
  const hasThumbnail = props.includes('thumbnail');
  const metaProps = props.filter((p) => p !== 'thumbnail');

  const previewHtml = hasThumbnail ? `
      <div class="asc-asset-teaser__preview">
        <img src="${asset.thumbnail}" alt="${asset.title}" loading="lazy" />
      </div>` : '';

  const metaHtml = metaProps.length ? `
      <div class="asc-asset-teaser__meta">
        ${metaProps.map((prop) => {
          if (prop === 'title') {
            return `<h3 class="asc-asset-teaser__title">${asset.title}</h3>`;
          }
          const val = propToString(asset.getProperty(prop));
          if (!val) return '';
          return `<div class="asc-asset-teaser__prop asc-asset-teaser__${prop}">${val}</div>`;
        }).join('')}
      </div>` : '';

  return `
    <article class="asc-asset-teaser asc-asset-teaser--${mode}"
             role="button"
             tabindex="0"
             draggable="true"
             aria-label="${asset.title}"
             data-asc-action="asset:details:open@click asset:preload@mouseover"
             data-asc-asset="${asset.uuid}"
             data-asc-mime-type="${asset.mimeType || ''}"
             data-asc-file-type="${asset.getProperty('file-type') || ''}">
      ${previewHtml}
      ${metaHtml}
      ${collectionToggle(asset)}
    </article>`;
}
