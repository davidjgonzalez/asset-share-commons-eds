// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import { loadCSS } from '../../../../aem.js';
import collectionToggle from '../collection-toggle/collection-toggle.js';
import serviceConfigurations from '../../../configurations.js';
import services from '../../services/services.js';
import { escAttr, pictureHtml } from '../../utils/html.js';
import { icon } from '../../utils/icons.js';

loadCSS('/scripts/asc/core/parts/asset-teaser/asset-teaser.css');

// Default properties shown per view when searchResults.views is not configured
const DEFAULT_VIEW_PROPS = {
  cards:   ['thumbnail', 'title', 'file-type', 'dimensions', 'file-size'],
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

// Video preview: a <picture> "poster" overlay at rest, built from AEM's static
// cq5dam.thumbnail.*.png ladder (configurations.js renditions.display) picked
// per breakpoint. `<video poster>` only takes one fixed URL — no srcset/media-query
// support — so a single mid-size rung stretched across every card size read as
// fuzzy; pictureHtml() picks the closest available rung per breakpoint instead.
// Swapped out for real playback only on hover/focus — see the play/pause wiring
// below. Never autoplays: with many video results on screen at once, loading
// every one eagerly would be far heavier than the image-grid case.
function thumbnailVideoHtml(asset) {
  const alt = imgAlt(asset);
  const srcset = services.renditions.getDisplaySrcset(asset);
  const poster = srcset.length
    ? pictureHtml(srcset, alt, {
      className: 'asc-asset-teaser__poster',
      sources: [
        { minWidth: 1024, width: 300 },
        { minWidth: 600, width: 250 },
        { minWidth: 0, width: 300 },
      ],
    })
    : `<img class="asc-asset-teaser__poster" src="${escAttr(services.users.authorizeMediaUrl(asset.displayUrl))}" alt="${escAttr(alt)}" loading="lazy" />`;
  return `${poster}<video class="asc-asset-teaser__video" muted loop playsinline preload="none"
            data-asc-video-src="${escAttr(services.users.authorizeMediaUrl(asset.url))}"
            aria-label="${escAttr(alt)}" tabindex="-1"></video>`;
}

function thumbnailImgHtml(asset) {
  const alt = imgAlt(asset);
  // No-op under cookie/anonymous auth; a signed-URL strategy rewrites media URLs.
  const media = (u) => services.users.authorizeMediaUrl(u);
  const srcset = services.renditions.getDisplaySrcset(asset);
  if (srcset.length) {
    const srcsetAttr = srcset.map((r) => `${media(r.url)} ${r.size.width}w`).join(', ');
    const src = media(srcset[Math.floor(srcset.length / 2)].url);
    return `<img src="${src}" srcset="${srcsetAttr}" sizes="(min-width: 1024px) 300px, (min-width: 600px) 250px, 300px" alt="${alt}" loading="lazy" />`;
  }
  return `<img src="${media(asset.displayUrl)}" alt="${alt}" loading="lazy" />`;
}

function thumbnailHtml(asset) {
  return asset.mimeType?.startsWith('video/') ? thumbnailVideoHtml(asset) : thumbnailImgHtml(asset);
}

// The poster overlay (picture/img.asc-asset-teaser__poster) is always the video's
// immediate predecessor — see thumbnailVideoHtml() above.
function posterFor(video) {
  const el = video.previousElementSibling;
  return el?.classList.contains('asc-asset-teaser__poster') ? el : null;
}

// Lazily assign the real src on first hover/focus (preload="none" above skips
// the network request until then), then play; pause + rewind when the
// pointer/focus leaves. Registered once here rather than per-render, the same
// way collection-toggle.js wires its own page-wide listeners.
function playPreview(video) {
  if (!video.src) video.src = video.dataset.ascVideoSrc;
  video.play()
    .then(() => posterFor(video)?.classList.add('asc-asset-teaser__poster--hidden'))
    .catch(() => { /* format unsupported or blocked — poster stays */ });
}

function pausePreview(video) {
  video.pause();
  video.currentTime = 0;
  posterFor(video)?.classList.remove('asc-asset-teaser__poster--hidden');
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
 * assetTeaser(asset, options) — renders an asset card HTML string, built from the UI Kit
 * asset-card primitive (.asc-ui-asset-card). The .asc-asset-teaser* classes are kept as
 * hooks for themes, scripts and the video preview.
 *
 * Which properties are shown is controlled by configurations.searchResults.views.
 * 'thumbnail' always renders as the preview image; all other properties render
 * in the meta section in the order they appear in the view config.
 *
 * The favorite and "add to collection" toggles sit in the card's top-left overlay slot
 * and a second, empty top-right slot (.asc-asset-teaser__actions) is left for callers
 * that add one-off actions (e.g. search-results' download / copy buttons).
 *
 * @param {Asset}  asset
 * @param {object} [options]
 * @param {string} [options.mode='card']    'card' | 'list' (horizontal card)
 * @param {string} [options.view='cards']   View key: 'cards' | 'masonry' (maps to searchResults.views)
 * @returns {string} HTML string
 */
export default function assetTeaser(asset, { mode = 'card', view = 'cards' } = {}) {
  const props = getViewProps(view);
  const hasThumbnail = props.includes('thumbnail');
  const metaProps = props.filter((p) => p !== 'thumbnail');
  const masonry = view === 'masonry';

  const classes = [
    'asc-ui-asset-card',
    'asc-ui-asset-card--interactive',
    'asc-ui-asset-card--overlay-on-hover',
    masonry ? '' : 'asc-ui-asset-card--clamp-title',
    mode === 'list' ? 'asc-ui-asset-card--horizontal' : '',
    masonry ? 'asc-ui-asset-card--natural asc-ui-asset-card--bare asc-ui-asset-card--meta-overlay' : '',
    'asc-asset-teaser',
    `asc-asset-teaser--${mode}`,
  ].filter(Boolean).join(' ');

  const overlays = `
        <div class="asc-ui-asset-card__overlay asc-ui-asset-card__overlay--start">
          ${collectionToggle(asset, { favorite: true })}
          ${collectionToggle(asset, { icons: { remove: icon('check', { size: 14, strokeWidth: 2.5 }) } })}
        </div>
        <div class="asc-ui-asset-card__overlay asc-asset-teaser__actions"></div>`;

  const previewHtml = hasThumbnail ? `
      <div class="asc-ui-asset-card__thumb asc-asset-teaser__preview">
        ${thumbnailHtml(asset)}${overlays}
      </div>` : '';
  // Without a thumbnail the overlay slots anchor to the card itself instead.
  const looseOverlays = hasThumbnail ? '' : overlays;

  const metaHtml = metaProps.length ? `
      <div class="asc-ui-asset-card__body asc-asset-teaser__meta">
        ${metaProps.map((prop) => {
          if (prop === 'title') {
            return `<h3 class="asc-ui-asset-card__title asc-asset-teaser__title">${asset.title}</h3>`;
          }
          const val = asset.getProperty(prop).text;
          if (!val) return '';
          return `<div class="asc-ui-asset-card__meta asc-asset-teaser__prop asc-asset-teaser__${prop}">${val}</div>`;
        }).join('')}
      </div>` : '';

  return `
    <article class="${classes}"
             role="button"
             tabindex="0"
             draggable="true"
             aria-label="${escAttr(asset.title)}"
             data-asc-action="asset:details:open@click asset:preload@mouseover"
             data-asc-asset="${asset.uuid}"
             data-asc-mime-type="${asset.mimeType || ''}"
             data-asc-file-type="${asset.getProperty('file-type').data || ''}">
      ${previewHtml}
      ${metaHtml}${looseOverlays}
    </article>`;
}
