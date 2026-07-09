/** @owner user */
import services from '../../scripts/asc/services/services.js';
import storage from '../../scripts/asc/services/storage/storage.js';
import { Events as CollectionEvents } from '../../scripts/asc/services/collections/collections.js';
import { escHtml, escAttr, formatUpdated } from '../../scripts/html.js';
import { triggerAction } from '../../scripts/asc.js';

const configurations = (await import('../../scripts/configurations.js')).default;

const SHARE_HISTORY_KEY = 'shareHistory';

export default async function decorate(block) {
  const collectionId = resolveCollectionId();
  await render(block, collectionId);

  document.addEventListener(CollectionEvents.CHANGED, async (e) => {
    if (e.detail?.source === 'block') return;
    await render(block, collectionId);
  });

  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) closeMenu(block);
  });

  // Re-render the past-shares panel when action-share creates a new link
  document.addEventListener('asc:share:created', () => {
    const pastSharesEl = block.querySelector('.collection__past-shares');
    if (pastSharesEl) pastSharesEl.innerHTML = renderShareHistory();
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
  block.innerHTML = html(collection, isDefault);
  initInteractions(block, collection, isDefault);
}

function html(collection, isDefault) {
  const items = collection.hydratedItems || [];
  const assetCount = items.filter((i) => i.type === 'asset').length;
  const updated = formatUpdated(collection.modifiedAt);
  const collectionsPath = configurations.collections?.managePath || '/collections/';
  return `
    <section class="collection__shell" aria-label="Collection">
    <header class="collection__header">
      <a href="${escAttr(collectionsPath)}" class="collection__back">&#8592; Collections</a>
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
        <button type="button" class="collection__share-btn btn btn--secondary" aria-label="Share this collection">Share</button>
        <button type="button" class="collection__download-btn btn btn--primary"
                aria-label="Download all assets in collection"
                ${assetCount === 0 ? 'disabled' : ''}>Download</button>
      </div>
    </div>

    </section>`;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

function initInteractions(block, collection, isDefault) {
  initMenu(block);
  initRename(block, collection);
  initShare(block, collection);
  initDownload(block, collection);
  if (!isDefault) initDelete(block, collection);
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
    triggerAction(
      configurations.share?.actionPath || '/actions/share',
      { collectionId: collection.id },
    );
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

// ── Download ──────────────────────────────────────────────────────────────────

function initDownload(block, collection) {
  block.querySelector('.collection__download-btn')?.addEventListener('click', () => {
    triggerAction(
      configurations.downloads?.actionPath || '/actions/download',
      { collectionId: collection.id },
    );
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveCollectionId() {
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
