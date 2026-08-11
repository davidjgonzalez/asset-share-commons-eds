/** @owner user */
/**
 * details-actions — action buttons for the asset details view.
 *
 * Place this block on any details fragment page (`/details`, `/details/image`, etc.).
 * It reads the current asset via the `data-asc-asset` attribute set by the
 * details modal on the enclosing `<main>` element.
 *
 * Rendition-scoped actions (download, copy-url) act on whichever rendition is
 * currently active — the same "active rendition" concept tracked by
 * details-renditions (`asc:rendition:activate`), defaulting to "original" until
 * the user picks a different one there.
 *
 * Supported actions: download, copy-url, copy-link, collection, favorite
 * `share` is a deprecated alias for `copy-link`, kept so already-authored "Share"
 * rows get real behavior instead of the no-op they used to dispatch.
 *
 * `favorite` renders a star toggle that always targets the Favorites (default)
 * collection, regardless of which collection is currently active — distinct from
 * `collection`, which targets whichever collection is active. Add both rows to
 * offer both; the `collection` one auto-hides itself whenever the active
 * collection already IS Favorites, since the two would otherwise do the same
 * thing (see collection-toggle.js).
 *
 * Authoring (da.live table):
 *   | Download        | download       |
 *   | Copy URL        | copy-url       |
 *   | Copy asset link | copy-link      |
 *   | Collection      | collection     |
 *   | Favorite        | favorite       |
 */
import Asset from '../../scripts/asc/core/models/asset.js';
import services from '../../scripts/asc/core/services/services.js';
import collectionToggle from '../../scripts/asc/core/parts/collection-toggle/collection-toggle.js';
import { escHtml as esc } from '../../scripts/asc/html.js';

const VALID_ACTIONS = new Set(['download', 'copy-url', 'copy-link', 'share', 'collection', 'favorite']);

export default async function decorate(block) {
  const actionPairs = [...block.children]
    .map((row) => {
      const cells = [...row.children];
      return [cells[0]?.textContent.trim() ?? '', cells[1]?.textContent.trim() ?? ''];
    })
    .filter(([, action]) => VALID_ACTIONS.has(action));

  const asset = await Asset.create(block);
  if (!asset) {
    block.innerHTML = '';
    return;
  }

  let activeRendition = services.renditions.getRendition(asset, 'original') || asset.renditions[0] || null;

  block.innerHTML = html(asset, actionPairs, activeRendition);

  block.addEventListener('click', (e) => {
    if (e.target.closest('.details-actions__download')) {
      downloadRendition(asset, activeRendition);
      return;
    }

    const copyUrlBtn = e.target.closest('[data-copy-url]');
    if (copyUrlBtn) {
      copyText(copyUrlBtn, copyUrlBtn.dataset.copyUrl);
      return;
    }

    if (e.target.closest('.details-actions__copy-link')) {
      const url = new URL(window.location.href);
      url.searchParams.set('asset', asset.uuid);
      copyText(e.target.closest('.details-actions__copy-link'), url.toString());
    }
  });

  document.body.addEventListener('asc:rendition:activate', (e) => {
    activeRendition = e.detail.rendition;
    updateRenditionActions(block, activeRendition);
  });
}

function copyText(btn, text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => flashIcon(btn, ICONS.check));
}

function downloadRendition(asset, rendition) {
  if (!rendition?.url) return;
  const link = document.createElement('a');
  link.href = rendition.url;
  link.download = downloadFilename(asset, rendition);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function flashIcon(btn, iconSvg) {
  const icon = btn.querySelector('.asc-ui-action__icon');
  if (!icon) return;
  const original = icon.innerHTML;
  icon.innerHTML = iconSvg;
  setTimeout(() => { icon.innerHTML = original; }, 2000);
}

function updateRenditionActions(block, rendition) {
  if (!rendition) return;

  const copyUrlBtn = block.querySelector('[data-copy-url]');
  if (copyUrlBtn) copyUrlBtn.dataset.copyUrl = rendition.url;

}

function html(asset, actionPairs, rendition) {
  const buttons = actionPairs.map(([label, action]) => htmlButton(asset, action, rendition, label)).filter(Boolean).join('');
  return `<div class="asc-ui-actions" role="toolbar" aria-label="Asset actions">${buttons}</div>`;
}

function htmlButton(asset, action, rendition, label) {
  const url = rendition?.url || asset.url;

  switch (action) {
    case 'collection':
      return collectionToggle(asset, { addLabel: label, removeLabel: label });

    case 'favorite':
      return collectionToggle(asset, { favorite: true });

    case 'download':
      return `
        <button type="button" class="asc-ui-action details-actions__download">
          <span class="asc-ui-action__icon" aria-hidden="true">${ICONS.download}</span>
          <span>${esc(label)}</span>
        </button>`;

    case 'copy-url':
      return `
        <button class="asc-ui-action" type="button"
                data-copy-url="${esc(url)}"
                title="${esc(label)}" aria-label="${esc(label)}">
          <span class="asc-ui-action__icon" aria-hidden="true">${ICONS.copyUrl}</span>
          <span>${esc(label)}</span>
        </button>`;

    // `share` is a deprecated alias — same button/behavior as copy-link.
    case 'copy-link':
    case 'share':
      return `
        <button class="asc-ui-action details-actions__copy-link" type="button"
                title="${esc(label)}" aria-label="${esc(label)}">
          <span class="asc-ui-action__icon" aria-hidden="true">${ICONS.link}</span>
          <span>${esc(label)}</span>
        </button>`;

    default:
      return '';
  }
}

function downloadFilename(asset, rendition) {
  const base = asset.filename ? asset.filename.replace(/\.[^.]+$/, '') : (asset.title || 'download');
  // Extension: prefer MIME mapping, then parse from rendition filename, then asset extension.
  const ext = mimeToExt(rendition?.mimeType)
    || (rendition?.filename ? rendition.filename.split('.').pop() : '')
    || asset.fileExtension || '';
  // rendition.label is already cleaned by Rendition.deriveLabel (e.g. "cq5dam.preview" → "preview").
  // For the original rendition, omit the suffix so the download keeps the asset's own filename.
  const label = rendition?.label || '';
  const isOriginal = !label || label.toLowerCase() === 'original';
  const stem = isOriginal ? base : `${base}-${label}`;
  return ext ? `${stem}.${ext}` : stem;
}

function mimeToExt(mimeType) {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/tiff': 'tif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'video/x-msvideo': 'avi', 'application/pdf': 'pdf', 'application/zip': 'zip',
  };
  return map[mimeType] || mimeType?.split('/')[1] || '';
}

const ICONS = {
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  copyUrl: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  link: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
};
