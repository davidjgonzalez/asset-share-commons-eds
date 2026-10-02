/** @owner user */
import { toggleRenditionMenu, prefetchRenditionSizes } from '../../scripts/asc/core/parts/rendition-download-menu/rendition-download-menu.js';
import { canCopyImage, copyImageToClipboard } from '../../scripts/asc/core/utils/clipboard-image.js';
import { icon } from '../../scripts/asc/core/utils/icons.js';

function flashActionIcon(button, success) {
  const original = button.innerHTML;
  button.innerHTML = success
    ? icon('check', { strokeWidth: 2.5 })
    : icon('warning', { strokeWidth: 2.5 });
  setTimeout(() => { button.innerHTML = original; }, success ? 1500 : 3000);
}

function downloadRendition(asset, rendition) {
  if (!rendition?.url) return;
  const link = document.createElement('a');
  link.href = rendition.url;
  link.download = rendition.filename || asset.filename || asset.title || 'asset';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function initRenditionActions(block) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  const getAsset = (button) => window.asc?.cache?.assets?.get(button.dataset.ascAsset);
  viewport.addEventListener('click', (event) => {
    const button = event.target.closest('.board__rendition-action');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    const asset = getAsset(button);
    if (!asset) return;
    const action = button.dataset.boardAction;
    toggleRenditionMenu(button, asset, async (rendition) => {
      if (action === 'download') {
        downloadRendition(asset, rendition);
      } else if (action === 'copy-url') {
        try {
          await navigator.clipboard.writeText(rendition.url);
          flashActionIcon(button, true);
        } catch {
          flashActionIcon(button, false);
        }
      } else if (action === 'copy-image') {
        const result = await copyImageToClipboard(rendition);
        const originalLabel = button.getAttribute('aria-label');
        if (result !== 'failed') {
          button.setAttribute('aria-label', result === 'image'
            ? 'Image copied'
            : 'Link copied because image copy is unavailable');
          setTimeout(() => button.setAttribute('aria-label', originalLabel), 1500);
        }
        flashActionIcon(button, result !== 'failed');
      }
    }, {
      title: { download: 'Download', 'copy-url': 'Copy URL', 'copy-image': 'Copy Image' }[action],
      filter: action === 'copy-image' ? canCopyImage : undefined,
    });
  });

  viewport.addEventListener('mouseover', (event) => {
    const button = event.target.closest('.board__rendition-action');
    const asset = button && getAsset(button);
    if (asset) prefetchRenditionSizes(asset);
  });
}
