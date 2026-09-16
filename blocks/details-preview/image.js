/** @owner user */
import { escAttr } from '../../scripts/asc/html.js';
import { renditionTagsHtml, parseFields } from './rendition-tags.js';
import { renditionActionsHtml, updateRenditionActions } from './rendition-actions.js';

export function mount(container, asset, initialRendition, config = {}) {
  const failedUrls = new Set();
  let pendingUrl = null;
  let loadingRendition = initialRendition;
  const fields = parseFields(config.info);

  const srcFor = (r) => r?.url || asset.thumbnail;

  container.innerHTML = `
    <img src="${escAttr(srcFor(initialRendition))}" alt="${escAttr(asset.title)}" loading="eager">
    <div class="details-preview__rendition-overlay">
      <div class="details-preview__rendition-info">
        <span class="asc-ui-chip details-preview__rendition-label"></span>
        <span class="details-preview__rendition-tags"></span>
      </div>
      ${renditionActionsHtml()}
    </div>
    <div class="details-preview__unsupported details-preview__unsupported--hidden asc-ui-empty-state">
      <p class="asc-ui-empty-state__title">Preview not available</p>
      <p class="asc-ui-empty-state__hint details-preview__unsupported-hint"></p>
      <a class="details-preview__unsupported-download btn btn--primary">Download</a>
    </div>`;

  const img = container.querySelector('img');
  const label = container.querySelector('.details-preview__rendition-label');
  const tags = container.querySelector('.details-preview__rendition-tags');
  const overlay = container.querySelector('.details-preview__rendition-overlay');
  const unsupported = container.querySelector('.details-preview__unsupported');
  const unsupportedHint = container.querySelector('.details-preview__unsupported-hint');
  const unsupportedDownload = container.querySelector('.details-preview__unsupported-download');

  const showImage = () => {
    img.classList.remove('details-preview__img--hidden');
    unsupported.classList.add('details-preview__unsupported--hidden');
  };

  const showUnsupported = (rendition) => {
    const name = rendition?.label || rendition?.name || 'This rendition';
    unsupportedHint.textContent = `${name} could not be displayed.`;
    unsupportedDownload.href = srcFor(rendition);
    unsupportedDownload.setAttribute('download', '');
    img.classList.add('details-preview__img--hidden');
    unsupported.classList.remove('details-preview__unsupported--hidden');
  };

  img.addEventListener('error', () => {
    if (pendingUrl) failedUrls.add(pendingUrl);
    showUnsupported(loadingRendition);
  });

  // Prime pendingUrl so the error handler records the initial broken URL correctly.
  pendingUrl = srcFor(initialRendition);

  const setDisplay = (rendition, _sticky) => {
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
    label.textContent = rendition?.label ? rendition.label : '';
    tags.innerHTML = renditionTagsHtml(rendition, fields);
    updateRenditionActions(overlay, asset, rendition);
  };

  return {
    setDisplay,
    dispose() { container.innerHTML = ''; },
  };
}
