import services from '../../scripts/asc/core/services/services.js';
import { escHtml, escAttr } from '../../scripts/asc/html.js';
import { parseActionFragment, wireDialogClose } from '../../scripts/asc.js';

const JSZIP_URL = 'https://esm.sh/jszip@3.10.1';
const FETCH_CONCURRENCY = 6;
const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

// AEM's OOTB download-as-zip servlet (dam.downloadbinaries.json) only knows how to zip plain
// JCR paths under /content/dam — it has no processor for Dynamic Media/Scene7-delivered
// binaries (smart crops included, once the Scene7 feature flag is on) and silently produces a
// broken/empty archive rather than erroring. services.renditions already resolves a fetchable
// URL for every rendition type (static, dm-scene7, dm-openapi, url, ...), so build the zip
// client-side from those URLs instead of relying on the server-side archive job.

function extensionFromPath(path) {
  const match = path?.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1] : null;
}

function fileNameFor(asset, rendition) {
  if (rendition.filename) return rendition.filename;
  const stem = (asset.filename?.replace(/\.[^.]+$/, '')) || asset.title || asset.uuid || 'asset';
  if (rendition.id === 'original') return asset.filename || `${stem}.${extensionFromPath(rendition.path) || 'bin'}`;
  const ext = extensionFromPath(rendition.path) || MIME_EXTENSIONS[rendition.mimeType] || 'jpg';
  return `${stem}-${rendition.id}.${ext}`;
}

