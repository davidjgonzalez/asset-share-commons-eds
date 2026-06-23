/** @owner user */
import { escAttr } from '../../scripts/html.js';
import Asset from '../../scripts/asc/models/asset.js';

/**
 * details-image — renders ONLY the asset's visual preview (the media).
 *
 * Title, metadata, and actions are intentionally NOT part of this block — they
 * are composed from separate blocks (details-property, details-actions) and
 * arranged alongside the preview by the `detail` section layout (see
 * styles/sections/detail.css). This keeps the details page author-arrangeable
 * and mirrors the UI Kit `.asc-ui-detail` two-pane layout.
 */
export default async function decorate(block) {
  try {
    const asset = await Asset.create(block);

    document.title = `${asset.title} - Asset Details`;

    const defaultRendition = asset.getRendition('original') || asset.getRendition('web');
    let activeRendition = defaultRendition;
    let loadingRendition = activeRendition;
    // failedUrls: URLs that returned an error so we don't flash showImage() before
    // immediately calling showUnsupported() on a known-bad rendition.
    // pendingUrl: the URL we *just* told the img to load — captured before setting
    // img.src so the error handler records the actual broken URL.
    const failedUrls = new Set();
    let pendingUrl = null;

    const srcFor = (r) => r?.url || asset.thumbnail;

    block.innerHTML = `
      <div class="asc-ui-detail__preview">
        <img src="${escAttr(srcFor(activeRendition))}" alt="${escAttr(asset.title)}" loading="eager" data-img-error="1">
        <span class="asc-ui-chip details-image__rendition-label"></span>
        <div class="details-image__unsupported details-image__unsupported--hidden asc-ui-empty-state">
          <p class="asc-ui-empty-state__title">Preview not available</p>
          <p class="asc-ui-empty-state__hint details-image__unsupported-hint"></p>
          <a class="details-image__unsupported-download btn btn--primary">Download</a>
        </div>
      </div>
    `;

    const preview = block.querySelector('.asc-ui-detail__preview');
    const img = block.querySelector('img');
    const label = block.querySelector('.details-image__rendition-label');
    const unsupported = block.querySelector('.details-image__unsupported');
    const unsupportedHint = block.querySelector('.details-image__unsupported-hint');
    const unsupportedDownload = block.querySelector('.details-image__unsupported-download');

    preview.style.aspectRatio = asset.renditionsBoundingAspectRatio;

    const showImage = () => {
      img.classList.remove('details-image__img--hidden');
      unsupported.classList.add('details-image__unsupported--hidden');
    };

    const showUnsupported = (rendition) => {
      const name = rendition?.label || rendition?.name || 'This rendition';
      unsupportedHint.textContent = `${name} could not be displayed.`;
      unsupportedDownload.href = srcFor(rendition);
      unsupportedDownload.setAttribute('download', '');
      img.classList.add('details-image__img--hidden');
      unsupported.classList.remove('details-image__unsupported--hidden');
    };

    img.addEventListener('error', () => {
      if (pendingUrl) failedUrls.add(pendingUrl);
      showUnsupported(loadingRendition);
    });

    // Resize the container to the actual image dimensions after load so we use
    // the real output AR, not the rendition's configured max-dimension bounds.
    // Only update for the active rendition — hover loads must not cause reflow.
    img.addEventListener('load', () => {
      if (img.naturalWidth && img.naturalHeight && img.src === srcFor(activeRendition)) {
        preview.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
      }
    });

    const setDisplay = (rendition, sticky) => {
      const url = srcFor(rendition);
      if (failedUrls.has(url)) {
        loadingRendition = rendition;
        showUnsupported(rendition);
      } else {
        pendingUrl = url;
        loadingRendition = rendition;
        showImage();
        img.src = url;
      }
      label.textContent = rendition?.label ? `Rendition: ${rendition.label}` : '';
      if (sticky) activeRendition = rendition;
    };

    // The img src is already set in block.innerHTML; just prime pendingUrl so the
    // error handler records the correct broken URL if the initial load fails.
    pendingUrl = srcFor(activeRendition);

    document.body.addEventListener('asc:rendition:activate', (e) => {
      setDisplay(e.detail.rendition, true);
    });

    document.body.addEventListener('asc:rendition:preview', (e) => {
      if (e.detail.rendition) {
        setDisplay(e.detail.rendition, false);
      } else {
        setDisplay(activeRendition, false);
      }
    });
  } catch (error) {
    console.error('details-image: Failed to load asset', error);
    block.innerHTML = `
      <div class="asc-ui-empty-state">
        <span class="asc-ui-empty-state__icon" aria-hidden="true">⚠️</span>
        <p class="asc-ui-empty-state__title">Asset not found</p>
        <p class="asc-ui-empty-state__hint">${error.message}</p>
      </div>
    `;
  }
}
