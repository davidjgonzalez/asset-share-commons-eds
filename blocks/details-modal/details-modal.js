/** @owner user */
/**
 * details-modal — the native <dialog> shell for the asset details overlay.
 *
 * Authoring (da.live table):
 *
 *   | details-modal |         |
 *   | size          | wide    |   ← narrow | default | wide (default: wide)
 */

import services from '../../scripts/asc/core/services/services.js';
import { getVisibleAssetIds, getNeighborAssetId } from '../../scripts/asc/asset-navigation.js';
import { withViewTransition } from '../../scripts/asc/core/utils/view-transition.js';

const SIZE_CLASSES = { narrow: 'asc-dialog--narrow', wide: 'asc-dialog--wide' };
const ASSET_URL_PARAM = 'asset';

const ICONS = {
  chevronLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>',
  chevronRight: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
};

export default async function decorate(block) {
  const size = parseSize(block);
  block.innerHTML = html(size);
  addEventListeners(block);
}

function parseSize(block) {
  for (const row of block.children) {
    const cells = [...row.children];
    if (cells[0]?.textContent.trim().toLowerCase() === 'size') {
      return cells[1]?.textContent.trim().toLowerCase() || 'wide';
    }
  }
  return 'wide';
}

function html(size) {
  const sizeClass = SIZE_CLASSES[size] ? ` ${SIZE_CLASSES[size]}` : '';
  return `<dialog class="asc-dialog${sizeClass}">
            <button class="btn btn--ghost btn--icon close" aria-label="Close" data-asc-action="asset:details:close@click">&#x2715;</button>
            <button type="button" class="asc-ui-icon-btn details-modal__nav details-modal__nav--prev" aria-label="Previous asset" hidden>${ICONS.chevronLeft}</button>
            <button type="button" class="asc-ui-icon-btn details-modal__nav details-modal__nav--next" aria-label="Next asset" hidden>${ICONS.chevronRight}</button>
            <div class="content"></div>
          </dialog>`;
}

function currentAssetId() {
  return new URLSearchParams(window.location.search).get(ASSET_URL_PARAM);
}

function navigate(direction) {
  const id = currentAssetId();
  if (!id) return;
  const targetId = getNeighborAssetId(id, direction);
  if (!targetId) return;
  withViewTransition(() => services.assetDetails.open(targetId));
}

function addEventListeners(block) {
  document.body.addEventListener('asc:asset:details:close', () => {
    const dialogEl = block.querySelector('dialog');
    withViewTransition(() => dialogEl.close());
  });

  const dialog = block.querySelector('dialog');
  const content = dialog.querySelector('.content');
  const prevBtn = dialog.querySelector('.details-modal__nav--prev');
  const nextBtn = dialog.querySelector('.details-modal__nav--next');

  function refreshNav() {
    const id = currentAssetId();
    const ids = id ? getVisibleAssetIds() : [];
    const i = id ? ids.indexOf(id) : -1;
    const known = i !== -1;
    prevBtn.hidden = !known;
    nextBtn.hidden = !known;
    prevBtn.disabled = !known || i <= 0;
    nextBtn.disabled = !known || i >= ids.length - 1;
  }

  // Wire aria-labelledby + refresh Prev/Next state whenever new content is
  // loaded into the dialog — covers the initial open AND every Prev/Next
  // click, since both go through AssetDetails.open()'s content swap.
  const observer = new MutationObserver(() => {
    const heading = content.querySelector('h1, h2, h3');
    if (heading) {
      if (!heading.id) heading.id = 'details-modal-title';
      dialog.setAttribute('aria-labelledby', heading.id);
    } else {
      dialog.removeAttribute('aria-labelledby');
    }
    refreshNav();
  });
  observer.observe(content, { childList: true });

  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));

  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    if (e.key === 'ArrowLeft' && !prevBtn.hidden && !prevBtn.disabled) navigate(-1);
    if (e.key === 'ArrowRight' && !nextBtn.hidden && !nextBtn.disabled) navigate(1);
  });
}
