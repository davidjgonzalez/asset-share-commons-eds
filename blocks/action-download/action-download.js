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

async function getAuthHeaders(url) {
  const isAemHost = url.startsWith(services.aem.getHost());
  return isAemHost ? services.aem.getHeaders() : {};
}

async function fetchBinary(url) {
  // AEM's CORS config allows credentialed cross-origin requests for API endpoints (e.g.
  // dam.downloadbinaries.json) but not for raw binary rendition paths — and auth here is a
  // Bearer token in a header anyway (see users.js), never a cookie, so credentials aren't
  // needed. Sending credentials: 'include' against a host that doesn't echo back
  // Access-Control-Allow-Credentials just makes the browser block the response outright.
  const headers = await getAuthHeaders(url);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

async function urlExists(url) {
  try {
    const headers = await getAuthHeaders(url);
    const res = await fetch(url, { method: 'HEAD', headers });
    return res.ok;
  } catch {
    return false;
  }
}

// Bounds how many fetches run at once without forcing callers to wait for a whole
// batch: the task doesn't start until a slot is free, but the caller gets a promise
// immediately, so it can be handed straight to zip.file() below.
function createLimiter(limit) {
  let active = 0;
  const queue = [];
  function runNext() {
    if (active >= limit || !queue.length) return;
    active += 1;
    const { task, resolve, reject } = queue.shift();
    task().then(resolve, reject).finally(() => {
      active -= 1;
      runNext();
    });
  }
  return (task) => new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    runNext();
  });
}

async function downloadAsZip(items, archiveName, onProgress) {
  const { default: JSZip } = await import(JSZIP_URL);
  const zip = new JSZip();
  const failures = [];
  let done = 0;
  const schedule = createLimiter(FETCH_CONCURRENCY);

  // HEAD-check first — no response body, so this doesn't cost meaningful memory —
  // so a 404/expired rendition is dropped before it ever becomes a zip entry,
  // rather than surfacing later as a spurious 0-byte file once GET-ing it fails.
  const liveItems = (await Promise.all(items.map(async (item) => {
    const ok = await schedule(() => urlExists(item.rendition.url));
    if (!ok) failures.push({ item, message: 'File not found' });
    return ok ? item : null;
  }))).filter(Boolean);

  // Register every remaining entry as a scheduled (not yet started) fetch promise
  // before generation begins, instead of awaiting all fetches into memory first.
  // JSZip reads one entry's bytes at a time while writing the archive, so this
  // pipelines fetching with zip-writing and lets each blob be released as soon as
  // it's consumed — peak resident blobs stays near FETCH_CONCURRENCY instead of
  // growing to the full asset count. The catch below is just a safety net for the
  // rare case a GET fails after its HEAD check passed (e.g. a race with deletion).
  liveItems.forEach((item) => {
    zip.file(item.entryPath, schedule(() => fetchBinary(item.rendition.url))
      .catch((err) => {
        failures.push({ item, message: err.message });
        return new Blob();
      })
      .finally(() => {
        done += 1;
        onProgress?.(done, liveItems.length);
      }));
  });

  if (!liveItems.length) {
    throw new Error(failures[0]?.message || 'Could not retrieve any files');
  }

  // STORE, not DEFLATE — renditions here are already-compressed images/video, so
  // deflating them buys nothing but costs CPU and an extra in-memory copy per file.
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });

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
            <span>${escHtml(def.label || def.id)}</span>
            ${def.usecase ? `<span class="asc-ui-copy action-download__rendition-usecase">${escHtml(def.usecase)}</span>` : ''}
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
