/** @owner user */
// Shared by image.js / video.js: download / copy-url / copy-image buttons for
// whichever rendition is currently shown in the main preview. Markup + a data
// attribute update happen per mount()/setDisplay() call (see updateRenditionActions);
// click handling is wired once from details-preview.js's decorate() (wireRenditionActions)
// so switching between image/video mounts never re-registers duplicate listeners on
// the shared .details-preview__viewer container.
import services from '../../scripts/asc/core/services/services.js';
import { canCopyImage, copyImageToClipboard } from '../../scripts/asc/core/utils/clipboard-image.js';

const ICONS = {
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  copyUrl: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  copyImage: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
};

function mimeToExt(mimeType) {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/tiff': 'tif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'video/x-msvideo': 'avi', 'application/pdf': 'pdf', 'application/zip': 'zip',
  };
  return map[mimeType] || mimeType?.split('/')[1] || '';
}

function buildFilename(asset, rendition) {
  if (rendition.filename) return rendition.filename;
  const base = asset.filename ? asset.filename.replace(/\.[^.]+$/, '') : asset.title;
  const ext = mimeToExt(rendition.mimeType) || asset.fileExtension || '';
  const idBase = (rendition.id || '').replace(/\.[a-zA-Z0-9]+$/, '');
  const suffix = idBase && idBase !== 'original' ? `-${idBase}` : '';
  return ext ? `${base}${suffix}.${ext}` : `${base}${suffix}`;
}

export function renditionActionsHtml() {
  return `
    <div class="details-preview__rendition-actions">
      <a class="btn btn--ghost btn--icon btn--sm details-preview__action-download" href="#"
         title="Download" aria-label="Download" data-asc-action="rendition:download@click" hidden>${ICONS.download}</a>
      <button class="btn btn--ghost btn--icon btn--sm details-preview__action-copy-url" type="button"
         title="Copy URL" aria-label="Copy URL" data-asc-action="rendition:copy-url@click" hidden>${ICONS.copyUrl}</button>
      <button class="btn btn--ghost btn--icon btn--sm details-preview__action-copy-image" type="button"
         title="Copy image" aria-label="Copy image" data-asc-action="rendition:copy-image@click" hidden>${ICONS.copyImage}</button>
    </div>`;
}

export function updateRenditionActions(container, asset, rendition) {
  const downloadBtn = container.querySelector('.details-preview__action-download');
  const copyUrlBtn = container.querySelector('.details-preview__action-copy-url');
  const copyImageBtn = container.querySelector('.details-preview__action-copy-image');
  if (!downloadBtn || !copyUrlBtn || !copyImageBtn) return;

  if (!rendition?.url) {
    downloadBtn.hidden = true;
    copyUrlBtn.hidden = true;
    copyImageBtn.hidden = true;
    return;
  }

  downloadBtn.hidden = false;
  downloadBtn.dataset.url = rendition.url;
  downloadBtn.dataset.downloadUrl = rendition.downloadUrl || '';
  downloadBtn.dataset.filename = buildFilename(asset, rendition);

  copyUrlBtn.hidden = false;
  copyUrlBtn.dataset.url = rendition.url;

  copyImageBtn.hidden = !canCopyImage(rendition);
  copyImageBtn.dataset.url = rendition.url;
  copyImageBtn.dataset.mimeType = rendition.mimeType || '';
}

// Blob download (not a plain <a download>) so we control the filename: native
// download is unreliable for this — cross-origin ignores the attribute, and
// same-origin AEM responses can override it with Content-Disposition.
async function blobDownload(url, filename) {
  try {
    const isAemUrl = url.startsWith(services.aem.getHost());
    const headers = isAemUrl ? await services.aem.getHeaders() : {};
    const res = await fetch(url, { credentials: isAemUrl ? 'include' : 'omit', headers });
    if (!res.ok) throw new Error(String(res.status));
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: blobUrl, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[ASC] rendition blob download failed, falling back to open:', err);
    window.open(url, '_blank');
  }
}

function flashCopyIcon(btn) {
  const original = btn.innerHTML;
  btn.innerHTML = ICONS.check;
  setTimeout(() => { btn.innerHTML = original; }, 1500);
}

export function wireRenditionActions(block) {
  block.addEventListener('click', async (e) => {
    const downloadBtn = e.target.closest('.details-preview__action-download');
    const copyUrlBtn = !downloadBtn && e.target.closest('.details-preview__action-copy-url');
    const copyImageBtn = !downloadBtn && !copyUrlBtn && e.target.closest('.details-preview__action-copy-image');
    const trigger = downloadBtn || copyUrlBtn || copyImageBtn;
    if (!trigger) return;
    e.preventDefault();

    if (downloadBtn) {
      if (downloadBtn.dataset.downloadUrl) {
        window.location.href = downloadBtn.dataset.downloadUrl;
      } else {
        await blobDownload(downloadBtn.dataset.url, downloadBtn.dataset.filename);
      }
    } else if (copyUrlBtn) {
      await navigator.clipboard.writeText(copyUrlBtn.dataset.url);
      flashCopyIcon(copyUrlBtn);
    } else if (copyImageBtn) {
      const result = await copyImageToClipboard({
        url: copyImageBtn.dataset.url,
        mimeType: copyImageBtn.dataset.mimeType,
      });
      if (result === 'failed') return;
      flashCopyIcon(copyImageBtn);
    }
  });
}
