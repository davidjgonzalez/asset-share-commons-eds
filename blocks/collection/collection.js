/** @owner user */
import services from '../../scripts/asc/services/services.js';
import storage from '../../scripts/asc/services/storage/storage.js';
import { Events as CollectionEvents } from '../../scripts/asc/services/collections/collections.js';
import { Events as DownloadEvents, Status as DownloadStatus } from '../../scripts/asc/services/downloads/downloads.js';
import { escHtml, escAttr, formatUpdated } from '../../scripts/html.js';

const configurations = (await import('../../scripts/configurations.js')).default;

const SHEET_PATH = configurations.collections?.sheetPath || '/sheets/';
const SHARE_HISTORY_KEY = 'shareHistory';
const MAX_SHARE_HISTORY = 20;

// Board text items are owned by the board block; the collection block reads them
// here only when encoding the share payload so text elements survive into the sheet.
const BOARD_TEXT_KEY = (id) => `asc:boardText:${id}`;
function getBoardTextItems(collectionId) {
  try { return JSON.parse(localStorage.getItem(BOARD_TEXT_KEY(collectionId))) || []; } catch { return []; }
}


/**
 * Collection block — detail/edit page for a single collection.
 *
 * Page URL: /collections/collection?id=<uuid>
 *
 * Features:
 *   - Board canvas: pan (drag background), zoom (scroll), Fit view, Expand, Align to grid
 *   - Draggable asset cards with per-asset notes; position saved via updateItem()
 *   - Free-floating text elements stored in localStorage (asc:boardText:{id})
 *   - Rubber-band + shift-click multi-select; group drag
 *   - Editable collection name
 *   - Share / Download / Delete using global .btn utilities
 *   - Dialogs use .asc-dialog shell
 */
export default async function decorate(block) {
  const collectionId = resolveCollectionId();
  await render(block, collectionId);

  document.addEventListener(CollectionEvents.CHANGED, async (e) => {
    if (e.detail?.source === 'block') return;
    await render(block, collectionId);
  });

  [DownloadEvents.CHANGED, DownloadEvents.COMPLETE, DownloadEvents.FAILED].forEach((ev) => {
    document.addEventListener(ev, () => refreshDownloadStatus(block, collectionId));
  });

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
  const pendingJobs = getPendingJobs(collection.id);
  block.innerHTML = html(collection, isDefault, pendingJobs);
  initInteractions(block, collection, isDefault);
}

function html(collection, isDefault, pendingJobs) {
  const items = collection.hydratedItems || [];
  const assetCount = items.filter((i) => i.type === 'asset').length;
  const updated = formatUpdated(collection.modifiedAt);
  return `
    <section class="collection__shell" aria-label="Collection">
    <header class="collection__header">
      <div class="collection__title-row">
        <h1 class="collection__name" data-collection-id="${collection.id}">${escHtml(collection.name)}</h1>
        <div class="collection__menu-wrap">
          <button type="button" class="collection__menu-trigger btn btn--ghost btn--icon btn--sm"
                  aria-label="Collection actions" aria-haspopup="true" aria-expanded="false">&#8943;</button>
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
        <span class="collection__meta-count">${assetCount} asset${assetCount !== 1 ? 's' : ''}</span>
        ${updated
    ? `<span class="collection__meta-sep" aria-hidden="true">&#183;</span><time class="collection__meta-updated" datetime="${escAttr(updated.iso)}">${escHtml(updated.label)}</time>`
    : ''}
      </p>
    </header>

    <div class="collection__toolbar">
      <div class="collection__toolbar-end">
        <div class="collection__past-shares">${renderShareHistory()}</div>
        <button type="button" class="collection__share-btn btn btn--secondary">Share</button>
        <button type="button" class="collection__download-btn btn btn--primary"
                ${assetCount === 0 ? 'disabled' : ''}>Download</button>
      </div>
    </div>

    ${pendingJobs.length ? renderJobsStatus(pendingJobs) : ''}

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

// ─── Interactions ─────────────────────────────────────────────────────────────

function initInteractions(block, collection, isDefault) {
  initMenu(block);
  initRename(block, collection);
  initShare(block, collection);
  initDownload(block, collection);
  if (!isDefault) initDelete(block, collection);
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
    const managePath = configurations.collections?.managePath || '/collections/';
    window.location.href = managePath;
  });
}

