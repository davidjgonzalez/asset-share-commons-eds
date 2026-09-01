// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import { loadCSS } from '../../../../aem.js';
import collectionToggle from '../collection-toggle/collection-toggle.js';
import serviceConfigurations from '../../../configurations.js';
import services from '../../services/services.js';
import { escAttr } from '../../../html.js';

loadCSS('/scripts/asc/core/parts/asset-teaser/asset-teaser.css');

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

function imgAlt(asset) {
  return asset.description || asset.title || asset.name || '';
}

// Video preview: poster image at rest (asset.thumbnail — falls back to AEM's
// standard cq5dam.thumbnail.*.png rendition, generated for video assets too),
// swapped for real playback only on hover/focus — see the play/pause wiring
// below. Never autoplays: with many video results on screen at once, loading
// every one eagerly would be far heavier than the image-grid case.
function thumbnailVideoHtml(asset) {
  const alt = imgAlt(asset);
  return `<video class="asc-asset-teaser__video" muted loop playsinline preload="none"
            poster="${escAttr(asset.thumbnail)}" data-asc-video-src="${escAttr(asset.url)}"
            aria-label="${escAttr(alt)}" tabindex="-1"></video>`;
}

function thumbnailImgHtml(asset) {
  const alt = imgAlt(asset);
  const srcset = services.renditions.getThumbnailSrcset(asset);
  if (srcset.length) {
    const srcsetAttr = srcset.map((r) => `${r.url} ${r.size.width}w`).join(', ');
    const src = srcset[Math.floor(srcset.length / 2)].url;
    return `<img src="${src}" srcset="${srcsetAttr}" sizes="(min-width: 1024px) 300px, (min-width: 600px) 250px, 300px" alt="${alt}" loading="lazy" />`;
  }
  return `<img src="${asset.thumbnail}" alt="${alt}" loading="lazy" />`;
}

function thumbnailHtml(asset) {
  return asset.mimeType?.startsWith('video/') ? thumbnailVideoHtml(asset) : thumbnailImgHtml(asset);
}

// Lazily assign the real src on first hover/focus (preload="none" above skips
// the network request until then), then play; pause + rewind when the
// pointer/focus leaves. Registered once here rather than per-render, the same
// way collection-toggle.js wires its own page-wide listeners.
function playPreview(video) {
  if (!video.src) video.src = video.dataset.ascVideoSrc;
  video.play().catch(() => { /* format unsupported or blocked — poster stays */ });
}

function pausePreview(video) {
  video.pause();
  video.currentTime = 0;
}

function previewVideoFor(target) {
  return target.closest?.('.asc-asset-teaser')?.querySelector('.asc-asset-teaser__video') || null;
}

document.body.addEventListener('mouseover', (e) => {
  const card = e.target.closest('.asc-asset-teaser');
  if (!card || card.contains(e.relatedTarget)) return;
  const video = previewVideoFor(e.target);
  if (video) playPreview(video);
});

document.body.addEventListener('mouseout', (e) => {
  const card = e.target.closest('.asc-asset-teaser');
  if (!card || card.contains(e.relatedTarget)) return;
  const video = previewVideoFor(e.target);
  if (video) pausePreview(video);
});

document.body.addEventListener('focusin', (e) => {
  const video = previewVideoFor(e.target);
  if (video) playPreview(video);
});

document.body.addEventListener('focusout', (e) => {
  const card = e.target.closest('.asc-asset-teaser');
  if (!card || card.contains(e.relatedTarget)) return;
  const video = previewVideoFor(e.target);
  if (video) pausePreview(video);
});

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
        ${thumbnailHtml(asset)}
      </div>` : '';

  const metaHtml = metaProps.length ? `
      <div class="asc-asset-teaser__meta">
        ${metaProps.map((prop) => {
          if (prop === 'title') {
            return `<h3 class="asc-asset-teaser__title">${asset.title}</h3>`;
          }
          const val = asset.getProperty(prop).text;
          if (!val) return '';
          return `<div class="asc-asset-teaser__prop asc-asset-teaser__${prop}">${val}</div>`;
        }).join('')}
      </div>` : '';

  return `
    <article class="asc-asset-teaser asc-asset-teaser--${mode}"
             role="button"
             tabindex="0"
             draggable="true"
             aria-label="${escAttr(asset.title)}"
             data-asc-action="asset:details:open@click asset:preload@mouseover"
             data-asc-asset="${asset.uuid}"
             data-asc-mime-type="${asset.mimeType || ''}"
             data-asc-file-type="${asset.getProperty('file-type').data || ''}">
      ${previewHtml}
      ${metaHtml}
      ${collectionToggle(asset, { favorite: true })}
      ${collectionToggle(asset)}
    </article>`;
}
