/** @owner user */
// Shared by image.js / video.js: download / copy-url / copy-image buttons for
// whichever rendition is currently shown in the main preview. Markup + a data
// attribute update happen per mount()/setDisplay() call (see updateRenditionActions);
// click handling is wired once from details-preview.js's decorate() (wireRenditionActions)
// so switching between image/video mounts never re-registers duplicate listeners on
// the shared .details-preview__viewer container.
import services from '../../scripts/asc/core/services/services.js';
import { canCopyImage, copyImageToClipboard } from '../../scripts/asc/core/utils/clipboard-image.js';
import { icon } from '../../scripts/asc/core/utils/icons.js';

const ICONS = {
  download: icon('download'),
  copyUrl: icon('upload'),
  copyImage: icon('image'),
  check: icon('check', { strokeWidth: 2.5 }),
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