// ── Share ─────────────────────────────────────────────────────────────────────

function saveShareHistory(entry) {
  const history = storage.get(SHARE_HISTORY_KEY) || [];
  history.unshift({ id: crypto.randomUUID(), ...entry, createdAt: new Date().toISOString() });
  storage.set(SHARE_HISTORY_KEY, history.slice(0, MAX_SHARE_HISTORY));
}

function renderShareHistory() {
  const history = storage.get(SHARE_HISTORY_KEY) || [];
  if (!history.length) return '';

  const items = history.map((entry) => {
    const label = new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `
      <li class="collection__past-share-row">
        <span class="asc-ui-menu__item-label" title="${escAttr(entry.url)}">${escHtml(entry.title || 'Untitled')}</span>
        <span class="asc-ui-menu__item-meta">${escHtml(label)}</span>
        <button type="button" class="btn btn--ghost btn--circle btn--sm collection__share-history-copy"
                data-url="${escAttr(entry.url)}" aria-label="Copy link">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <a href="${escAttr(entry.url)}" target="_blank" rel="noopener noreferrer"
           class="btn btn--ghost btn--circle btn--sm" aria-label="Open link">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </li>`;
  }).join('');

  return `
    <div class="asc-ui-dropdown collection__past-shares-dropdown">
      <button type="button"
              class="btn btn--ghost collection__past-shares-trigger"
              aria-expanded="false"
              aria-haspopup="true">
        Past Shares <span class="asc-ui-count asc-ui-count--muted">${history.length}</span>
      </button>
      <div class="asc-ui-dropdown__panel collection__past-shares-panel" hidden>
        <ul class="asc-ui-menu">${items}</ul>
      </div>
    </div>`;
}

function initShare(block, collection) {
  block.querySelector('.collection__share-btn')?.addEventListener('click', () => {
    openShareDialog(block, collection);
  });

  block.addEventListener('click', (e) => {
    const trigger = e.target.closest('.collection__past-shares-trigger');
    if (trigger) {
      const panel = trigger.closest('.collection__past-shares-dropdown')
        ?.querySelector('.collection__past-shares-panel');
      if (!panel) return;
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      panel.hidden = expanded;
      trigger.setAttribute('aria-expanded', String(!expanded));
      return;
    }

    const copyBtn = e.target.closest('.collection__share-history-copy');
    if (copyBtn) {
      flashCopy(copyBtn, copyBtn.dataset.url);
      return;
    }

    if (!e.target.closest('.collection__past-shares-dropdown')) {
      const openDropdown = block.querySelector('.collection__past-shares-panel:not([hidden])');
      if (openDropdown) {
        openDropdown.hidden = true;
        openDropdown.closest('.collection__past-shares-dropdown')
          ?.querySelector('.collection__past-shares-trigger')
          ?.setAttribute('aria-expanded', 'false');
      }
    }
  });
}

