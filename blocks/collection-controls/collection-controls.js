/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import storage from '../../scripts/asc/core/services/storage/storage.js';
import { Events as CollectionEvents } from '../../scripts/asc/core/services/collections/collections.js';
import { escHtml, escAttr, formatUpdated } from '../../scripts/asc/html.js';
import { triggerAction, wireDialogClose } from '../../scripts/asc.js';
import { registerTokens } from '../../scripts/asc/tokens.js';

const configurations = (await import('../../scripts/asc/configurations.js')).default;

const SHARE_HISTORY_KEY = 'shareHistory';

export default async function decorate(block) {
  const controls = parseControls(block);
  const collectionId = resolveCollectionId();
  await render(block, collectionId, controls);

  document.addEventListener(CollectionEvents.CHANGED, async (e) => {
    if (e.detail?.source === 'block') return;
    await render(block, collectionId, controls);
  });

  document.addEventListener('click', (e) => {
    const wrap = block.closest('.section')?.querySelector('.collection-controls__title-menu-wrap');
    if (wrap && !wrap.contains(e.target)) closeTitleMenu(wrap);
  });

  document.addEventListener('asc:share:created', () => {
    const wrap = block.closest('.section')?.querySelector('.collection-controls__title-menu-wrap');
    const item = wrap?.querySelector('.collection-controls__past-shares-btn')?.closest('li');
    if (!item) return;
    const history = storage.get(SHARE_HISTORY_KEY) || [];
    item.hidden = history.length === 0;
    const meta = item.querySelector('.asc-ui-menu__item-meta');
    if (meta) meta.textContent = String(history.length);
  });
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseControls(block) {
  return [...block.querySelectorAll(':scope > div')].map((row) => ({
    id: row.children[0]?.textContent.trim().toLowerCase(),
    label: row.children[1]?.textContent.trim() || '',
    variant: row.children[2]?.textContent.trim().toLowerCase() || '',
  })).filter((c) => c.id);
}

// ─── Rendering ────────────────────────────────────────────────────────────────

async function render(block, collectionId, controls) {
  const collection = await services.collections.get(collectionId, true);
  if (!collection) {
    block.innerHTML = '<p class="collection-controls__not-found">Collection not found.</p>';
    return;
  }

  const data = services.collections._getData();
  const isDefault = data.defaultId === collection.id;
  const items = collection.hydratedItems || [];
  const assetCount = items.filter((i) => i.type === 'asset').length;
  const updated = formatUpdated(collection.modifiedAt);
  const historyCount = (storage.get(SHARE_HISTORY_KEY) || []).length;

  registerTokens({
    'collection.title': collection.name,
    'collection.description': collection.description || '',
    'collection.count': String(assetCount),
    'collection.lastUpdated': updated?.label || '',
  });

  const section = block.closest('.section');
  block.innerHTML = html(controls, assetCount);
  initShare(block, collection);
  initDownload(block, collection);
  renderTitleMenu(section, controls, collection.id, isDefault, historyCount);
}

const RENDERERS = {
  share: ({ label, variant }) => `<button type="button" class="collection-controls__share-btn btn btn--${variant || 'secondary'}" aria-label="Share this collection">${escHtml(label || 'Share')}</button>`,
  download: ({ label, assetCount, variant }) => `<button type="button" class="collection-controls__download-btn btn btn--${variant || 'primary'}" aria-label="Download all assets in collection"${assetCount === 0 ? ' disabled' : ''}>${escHtml(label || 'Download')}</button>`,
};

function html(controls, assetCount) {
  const items = controls
    .map(({ id, label, variant }) => RENDERERS[id]?.({ label, variant, assetCount }) ?? '')
    .join('');
  return `
    <div class="collection-controls__toolbar">
      <div class="asc-ui-toolbar" role="toolbar" aria-label="Collection actions">${items}</div>
    </div>`;
}

// ─── Title menu (Edit details / Past shares / Delete) ──────────────────────────

const ICON_KEBAB = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

function titleMenuHtml(controls, isDefault, historyCount) {
  const editLabel = controls.find((c) => c.id === 'edit')?.label || 'Edit details';
  const pastSharesLabel = controls.find((c) => c.id === 'past-shares')?.label || 'Past shares';
  return `
    <div class="collection-controls__title-menu-wrap">
      <button type="button" class="collection-controls__title-menu-trigger btn btn--ghost btn--circle btn--sm"
              aria-haspopup="true" aria-expanded="false" aria-label="Collection settings">${ICON_KEBAB}</button>
      <div class="collection-controls__title-menu asc-panel asc-panel--no-pad" hidden>
        <ul class="asc-ui-menu" role="menu">
          <li role="none">
            <button type="button" class="collection-controls__edit-details-btn asc-ui-menu__item" role="menuitem">
              <span class="asc-ui-menu__item-label">${escHtml(editLabel)}</span>
            </button>
          </li>
          <li role="none"${historyCount ? '' : ' hidden'}>
            <button type="button" class="collection-controls__past-shares-btn asc-ui-menu__item" role="menuitem">
              <span class="asc-ui-menu__item-label">${escHtml(pastSharesLabel)}</span>
              <span class="asc-ui-menu__item-meta asc-ui-count asc-ui-count--muted">${historyCount}</span>
            </button>
          </li>
          <li role="none"><hr class="asc-ui-menu__separator"></li>
          <li role="none">
            <button type="button" class="collection-controls__clear-btn asc-ui-menu__item collection-controls__menu-item--danger" role="menuitem">Clear collection</button>
          </li>
          <li role="none"${isDefault ? ' hidden' : ''}><hr class="asc-ui-menu__separator"></li>
          <li role="none"${isDefault ? ' hidden' : ''}>
            <button type="button" class="collection-controls__delete-btn asc-ui-menu__item collection-controls__menu-item--danger" role="menuitem">Delete collection</button>
          </li>
        </ul>
      </div>
    </div>`;
}

// Injected next to the authored `<h1>` in the sibling "content" block (rather than
// this block's own toolbar) so Rename/Description/Delete/Past-shares — collection
// *settings*, not primary actions — read as attached to the title, not the CTAs.
//
// Must land as an `afterend` *sibling* of h1, not a child inside it: tokens.js's
// page-wide registry re-resolves every recorded `{{...}}` template — including this
// h1 — via `el.textContent = resolved` any time *any* block on the page calls
// registerTokens() again (e.g. header/footer fragments re-running decorateMain on
// their own content triggers scripts/asc.js's registerTokens(urlParams) call, which
// re-resolves globally, not just for that fragment). textContent assignment wipes
// all of h1's children, so anything injected *inside* h1 gets silently deleted a
// few dozen ms after insert — confirmed by tracing it live. Sibling placement is
// immune since resolveAll() never touches h1's siblings, and it also happens to
// land the wrap right of the title in the flex layout (ui-kit.css) for free — no
// `order` override needed, since a same-order flex tie breaks by DOM position and
// this sits right after h1 there. That DOM order also keeps the breadcrumb
// paragraph's `p:first-child + h1` adjacency intact for the back-heading detection
// CSS.
//
// `:has(h1)` disambiguates from the sibling "content" block that holds the
// compact `@kit metadata` stat list (count/last-updated) in the header's grid
// "meta" area (see docs/starter-kit/collection.html) — same "content" block
// name, no h1 inside it.
function renderTitleMenu(section, controls, collectionId, isDefault, historyCount) {
  const infoBlock = section?.querySelector('.content.block:has(h1)');
  const h1 = infoBlock?.querySelector('h1');
  if (!h1) return;

  infoBlock.querySelector('.collection-controls__title-menu-wrap')?.remove();
  h1.insertAdjacentHTML('afterend', titleMenuHtml(controls, isDefault, historyCount));

  // The wrap's own markup is torn down and rebuilt above on every re-render, but
  // infoBlock itself persists across CollectionEvents.CHANGED re-renders — delegate
  // once here (same accumulation risk noted elsewhere in this file for Share).
  if (!infoBlock.dataset.titleMenuWired) {
    infoBlock.dataset.titleMenuWired = 'true';
    initTitleMenu(infoBlock, collectionId);
  }
}

function closeTitleMenu(wrap) {
  wrap?.querySelector('.collection-controls__title-menu')?.setAttribute('hidden', '');
  wrap?.querySelector('.collection-controls__title-menu-trigger')?.setAttribute('aria-expanded', 'false');
}

function initTitleMenu(infoBlock, collectionId) {
  infoBlock.addEventListener('click', (e) => {
    const trigger = e.target.closest('.collection-controls__title-menu-trigger');
    if (trigger) {
      e.stopPropagation();
      const wrap = trigger.closest('.collection-controls__title-menu-wrap');
      const menu = wrap.querySelector('.collection-controls__title-menu');
      if (menu.hasAttribute('hidden')) {
        menu.removeAttribute('hidden');
        trigger.setAttribute('aria-expanded', 'true');
      } else {
        closeTitleMenu(wrap);
      }
      return;
    }

    const editBtn = e.target.closest('.collection-controls__edit-details-btn');
    if (editBtn) {
      closeTitleMenu(editBtn.closest('.collection-controls__title-menu-wrap'));
      openEditDetailsDialog(collectionId);
      return;
    }

    const pastSharesBtn = e.target.closest('.collection-controls__past-shares-btn');
    if (pastSharesBtn) {
      closeTitleMenu(pastSharesBtn.closest('.collection-controls__title-menu-wrap'));
      openPastSharesDialog();
      return;
    }

    const clearBtn = e.target.closest('.collection-controls__clear-btn');
    if (clearBtn) {
      closeTitleMenu(clearBtn.closest('.collection-controls__title-menu-wrap'));
      confirmClear(collectionId);
      return;
    }

    const deleteBtn = e.target.closest('.collection-controls__delete-btn');
    if (deleteBtn) {
      closeTitleMenu(deleteBtn.closest('.collection-controls__title-menu-wrap'));
      confirmDelete(collectionId);
    }
  });
}

// ── Edit details (Name + Description) ─────────────────────────────────────────

async function openEditDetailsDialog(collectionId) {
  const collection = await services.collections.get(collectionId);
  if (!collection) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow collection-controls__edit-dialog';
  dialog.setAttribute('aria-labelledby', 'collection-edit-title');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="collection-edit-title">Edit collection details</h2>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>&#x2715;</button>
    </header>
    <div class="asc-dialog__body collection-controls__edit-fields">
      <label class="asc-ui-field">
        <span class="asc-ui-field__label">Name</span>
        <input type="text" class="collection-controls__edit-name" maxlength="80" autocomplete="off" value="${escAttr(collection.name)}" />
      </label>
      <label class="asc-ui-field">
        <span class="asc-ui-field__label">Description</span>
        <textarea class="collection-controls__edit-description" rows="3" maxlength="500">${escHtml(collection.description || '')}</textarea>
      </label>
    </div>
    <footer class="asc-dialog__footer">
      <button type="button" class="btn btn--secondary" data-dialog-close>Cancel</button>
      <div class="asc-dialog__footer-end">
        <button type="button" class="collection-controls__edit-submit btn btn--primary">Save</button>
      </div>
    </footer>`;

  document.body.appendChild(dialog);
  dialog.showModal();
  wireDialogClose(dialog);
  dialog.addEventListener('close', () => dialog.remove());

  const nameInput = dialog.querySelector('.collection-controls__edit-name');
  const descInput = dialog.querySelector('.collection-controls__edit-description');
  nameInput.focus();
  nameInput.select();

  const submit = () => {
    const name = nameInput.value.trim();
    if (!name) return;
    services.collections.updateDetails(collectionId, { name, description: descInput.value.trim() });
    dialog.close();
  };

  dialog.querySelector('.collection-controls__edit-submit').addEventListener('click', submit);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

// ── Clear ─────────────────────────────────────────────────────────────────────

async function confirmClear(collectionId) {
  const collection = await services.collections.get(collectionId);
  if (!collection || !(collection.items || []).length) return;
  if (!window.confirm(`Remove everything from "${collection.name}"? This cannot be undone.`)) return;
  services.collections.clear(collectionId);
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function confirmDelete(collectionId) {
  const collection = await services.collections.get(collectionId);
  if (!collection) return;
  if (!window.confirm(`Delete "${collection.name}"? This cannot be undone.`)) return;
  services.collections.delete(collectionId);
  const managePath = configurations.collections?.managePath || '/collections/';
  window.location.href = managePath;
}

// ── Share ─────────────────────────────────────────────────────────────────────

function pastSharesRows(history) {
  return history.map((entry) => {
    const dateLabel = new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `
      <li class="collection-controls__past-share-row">
        <span class="asc-ui-menu__item-label" title="${escAttr(entry.url)}">${escHtml(entry.title || 'Untitled')}</span>
        <span class="asc-ui-menu__item-meta">${escHtml(dateLabel)}</span>
        <button type="button" class="btn btn--ghost btn--circle btn--sm collection-controls__share-history-copy"
                data-url="${escAttr(entry.url)}" aria-label="Copy link">
          ${ICON_COPY}
        </button>
        <a href="${escAttr(entry.url)}" target="_blank" rel="noopener noreferrer"
           class="btn btn--ghost btn--circle btn--sm" aria-label="Open link">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </li>`;
  }).join('');
}

function openPastSharesDialog() {
  const history = storage.get(SHARE_HISTORY_KEY) || [];

  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow collection-controls__past-shares-dialog';
  dialog.setAttribute('aria-labelledby', 'collection-past-shares-title');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="collection-past-shares-title">Past shares</h2>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>&#x2715;</button>
    </header>
    <div class="asc-dialog__body">
      <ul class="asc-ui-menu collection-controls__past-shares-list">${pastSharesRows(history)}</ul>
    </div>`;

  document.body.appendChild(dialog);
  dialog.showModal();
  wireDialogClose(dialog);
  dialog.addEventListener('close', () => dialog.remove());

  dialog.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.collection-controls__share-history-copy');
    if (copyBtn) flashCopy(copyBtn, copyBtn.dataset.url);
  });
}

function initShare(block, collection) {
  block.querySelector('.collection-controls__share-btn')?.addEventListener('click', () => {
    triggerAction(
      configurations.share?.actionPath || '/actions/share',
      { collectionId: collection.id },
    );
  });
}

// ── Download ──────────────────────────────────────────────────────────────────

function initDownload(block, collection) {
  block.querySelector('.collection-controls__download-btn')?.addEventListener('click', () => {
    triggerAction(
      configurations.downloads?.actionPath || '/actions/download',
      { collectionId: collection.id },
    );
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Exported for the sibling collection-meta block (blocks/collection-meta), which
// needs to resolve the same "which collection is this page about" id — a plain
// ?id= UUID override, falling back to the active collection.
export function resolveCollectionId() {
  const id = new URLSearchParams(window.location.search).get('id') || '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    return id;
  }
  return services.collections.getActiveId();
}

const ICON_COPY = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const ICON_CHECK = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

function flashCopy(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = ICON_CHECK;
    setTimeout(() => { btn.innerHTML = ICON_COPY; }, 2000);
  });
}