function zipEntryPath(asset, rendition, nestPerAsset) {
  const name = fileNameFor(asset, rendition).replace(/[\\/:*?"<>|]/g, '-');
  if (!nestPerAsset) return name;
  const folder = (asset.filename?.replace(/\.[^.]+$/, '') || asset.title || asset.uuid || 'asset')
    .replace(/[\\/:*?"<>|]/g, '-');
  return `${folder}/${name}`;
}

function buildDownloadItems(assets, selectedRenditionIds) {
  const ids = selectedRenditionIds.length ? selectedRenditionIds : ['original'];
  const nestPerAsset = ids.length > 1;
  const items = [];

  assets.forEach((asset) => {
    if (!asset.path) return;
    const seenUrls = new Set();
    ids.forEach((id) => {
      const rendition = services.renditions.getRendition(asset, id);
      if (!rendition?.url || seenUrls.has(rendition.url)) return;
      seenUrls.add(rendition.url);
      items.push({ asset, rendition, entryPath: zipEntryPath(asset, rendition, nestPerAsset) });
    });
  });

  return items;
}

async function fetchBinary(url) {
  // AEM's CORS config allows credentialed cross-origin requests for API endpoints (e.g.
  // dam.downloadbinaries.json) but not for raw binary rendition paths — and auth here is a
  // Bearer token in a header anyway (see users.js), never a cookie, so credentials aren't
  // needed. Sending credentials: 'include' against a host that doesn't echo back
  // Access-Control-Allow-Credentials just makes the browser block the response outright.
  const isAemHost = url.startsWith(services.aem.getHost());
  const headers = isAemHost ? await services.aem.getHeaders() : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function downloadAsZip(items, archiveName, onProgress) {
  const { default: JSZip } = await import(JSZIP_URL);
  const zip = new JSZip();
  const failures = [];
  let done = 0;

  await mapWithConcurrency(items, FETCH_CONCURRENCY, async (item) => {
    try {
      const blob = await fetchBinary(item.rendition.url);
      zip.file(item.entryPath, blob);
    } catch (err) {
      failures.push({ item, message: err.message });
    } finally {
      done += 1;
      onProgress?.(done, items.length);
    }
  });

  if (failures.length === items.length) {
    throw new Error(failures[0]?.message || 'Could not retrieve any files');
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = archiveName;
  link.click();
  URL.revokeObjectURL(url);

  return failures;
}

export default async function decorate(block) {
  const ctx = window.asc?.pendingAction || {};
  const collection = ctx.collectionId ? await services.collections.get(ctx.collectionId, true) : null;
  const assets = collection?.assets || ctx.assets || [];

  const allDefs = services.renditions.definitions;

  const parsed = parseActionFragment(block, { 'asset-count': assets.length });

  const renditionIds = parsed.renditionIds
    ?? allDefs.filter((d) => d.visible !== false).map((d) => d.id);
  const renditionDefs = renditionIds.map((id) => services.renditions.getRenditionDefinition(id) ?? { id, label: id });

  const closeButtons = parsed.actions.filter(({ hash }) => hash === '#close');
  const actionButtons = parsed.actions.filter(({ hash }) => hash !== '#close');

  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow action-download';
  dialog.setAttribute('aria-labelledby', 'action-download-title');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="action-download-title">${escHtml(parsed.title || 'Download')}</h2>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>&#x2715;</button>
    </header>
    <div class="asc-dialog__body">
      ${renditionDefs.length ? `
      <fieldset class="action-download__renditions">
        <legend>${escHtml(parsed.renditionLabel || 'Select renditions to download')}</legend>
        ${renditionDefs.map((def) => `
          <label class="action-download__rendition-option">
            <input type="checkbox" name="rendition" value="${escAttr(def.id)}" ${def.id === 'original' ? 'checked' : ''} />
            ${escHtml(def.label || def.id)}
          </label>`).join('')}
      </fieldset>` : ''}
    </div>
    <footer class="asc-dialog__footer">
      ${closeButtons.map(({ label }) => `<button type="button" class="btn btn--secondary" data-dialog-close>${escHtml(label)}</button>`).join('')}
      <div class="asc-dialog__footer-end">
        ${actionButtons.map(({ label, hash }) => `
          <button type="button" class="action-download__submit btn btn--primary" data-action="${escAttr(hash.slice(1))}">${escHtml(label)}</button>
        `).join('')}
      </div>
    </footer>`;

  if (parsed.bodyNodes.length) {
    const headerMain = dialog.querySelector('.asc-dialog__header-main');
    parsed.bodyNodes.forEach((n) => headerMain.appendChild(n));
  }

  document.body.appendChild(dialog);
  dialog.showModal();
  wireDialogClose(dialog);
  dialog.addEventListener('close', () => dialog.remove());

  dialog.querySelectorAll('.action-download__submit').forEach((btn) => {
    const origLabel = btn.textContent.trim();
    btn.addEventListener('click', async () => {
      const resolvedAssets = assets.filter((a) => a.path);
      if (!resolvedAssets.length) {
        alert('Asset paths could not be resolved. Ensure assets have a JCR path.');
        return;
      }

      const checked = [...dialog.querySelectorAll('input[name="rendition"]:checked')];
      const selectedRenditionIds = checked.map((cb) => cb.value);
      if (renditionDefs.length && !selectedRenditionIds.length) {
        alert('Please select at least one rendition.');
        return;
      }

      const archiveName = `${collection?.name || ctx.title || 'assets'}.zip`;
      const items = buildDownloadItems(resolvedAssets, selectedRenditionIds);
      if (!items.length) {
        alert('No downloadable renditions were found for the selected assets.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Preparing zip…';
      dialog.querySelector('.action-download__error')?.remove();

      try {
        const failures = await downloadAsZip(items, archiveName, (done, total) => {
          btn.textContent = `Fetching files… (${done}/${total})`;
        });
        btn.textContent = failures.length ? `Download started — ${failures.length} file(s) skipped` : 'Download started ✓';
        setTimeout(() => dialog.close(), 2000);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = origLabel;
        const errEl = Object.assign(document.createElement('p'), {
          className: 'action-download__error',
          textContent: `Download failed: ${err.message}`,
        });
        dialog.querySelector('.asc-dialog__footer').prepend(errEl);
      }
    });
  });
}
