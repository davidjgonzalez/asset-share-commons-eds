/** @owner user */
/**
 * details-video — embeds a video asset using a native <video> element.
 *
 * Authoring (da.live table — all rows optional):
 *
 *   | details-video |          |
 *   | height        | 600px    |  ← viewer height, any CSS length (default: 600px)
 *   | controls      | true     |  ← show native controls (default: true)
 *   | autoplay      | false    |
 *   | muted         | false    |
 *   | loop          | false    |
 *   | playsinline   | true     |
 *   | preload       | metadata |  ← auto | metadata | none
 *   | poster        |          |  ← optional poster image URL
 */

import { readBlockConfig } from '../../scripts/asc/core/utils/blocks.js';
import { escAttr } from '../../scripts/asc/html.js';
import Asset from '../../scripts/asc/core/models/asset.js';

const DEFAULTS = {
  height: '600px',
  preload: 'metadata',
};


export default async function decorate(block) {
  const raw = readBlockConfig(block);
  const bool = (key, def) => (raw[key] === undefined ? def : raw[key] !== 'false');

  const config = {
    height: raw.height || DEFAULTS.height,
    controls: bool('controls', true),
    autoplay: bool('autoplay', false),
    muted: bool('muted', false),
    loop: bool('loop', false),
    playsInline: bool('playsinline', true),
    preload: raw.preload || DEFAULTS.preload,
    poster: raw.poster || '',
  };

  block.innerHTML = `<div class="details-video__viewer details-video__viewer--loading">
    <span class="asc-ui-skeleton" style="width:100%;aspect-ratio:16/9"></span>
  </div>`;

  const formatMap = {
    'video/quicktime': 'QuickTime',
    'video/x-msvideo': 'AVI',
    'video/x-flv': 'Flash Video',
    'video/x-matroska': 'Matroska',
  };

  try {
    const asset = await Asset.create(block);

    if (!asset) {
      throw new Error('Asset.create() returned null or undefined');
    }
    const mimeType = asset.mimeType || 'video/mp4';
    const testVideo = document.createElement('video');
    const canPlay = testVideo.canPlayType(mimeType);

    const attr = [
      config.controls ? 'controls' : '',
      config.autoplay ? 'autoplay' : '',
      config.muted ? 'muted' : '',
      config.loop ? 'loop' : '',
      config.playsInline ? 'playsinline' : '',
      `preload="${escAttr(config.preload)}"`,
      config.poster ? `poster="${escAttr(config.poster)}"` : '',
    ].filter(Boolean).join(' ');

    // Don't render <video> at all if the original format isn't playable —
    // it gets injected lazily when the user clicks a supported rendition.
    const playerHtml = canPlay ? `
        <video
          class="details-video__player"
          title="${escAttr(asset.filename || asset.title || 'Video preview')}"
          ${attr}>
          <source src="${escAttr(asset.url)}" type="${escAttr(mimeType)}">
        </video>
        <span class="details-video__loading asc-ui-skeleton details-video__loading--hidden"></span>` : '';

    block.innerHTML = `
      <div class="details-video__viewer" style="--video-ar:${asset.renditionsLandscapeAspectRatio}">
        ${playerHtml}
        <span class="asc-ui-chip details-video__rendition-label"></span>
        <div class="details-video__unsupported details-video__unsupported--hidden asc-ui-empty-state">
          <p class="asc-ui-empty-state__title">Video format not supported</p>
          <p class="asc-ui-empty-state__hint details-video__unsupported-hint"></p>
          <a class="details-video__unsupported-download btn btn--primary">Download video</a>
        </div>
      </div>`;

    const viewer = block.querySelector('.details-video__viewer');
    let source = block.querySelector('source');
    let videoElement = block.querySelector('video');
    let loadingEl = block.querySelector('.details-video__loading');
    const unsupported = block.querySelector('.details-video__unsupported');
    const unsupportedHint = block.querySelector('.details-video__unsupported-hint');
    const unsupportedDownload = block.querySelector('.details-video__unsupported-download');
    const renditionLabel = block.querySelector('.details-video__rendition-label');

    const showPlayer = () => {
      if (!videoElement) return;
      videoElement.classList.remove('details-video__player--hidden');
      unsupported.classList.add('details-video__unsupported--hidden');
    };

    const showUnsupported = (renditionMimeType, filename, url) => {
      const formatName = formatMap[renditionMimeType] || renditionMimeType.split('/').pop().toUpperCase();
      unsupportedHint.textContent = `${filename || 'This video'} is in ${formatName} format, which cannot be played in your browser.`;
      unsupportedDownload.href = url;
      unsupportedDownload.setAttribute('download', '');
      if (videoElement) videoElement.classList.add('details-video__player--hidden');
      unsupported.classList.remove('details-video__unsupported--hidden');
    };

    const setRenditionLabel = (label) => {
      renditionLabel.textContent = label ? `Rendition: ${label}` : '';
    };

    let pendingUnsupported = null;
    let activeState = canPlay
      ? { type: 'player', src: asset.url, mime: mimeType }
      : { type: 'unsupported', mimeType, filename: asset.filename || asset.title, url: asset.url };

    const attachVideoListeners = () => {
      videoElement.addEventListener('loadstart', () => {
        loadingEl.classList.remove('details-video__loading--hidden');
      });
      videoElement.addEventListener('canplay', () => {
        loadingEl.classList.add('details-video__loading--hidden');
      });
      // When the load fails: update activeState so restoreActive() shows
      // unsupported instead of the player after a hover-then-mouseout cycle.
      videoElement.addEventListener('error', () => {
        loadingEl.classList.add('details-video__loading--hidden');
        if (pendingUnsupported) {
          const { renditionMimeType, filename, url } = pendingUnsupported;
          activeState = { type: 'unsupported', mimeType: renditionMimeType, filename, url };
          setRenditionLabel(null);
          showUnsupported(renditionMimeType, filename, url);
          pendingUnsupported = null;
        }
      }, { capture: true });
    };

    // Inject <video> the first time the user clicks a supported rendition
    // (skipped on initial render when the original format isn't playable).
    const ensurePlayer = () => {
      if (videoElement) return;
      viewer.insertAdjacentHTML('afterbegin', `
        <video
          class="details-video__player"
          title="${escAttr(asset.filename || asset.title || 'Video preview')}"
          ${attr}>
          <source>
        </video>
        <span class="details-video__loading asc-ui-skeleton details-video__loading--hidden"></span>`);
      videoElement = block.querySelector('video');
      source = block.querySelector('source');
      loadingEl = block.querySelector('.details-video__loading');
      attachVideoListeners();
    };

    if (canPlay) {
      attachVideoListeners();
    } else {
      showUnsupported(mimeType, asset.filename || asset.title, asset.url);
    }

    const applyRendition = (rendition, sticky) => {
      if (!rendition || !rendition.url) return;
      // Use only mimeType — rendition.format is a display label, not a MIME type
      const renditionMimeType = rendition.mimeType || mimeType;
      const probe = document.createElement('video');
      const playable = probe.canPlayType(renditionMimeType);

      if (playable) {
        if (sticky) {
          ensurePlayer();
          pendingUnsupported = { renditionMimeType, filename: rendition.filename || asset.filename, url: rendition.url };
          source.src = rendition.url;
          source.type = renditionMimeType;
          videoElement.load();
          activeState = { type: 'player', src: rendition.url, mime: renditionMimeType };
          setRenditionLabel(rendition.label || rendition.name || null);
          showPlayer();
        }
        // Hover over supported rendition: no display change — video can't preview like images can
      } else {
        if (sticky) {
          pendingUnsupported = null;
          activeState = { type: 'unsupported', mimeType: renditionMimeType, filename: rendition.filename || asset.filename, url: rendition.url };
          setRenditionLabel(null);
        }
        showUnsupported(renditionMimeType, rendition.filename || asset.filename, rendition.url);
      }
    };

    const restoreActive = () => {
      if (activeState.type === 'player') {
        showPlayer();
      } else {
        showUnsupported(activeState.mimeType, activeState.filename, activeState.url);
      }
    };

    document.body.addEventListener('asc:rendition:activate', (e) => {
      applyRendition(e.detail?.rendition, true);
    });

    document.body.addEventListener('asc:rendition:preview', (e) => {
      if (e.detail?.rendition) {
        applyRendition(e.detail.rendition, false);
      } else {
        restoreActive();
      }
    });
  } catch (error) {
    console.error('details-video: Failed to load asset', error);
    block.innerHTML = `
      <div class="asc-ui-empty-state">
        <p class="asc-ui-empty-state__title">Could not load video</p>
        <p class="asc-ui-empty-state__hint">The asset could not be found or loaded. Check the browser console for details.</p>
      </div>`;
  }
}
