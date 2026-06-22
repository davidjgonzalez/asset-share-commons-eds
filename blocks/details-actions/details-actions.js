/** @owner user */
/**
 * details-actions — action buttons for the asset details view.
 *
 * Place this block on any details fragment page (`/details`, `/details/image`, etc.).
 * It reads the current asset via the `data-asc-asset` attribute set by the
 * details modal on the enclosing `<main>` element.
 *
 * Supported actions: download, copy-url, share, collection
 *
 * Authoring (da.live table):
 *   | Download   | download   |
 *   | Copy URL   | copy-url   |
 *   | Share      | share      |
 *   | Collection | collection |
 */
import Asset from '../../scripts/asc/models/asset.js';
import services from '../../scripts/asc/services/services.js';
import collectionToggle from '../../scripts/asc/parts/collection-toggle/collection-toggle.js';

const VALID_ACTIONS = new Set(['download', 'copy-url', 'share', 'collection']);

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
    const btn = e.target.closest('[data-copy-url]');
    if (!btn) return;
    const url = btn.dataset.copyUrl;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      const icon = btn.querySelector('.asc-ui-action__icon');
      if (icon) {
        const original = icon.innerHTML;
        icon.innerHTML = ICONS.check;
        setTimeout(() => { icon.innerHTML = original; }, 2000);
      }
    });
  });

  document.body.addEventListener('asc:rendition:activate', (e) => {
    activeRendition = e.detail.rendition;
    updateRenditionActions(block, asset, activeRendition);
  });
}

function updateRenditionActions(block, asset, rendition) {
  if (!rendition) return;

  const downloadLink = block.querySelector('.details-actions__download');
  if (downloadLink) {
    downloadLink.href = rendition.url;
    downloadLink.download = downloadFilename(asset, rendition);
  }

  const copyBtn = block.querySelector('[data-copy-url]');
  if (copyBtn) {
    copyBtn.dataset.copyUrl = rendition.url;
  }
}

function html(asset, actionPairs, rendition) {
  const buttons = actionPairs.map(([label, action]) => htmlButton(asset, action, rendition, label)).filter(Boolean).join('');
  return `<div class="asc-ui-actions">${buttons}</div>`;
}

function htmlButton(asset, action, rendition, label) {
  const url = rendition?.url || asset.url;
  const filename = rendition ? downloadFilename(asset, rendition) : (asset.filename || asset.title);

  switch (action) {
    case 'collection':
      return collectionToggle(asset, { addLabel: label, removeLabel: label });

    case 'download':
      return `
        <a class="asc-ui-action details-actions__download"
           href="${esc(url)}"
           download="${esc(filename)}">
          <span class="asc-ui-action__icon" aria-hidden="true">${ICONS.download}</span>
          <span>${esc(label)}</span>
        </a>`;

    case 'copy-url':
      return `
        <button class="asc-ui-action" type="button"
                data-copy-url="${esc(url)}"
                title="${esc(label)}" aria-label="${esc(label)}">
          <span class="asc-ui-action__icon" aria-hidden="true">${ICONS.copyUrl}</span>
          <span>${esc(label)}</span>
        </button>`;

    case 'share':
      return `
        <button class="asc-ui-action" type="button"
                data-asc-action="asset:share@click"
                data-asc-asset="${esc(asset.uuid)}"
                title="${esc(label)}" aria-label="${esc(label)}">
          <span class="asc-ui-action__icon" aria-hidden="true">${ICONS.share}</span>
          <span>${esc(label)}</span>
        </button>`;

    default:
      return '';
  }
}

function downloadFilename(asset, rendition) {
  const base = asset.filename ? asset.filename.replace(/\.[^.]+$/, '') : (asset.title || 'download');
  const ext = mimeToExt(rendition?.mimeType) || asset.fileExtension || '';
  return ext ? `${base}.${ext}` : base;
}

function mimeToExt(mimeType) {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/tiff': 'tif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'video/x-msvideo': 'avi', 'application/pdf': 'pdf', 'application/zip': 'zip',
  };
  return map[mimeType] || mimeType?.split('/')[1] || '';
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ICONS = {
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  copyUrl: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  share: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
};