async function openShareDialog(block, collection) {
  block.querySelector('.collection__share-dialog')?.remove();

  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow collection__share-dialog';
  dialog.setAttribute('aria-labelledby', 'share-dialog-title');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="share-dialog-title">Share Collection</h2>
        <p class="asc-dialog__description">
          Create a shareable link to this collection as a download sheet.
        </p>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>&#x2715;</button>
    </header>
    <div class="asc-dialog__body">
      <label class="collection__dialog-label">
        Sheet Title
        <input type="text" class="collection__share-title" value="${escHtml(collection.name)}" placeholder="Sheet title" />
      </label>
      <label class="collection__dialog-label">
        Description
        <textarea class="collection__share-description" rows="3" placeholder="Optional context or usage guidance for recipients&#8230;"></textarea>
      </label>
      <label class="collection__dialog-label">
        Expires in
        <div class="collection__share-expires-wrap">
          <input type="number" class="collection__share-expires" min="1" max="365" placeholder="No expiry" />
          <span class="collection__share-expires-unit">days</span>
        </div>
      </label>
      <div class="collection__share-url-wrap" hidden>
        <label class="collection__dialog-label">
          Share URL
          <input type="text" class="collection__share-url-output" readonly />
        </label>
      </div>
    </div>
    <footer class="asc-dialog__footer">
      <button type="button" class="btn btn--secondary" data-dialog-close>Cancel</button>
      <div class="asc-dialog__footer-end">
        <button type="button" class="btn btn--secondary collection__share-generate">Generate Link</button>
        <button type="button" class="btn btn--primary collection__share-copy" hidden>Copy Share Link</button>
      </div>
    </footer>`;

  block.appendChild(dialog);
  dialog.showModal();

  wireDialogClose(dialog);

  dialog.querySelector('.collection__share-generate').addEventListener('click', async () => {
    const title = dialog.querySelector('.collection__share-title').value.trim();
    const description = dialog.querySelector('.collection__share-description').value.trim();
    const days = parseInt(dialog.querySelector('.collection__share-expires').value, 10);

    // Re-read from storage so drag-updated x/y positions are current (the block's
    // collection reference is a snapshot from initial load).
    const fresh = await services.collections.get(collection.id);
    const liveItems = (fresh || collection).items || [];
    const encodedItems = liveItems.map((item) => {
      if (item.type === 'section') return `~${item.title}|||${item.body}`;
      const pos = (item.x != null && item.y != null)
        ? `@${Math.round(item.x)},${Math.round(item.y)}`
        : '';
      return item.notes ? `${item.id}${pos}|||${item.notes}` : `${item.id}${pos}`;
    });

    const textItems = getBoardTextItems(collection.id);
    const payload = {
      title: title || collection.name,
      ...(description && { description }),
      // eslint-disable-next-line no-underscore-dangle
      ...(days > 0 && { expiresAt: new Date(Date.now() + days * 86_400_000).toISOString() }),
      items: encodedItems,
      ...(textItems.length && {
        textElements: textItems.map(({
          x, y, w, h, content,
        }) => ({
          x, y, w, h, content,
        })),
      }),
    };

    const compressed = await services.url.compressArray([JSON.stringify(payload)]);
    const url = `${window.location.origin}${SHEET_PATH}?sheet=${compressed}`;

    saveShareHistory({ title: payload.title, url, collectionId: collection.id });

    const wrap = dialog.querySelector('.collection__share-url-wrap');
    wrap.removeAttribute('hidden');
    wrap.querySelector('.collection__share-url-output').value = url;
    dialog.querySelector('.collection__share-copy')?.removeAttribute('hidden');

    const pastSharesEl = block.querySelector('.collection__past-shares');
    if (pastSharesEl) pastSharesEl.innerHTML = renderShareHistory();
  });

  dialog.querySelector('.collection__share-copy')?.addEventListener('click', () => {
    const btn = dialog.querySelector('.collection__share-copy');
    const url = dialog.querySelector('.collection__share-url-output').value;
    navigator.clipboard.writeText(url).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
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

  wireDialogClose(dialog);

  dialog.querySelector('.collection__download-submit').addEventListener('click', async () => {
    const checked = [...dialog.querySelectorAll('input[name="rendition"]:checked')];
    const selectedRenditionIds = checked.map((cb) => cb.value);
    if (!selectedRenditionIds.length) {
      alert('Please select at least one rendition.');
      return;
    }

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

function refreshDownloadStatus(block, collectionId) {
  const jobsSection = block.querySelector('.collection__jobs');
  if (!jobsSection || !collectionId) return;

  const pendingJobs = getPendingJobs(collectionId);

  if (!pendingJobs.length) {
    jobsSection.remove();
    return;
  }
  jobsSection.outerHTML = renderJobsStatus(pendingJobs);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveCollectionId() {
  const id = new URLSearchParams(window.location.search).get('id') || '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    return id;
  }
  return services.collections.getActiveId();
}

function getVisibleRenditionDefs(assets) {
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

function getPendingJobs(collectionId) {
  return services.downloads.getAll().filter(
    (j) => j.collectionId === collectionId
      && (j.status === DownloadStatus.RUNNING || j.status === DownloadStatus.PENDING),
  );
}

function wireDialogClose(dialog) {
  dialog.querySelectorAll('[data-dialog-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
}

const ICON_COPY = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const ICON_CHECK = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

function flashCopy(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = ICON_CHECK;
    setTimeout(() => { btn.innerHTML = ICON_COPY; }, 2000);
  });
}
