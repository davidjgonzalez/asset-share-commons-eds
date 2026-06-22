/** @owner user */
import services from '../../scripts/asc/services/services.js';
import { Events as CollectionEvents } from '../../scripts/asc/services/collections/collections.js';
import { Events as DownloadEvents, Status as DownloadStatus } from '../../scripts/asc/services/downloads/downloads.js';
import { escHtml, escAttr, formatUpdated } from '../../scripts/html.js';

const configurations = (await import('../../scripts/configurations.js')).default;

// Sheet path for share URL generation (configurable, default /sheets/)
const SHEET_PATH = configurations.collections?.sheetPath || '/sheets/';

/**
 * Collection block — detail/edit page for a single collection.
 *
 * Page URL: /collections/collection?id=<uuid>
 * The block reads the collection UUID from the `id` query parameter.
 * Falls back to the active collection when `id` is absent or unrecognised.
 *
 * Features:
 *   - Editable collection name (Rename → inline field; no icon-only control)
 *   - Asset list with Remove actions, drag handle (CSS dots), reorder
 *   - Share / Download / Delete collection using global .btn utilities
 *   - Dialogs use .asc-dialog shell (styles/styles.css)
 */
export default async function decorate(block) {
  const collectionId = resolveCollectionId();
  await render(block, collectionId);

  document.addEventListener(CollectionEvents.CHANGED, async (e) => {
    if (e.detail?.source === 'block') return;
    await render(block, collectionId);
  });

  document.addEventListener(DownloadEvents.CHANGED, () => refreshDownloadStatus(block));
  document.addEventListener(DownloadEvents.COMPLETE, () => refreshDownloadStatus(block));
  document.addEventListener(DownloadEvents.FAILED, () => refreshDownloadStatus(block));

  // Close the actions menu on any outside click (survives re-renders).
  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) closeMenu(block);
  });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

async function render(block, collectionId) {
  const collection = await services.collections.get(collectionId, true);
  if (!collection) {
    block.innerHTML = '<p class="collection__not-found">Collection not found.</p>';
    return;
  }
  const data = services.collections._getData();
  const isDefault = data.defaultId === collection.id;
  const pendingJobs = services.downloads.getAll().filter(
    (j) => j.collectionId === collection.id
      && (j.status === DownloadStatus.RUNNING || j.status === DownloadStatus.PENDING),
  );

  block.innerHTML = html(collection, isDefault, pendingJobs);
  initInteractions(block, collection, isDefault);
}

function html(collection, isDefault, pendingJobs) {
  const assets = collection.assets || [];
  const updated = formatUpdated(collection.modifiedAt);
  return `
    <section class="collection__shell" aria-label="Collection">
    <header class="collection__header">
      <div class="collection__title-row">
        <h1 class="collection__name" data-collection-id="${collection.id}">${escHtml(collection.name)}</h1>
        <div class="collection__menu-wrap">
          <button type="button" class="collection__menu-trigger btn btn--ghost btn--icon btn--sm"
                  aria-label="Collection actions" aria-haspopup="true" aria-expanded="false">⋯</button>
          <div class="collection__menu asc-panel asc-panel--no-pad" hidden>
            <ul class="asc-ui-menu" role="menu">
              <li role="none">
                <button type="button" class="collection__rename-btn asc-ui-menu__item" role="menuitem">Rename</button>
              </li>
              ${!isDefault ? `
              <li role="none"><hr class="asc-ui-menu__separator"></li>
              <li role="none">
                <button type="button" class="collection__delete-btn asc-ui-menu__item collection__menu-item--danger" role="menuitem">Delete collection</button>
              </li>` : ''}
            </ul>
          </div>
        </div>
      </div>
      <p class="collection__meta">
        <span class="collection__meta-count">${assets.length} asset${assets.length !== 1 ? 's' : ''}</span>
        ${updated
    ? `<span class="collection__meta-sep" aria-hidden="true">·</span><time class="collection__meta-updated" datetime="${escAttr(updated.iso)}">${escHtml(updated.label)}</time>`
    : ''}
      </p>
    </header>

    <div class="collection__toolbar">
      <button type="button" class="collection__share-btn btn btn--secondary">Share</button>
      <button type="button" class="collection__download-btn btn btn--primary"
              ${assets.length === 0 ? 'disabled' : ''}>Download</button>
    </div>

    ${pendingJobs.length ? renderJobsStatus(pendingJobs) : ''}

    <div class="collection__asset-list" data-collection-id="${collection.id}">
      ${assets.length
    ? assets.map((asset, i) => assetRow(asset, i)).join('')
    : '<p class="collection__empty">No assets in this collection yet.</p>'}
    </div>
    </section>`;
}

