/** @owner user */
import { escAttr } from '../../scripts/html.js';

const FORMAT_NAMES = {
  'video/quicktime': 'QuickTime',
  'video/x-msvideo': 'AVI',
  'video/x-flv': 'Flash Video',
  'video/x-matroska': 'Matroska',
};

// Infer MIME type from filename/URL extension when rendition.mimeType is absent.
const EXT_MIME = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  flv: 'video/x-flv', webm: 'video/webm', ogv: 'video/ogg',
};

function getMime(rendition, fallback) {
  if (rendition?.mimeType) return rendition.mimeType;
  const src = rendition?.filename || rendition?.url || '';
  const ext = src.split('.').pop().split('?')[0].toLowerCase();
  return EXT_MIME[ext] || fallback;
}

function renditionDisplay(rendition) {
  return rendition?.filename || rendition?.label || rendition?.name || null;
}

export function mount(container, asset, initialRendition, config) {
  const bool = (key, def) => (config[key] === undefined ? def : config[key] !== 'false');
  const cfg = {
    controls: bool('controls', true),
    autoplay: bool('autoplay', false),
    muted: bool('muted', false),
    loop: bool('loop', false),
    playsInline: bool('playsinline', true),
    preload: config.preload || 'metadata',
    poster: config.poster || '',
    height: config.height || '',
  };

  const initialMime = getMime(initialRendition, asset.mimeType || 'video/mp4');
  const probe = document.createElement('video');
  const canPlay = !!probe.canPlayType(initialMime);
  // Tracks the rendition currently loaded into <source> so the error handler has correct info.
  let loadingRendition = initialRendition;

  const heightStyle = cfg.height ? ` style="height:${escAttr(cfg.height)}"` : '';
  const attr = [
    cfg.controls ? 'controls' : '',
    cfg.autoplay ? 'autoplay' : '',
    cfg.muted ? 'muted' : '',
    cfg.loop ? 'loop' : '',
    cfg.playsInline ? 'playsinline' : '',
    `preload="${escAttr(cfg.preload)}"`,
    cfg.poster ? `poster="${escAttr(cfg.poster)}"` : '',
  ].filter(Boolean).join(' ');

  if (asset.renditionsLandscapeAspectRatio) {
    container.style.setProperty('--video-ar', asset.renditionsLandscapeAspectRatio);
  }

  const playerHtml = canPlay ? `
    <video class="details-preview__video" ${attr}${heightStyle}>
      <source src="${escAttr(initialRendition?.url || asset.url)}" type="${escAttr(initialMime)}">
    </video>
    <span class="details-preview__loading asc-ui-skeleton details-preview__loading--hidden"></span>` : '';

  container.innerHTML = `
    ${playerHtml}
    <span class="asc-ui-chip details-preview__rendition-label"></span>
    <div class="details-preview__unsupported details-preview__unsupported--hidden asc-ui-empty-state">
      <p class="asc-ui-empty-state__title">Video format not supported</p>
      <p class="asc-ui-empty-state__hint details-preview__unsupported-hint"></p>
      <a class="details-preview__unsupported-download btn btn--primary">Download video</a>
    </div>`;

  let videoEl = container.querySelector('video');
  let sourceEl = container.querySelector('source');
  let loadingEl = container.querySelector('.details-preview__loading');
  const unsupported = container.querySelector('.details-preview__unsupported');
  const unsupportedHint = container.querySelector('.details-preview__unsupported-hint');
  const unsupportedDownload = container.querySelector('.details-preview__unsupported-download');
  const renditionLabel = container.querySelector('.details-preview__rendition-label');

  const showPlayer = () => {
    if (videoEl) videoEl.classList.remove('details-preview__video--hidden');
    unsupported.classList.add('details-preview__unsupported--hidden');
  };

  const showUnsupported = (mime, filename, url) => {
    const fmt = FORMAT_NAMES[mime] || mime.split('/').pop().toUpperCase();
    unsupportedHint.textContent = `${filename || 'This video'} is in ${fmt} format, which cannot be played in your browser.`;
    unsupportedDownload.href = url;
    unsupportedDownload.setAttribute('download', '');
    if (videoEl) videoEl.classList.add('details-preview__video--hidden');
    unsupported.classList.remove('details-preview__unsupported--hidden');
  };

  const attachListeners = () => {
    videoEl.addEventListener('loadstart', () => {
      loadingEl?.classList.remove('details-preview__loading--hidden');
    });
    videoEl.addEventListener('canplay', () => {
      loadingEl?.classList.add('details-preview__loading--hidden');
    });
    videoEl.addEventListener('error', () => {
      loadingEl?.classList.add('details-preview__loading--hidden');
      const mime = getMime(loadingRendition, initialMime);
      const display = renditionDisplay(loadingRendition) || asset.filename;
      showUnsupported(mime, display, loadingRendition?.url || asset.url);
    }, { capture: true });
  };

  const ensurePlayer = () => {
    if (videoEl) return;
    container.insertAdjacentHTML('afterbegin', `
      <video class="details-preview__video" ${attr}${heightStyle}><source></video>
      <span class="details-preview__loading asc-ui-skeleton details-preview__loading--hidden"></span>`);
    videoEl = container.querySelector('video');
    sourceEl = container.querySelector('source');
    loadingEl = container.querySelector('.details-preview__loading');
    attachListeners();
  };

  if (canPlay) {
    attachListeners();
  } else {
    showUnsupported(
      initialMime,
      renditionDisplay(initialRendition) || asset.filename,
      initialRendition?.url || asset.url,
    );
  }

  const setDisplay = (rendition, sticky) => {
    if (!sticky || !rendition?.url) return; // hover is a no-op for video
    const mime = getMime(rendition, initialMime);
    const probeEl = document.createElement('video');
    if (probeEl.canPlayType(mime)) {
      ensurePlayer();
      loadingRendition = rendition;
      sourceEl.src = rendition.url;
      sourceEl.type = mime;
      videoEl.load();
      showPlayer();
      renditionLabel.textContent = rendition.label ? `Rendition: ${rendition.label}` : '';
    } else {
      renditionLabel.textContent = '';
      showUnsupported(mime, renditionDisplay(rendition) || asset.filename, rendition.url);
    }
  };

  return {
    setDisplay,
    dispose() {
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
      }
      container.style.removeProperty('--video-ar');
      container.innerHTML = '';
    },
  };
}