function renderJobsStatus(jobs) {
  return `
    <div class="collection__jobs">
      <h3 class="collection__jobs-title">Active Downloads</h3>
      <ul class="collection__jobs-list">
        ${jobs.map((job) => `
          <li class="collection__job" data-job-id="${job.id}">
            <span class="collection__job-status collection__job-status--${job.status}">
              ${jobStatusLabel(job)}
            </span>
            ${job.status === DownloadStatus.COMPLETE && job.downloadUrl
    ? `<button type="button" class="collection__job-download btn btn--secondary btn--sm" data-job-id="${job.id}">Download again</button>`
    : ''}
            ${job.status === DownloadStatus.RUNNING
    ? `<button type="button" class="collection__job-resume btn btn--ghost btn--sm" data-job-id="${job.id}">Check status</button>`
    : ''}
          </li>`).join('')}
      </ul>
    </div>`;
}

function assetRow(asset, index) {
  const thumbnailUrl = services.renditions.getThumbnailUrl(asset);
  return `
    <div class="collection__asset-row"
         draggable="true"
         data-asc-asset="${asset.uuid}"
         data-index="${index}">
      <div class="collection__asset-drag" aria-hidden="true" title="Drag to reorder"></div>
      <div class="collection__asset-thumb">
        <img src="${thumbnailUrl}" alt="${escHtml(asset.title)}" loading="lazy" />
      </div>
      <div class="collection__asset-info">
        <div class="collection__asset-title">${escHtml(asset.title)}</div>
        <div class="collection__asset-meta">${escHtml(asset.getProperty('file-type') || '')}</div>
      </div>
      <button type="button" class="collection__asset-remove btn btn--ghost btn--sm"
              aria-label="Remove ${escHtml(asset.title)} from collection"
              data-asc-action="collection:remove@click"
              data-asc-asset="${asset.uuid}">Remove</button>
    </div>`;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

function initInteractions(block, collection, isDefault) {
  initMenu(block);
  initRename(block, collection);
  initShare(block, collection);
  initDownload(block, collection);
  if (!isDefault) initDelete(block, collection);
  initReorder(block, collection);
  initJobActions(block);
}

// ── Actions menu ─────────────────────────────────────────────────────────────

function closeMenu(block) {
  block.querySelector('.collection__menu')?.setAttribute('hidden', '');
  block.querySelector('.collection__menu-trigger')?.setAttribute('aria-expanded', 'false');
}

function initMenu(block) {
  const trigger = block.querySelector('.collection__menu-trigger');
  const menu = block.querySelector('.collection__menu');
  if (!trigger || !menu) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !menu.hasAttribute('hidden');
    if (isOpen) {
      closeMenu(block);
    } else {
      menu.removeAttribute('hidden');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  // Close on item selection
  menu.addEventListener('click', () => closeMenu(block));
}

// ── Rename ────────────────────────────────────────────────────────────────────

function initRename(block, collection) {
  block.querySelector('.collection__rename-btn')?.addEventListener('click', () => {
    const nameEl = block.querySelector('.collection__name');
    const current = nameEl.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'collection__name-input';
    input.value = current;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
      const val = input.value.trim();
      if (val && val !== current) {
        services.collections.rename(collection.id, val);
      }
      input.replaceWith(nameEl);
      nameEl.textContent = val || current;
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { input.replaceWith(nameEl); }
    });
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

function initDelete(block, collection) {
  block.querySelector('.collection__delete-btn')?.addEventListener('click', () => {
    if (!window.confirm(`Delete "${collection.name}"? This cannot be undone.`)) return;
    services.collections.delete(collection.id);
    // Navigate to collections index
    const managePath = configurations.collections?.managePath || '/collections/';
    window.location.href = managePath;
  });
}

// ── Share ─────────────────────────────────────────────────────────────────────

function initShare(block, collection) {
  block.querySelector('.collection__share-btn')?.addEventListener('click', async () => {
    openShareDialog(block, collection);
  });
}

async function openShareDialog(block, collection) {
  block.querySelector('.collection__share-dialog')?.remove();

  const assetIds = collection.assetIds || [];
  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow collection__share-dialog';
  dialog.setAttribute('aria-labelledby', 'share-dialog-title');
  dialog.setAttribute('aria-describedby', 'share-dialog-description');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="share-dialog-title">Share Collection</h2>
        <p class="asc-dialog__description" id="share-dialog-description">
          Create a shareable link to this collection as a download sheet.
        </p>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>✕</button>
    </header>
    <div class="asc-dialog__body">
      <label class="collection__dialog-label">
        Sheet Title
        <input type="text" class="collection__share-title" value="${escHtml(collection.name)}" placeholder="Sheet title" />
      </label>
      <label class="collection__dialog-label">
        Description
        <textarea class="collection__share-description" placeholder="Optional description" rows="3"></textarea>
      </label>
      <div class="collection__share-url-wrap" hidden>
        <label class="collection__dialog-label">
          Share URL
          <input type="text" class="collection__share-url-output" readonly />
        </label>
        <button type="button" class="btn btn--secondary collection__share-copy" hidden>Copy</button>
      </div>
    </div>
    <footer class="asc-dialog__footer">
      <button type="button" class="btn btn--secondary" data-dialog-close>Cancel</button>
      <div class="asc-dialog__footer-end">
        <button type="button" class="btn btn--primary collection__share-generate">Generate Link</button>
      </div>
    </footer>`;

  block.appendChild(dialog);
  dialog.showModal();

  dialog.querySelectorAll('[data-dialog-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  dialog.querySelector('.collection__share-generate').addEventListener('click', async () => {
    const title = encodeURIComponent(dialog.querySelector('.collection__share-title').value.trim());
    const description = encodeURIComponent(dialog.querySelector('.collection__share-description').value.trim());
    const compressed = await services.url.compressArray(assetIds);

    let url = `${window.location.origin}${SHEET_PATH}?assets=${compressed}`;
    if (title) url += `&title=${title}`;
    if (description) url += `&description=${description}`;

    const wrap = dialog.querySelector('.collection__share-url-wrap');
    wrap.removeAttribute('hidden');
    wrap.querySelector('.collection__share-url-output').value = url;
    dialog.querySelector('.collection__share-copy')?.removeAttribute('hidden');
  });

  dialog.querySelector('.collection__share-copy')?.addEventListener('click', () => {
    const output = dialog.querySelector('.collection__share-url-output');
    navigator.clipboard.writeText(output.value).then(() => {
      const btn = dialog.querySelector('.collection__share-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });
}

// ── Download ──────────────────────────────────────────────────────────────────

function initDownload(block, collection) {
  block.querySelector('.collection__download-btn')?.addEventListener('click', () => {
    openDownloadDialog(block, collection);
  });
}

async function openDownloadDialog(block, collection) {
  block.querySelector('.collection__download-dialog')?.remove();

  const assets = collection.assets || [];
  const renditionDefs = getVisibleRenditionDefs(assets);

  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow collection__download-dialog';
  dialog.setAttribute('aria-labelledby', 'download-dialog-title');
  dialog.setAttribute('aria-describedby', 'download-dialog-description');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="download-dialog-title">Download Collection</h2>
        <p class="asc-dialog__description" id="download-dialog-description">
          ${assets.length} asset${assets.length !== 1 ? 's' : ''} — choose renditions, then start the download job.
        </p>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>✕</button>
    </header>
    <div class="asc-dialog__body">
      <fieldset class="collection__download-renditions">
        <legend>Select renditions to download</legend>
        ${renditionDefs.length
    ? renditionDefs.map((def) => `
            <label class="collection__rendition-option">
              <input type="checkbox" name="rendition" value="${escAttr(def.id)}"
                     ${def.id === 'original' ? 'checked' : ''} />
              ${escHtml(def.label || def.id)}
            </label>`).join('')
    : '<p>No renditions configured. <a href="/config">Configure renditions</a>.</p>'}
      </fieldset>
      <p class="collection__download-note">
        Large collections may take a moment. Your download will start automatically.
      </p>
    </div>
    <footer class="asc-dialog__footer">
      <button type="button" class="btn btn--secondary" data-dialog-close>Cancel</button>
      <div class="asc-dialog__footer-end">
        <button type="button" class="collection__download-submit btn btn--primary"
                ${renditionDefs.length === 0 ? 'disabled' : ''}>
          Start Download
        </button>
      </div>
    </footer>`;

  block.appendChild(dialog);
  dialog.showModal();

  dialog.querySelectorAll('[data-dialog-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  dialog.querySelector('.collection__download-submit').addEventListener('click', async () => {
    const checked = [...dialog.querySelectorAll('input[name="rendition"]:checked')];
    const selectedRenditionIds = checked.map((cb) => cb.value);
    if (!selectedRenditionIds.length) {
      alert('Please select at least one rendition.');
      return;
    }

    // Build JCR asset paths from asset objects
    const assetPaths = assets.map((a) => a.path).filter(Boolean);
    if (!assetPaths.length) {
      alert('Asset paths could not be resolved. Ensure assets have a JCR path.');
      return;
    }

    const submitBtn = dialog.querySelector('.collection__download-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    await services.downloads.create(assetPaths, selectedRenditionIds, {
      collectionId: collection.id,
      autoDownload: true,
    });

    submitBtn.textContent = 'Job submitted — download will start automatically';
    setTimeout(() => dialog.close(), 3000);
  });
}

// ── Reorder (drag-and-drop) ───────────────────────────────────────────────────

function initReorder(block, collection) {
  const list = block.querySelector('.collection__asset-list');
  if (!list) return;

  let dragging = null;

  list.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.collection__asset-row');
    if (!row) return;
    dragging = row;
    row.classList.add('collection__asset-row--dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragend', () => {
    dragging?.classList.remove('collection__asset-row--dragging');
    list.querySelectorAll('.collection__asset-row--over').forEach((el) => {
      el.classList.remove('collection__asset-row--over');
    });
    dragging = null;
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.collection__asset-row');
    if (!target || target === dragging) return;
    list.querySelectorAll('.collection__asset-row--over').forEach((el) => {
      el.classList.remove('collection__asset-row--over');
    });
    target.classList.add('collection__asset-row--over');
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('.collection__asset-row');
    if (!target || !dragging || target === dragging) return;

    // Reorder in DOM
    const rows = [...list.querySelectorAll('.collection__asset-row')];
    const fromIdx = rows.indexOf(dragging);
    const toIdx = rows.indexOf(target);
    if (fromIdx < toIdx) {
      target.after(dragging);
    } else {
      target.before(dragging);
    }

    // Persist new order
    const newOrder = [...list.querySelectorAll('.collection__asset-row')]
      .map((r) => r.dataset.ascAsset);
    services.collections.reorderAssets(collection.id, newOrder);
  });
}

// ── Download job actions ──────────────────────────────────────────────────────

function initJobActions(block) {
  block.addEventListener('click', async (e) => {
    const resumeBtn = e.target.closest('.collection__job-resume');
    if (resumeBtn) {
      resumeBtn.disabled = true;
      resumeBtn.textContent = 'Checking…';
      await services.downloads.resume(resumeBtn.dataset.jobId);
      resumeBtn.disabled = false;
      resumeBtn.textContent = 'Check status';
    }

    const dlBtn = e.target.closest('.collection__job-download');
    if (dlBtn) {
      services.downloads.triggerDownload(dlBtn.dataset.jobId);
    }
  });
}

function refreshDownloadStatus(block) {
  const jobsSection = block.querySelector('.collection__jobs');
  if (!jobsSection) return;
  const collectionId = block.querySelector('[data-collection-id]')?.dataset?.collectionId;
  if (!collectionId) return;

  const pendingJobs = services.downloads.getAll().filter(
    (j) => j.collectionId === collectionId
      && (j.status === DownloadStatus.RUNNING || j.status === DownloadStatus.PENDING),
  );

  if (!pendingJobs.length) {
    jobsSection.remove();
    return;
  }
  jobsSection.outerHTML = renderJobsStatus(pendingJobs);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveCollectionId() {
  // Read UUID from ?id= query param (e.g. /collections/collection?id=<uuid>)
  const id = new URLSearchParams(window.location.search).get('id') || '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    return id;
  }
  return services.collections.getActiveId();
}

function getVisibleRenditionDefs(assets) {
  // Collect rendition definitions visible across at least one of the assets
  if (!assets.length) return [];
  const seen = new Map();
  assets.forEach((asset) => {
    (asset.renditions || []).forEach((r) => {
      if (r.visible !== false && !seen.has(r.id)) {
        seen.set(r.id, { id: r.id, label: r.label || r.id });
      }
    });
  });
  return [...seen.values()];
}

function jobStatusLabel(job) {
  switch (job.status) {
    case DownloadStatus.PENDING: return 'Waiting to start…';
    case DownloadStatus.RUNNING: return 'Preparing your download…';
    case DownloadStatus.COMPLETE: return 'Ready to download';
    case DownloadStatus.FAILED: return `Failed: ${job.error || 'Unknown error'}`;
    default: return job.status;
  }
}

