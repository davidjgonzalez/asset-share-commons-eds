/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import storage from '../../scripts/asc/core/services/storage/storage.js';
import { Events as CollectionEvents } from '../../scripts/asc/core/services/collections/collections.js';
import { escHtml, escAttr, formatUpdated } from '../../scripts/asc/html.js';
import { triggerAction } from '../../scripts/asc.js';
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
    if (!block.contains(e.target)) closeMenu(block);
  });

  document.addEventListener('asc:share:created', () => {
    const pastSharesEl = block.querySelector('.collection-controls__past-shares');
    if (pastSharesEl) {
      const label = controls.find((c) => c.id === 'past-shares')?.label || '';
      pastSharesEl.innerHTML = renderPastSharesHtml(label);
    }
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

  registerTokens({
    'collection.title': collection.name,
    'collection.description': collection.description || '',
    'collection.count': String(assetCount),
    'collection.lastUpdated': updated?.label || '',
  });

  const section = block.closest('.section');
  block.innerHTML = html(controls, isDefault, assetCount);
  initInteractions(block, collection, isDefault, section);
}

const RENDERERS = {
  'past-shares': ({ label, variant }) => `<div class="collection-controls__past-shares">${renderPastSharesHtml(label, variant || 'ghost')}</div>`,
  edit: ({ label, isDefault, variant }) => renderEditMenu(label, isDefault, variant || 'ghost'),
  share: ({ label, variant }) => `<button type="button" class="collection-controls__share-btn btn btn--${variant || 'secondary'}" aria-label="Share this collection">${escHtml(label || 'Share')}</button>`,
  download: ({ label, assetCount, variant }) => `<button type="button" class="collection-controls__download-btn btn btn--${variant || 'primary'}" aria-label="Download all assets in collection"${assetCount === 0 ? ' disabled' : ''}>${escHtml(label || 'Download')}</button>`,
};

function html(controls, isDefault, assetCount) {
  const items = controls
    .map(({ id, label }) => RENDERERS[id]?.({ label, isDefault, assetCount }) ?? '')
    .join('');
  return `
    <div class="collection-controls__toolbar">
      <div class="collection-controls__toolbar-end">${items}</div>
    </div>`;
}

function renderEditMenu(label, isDefault, variant) {
  return `
    <div class="collection-controls__menu-wrap">
      <button type="button" class="collection-controls__menu-trigger btn btn--${variant} btn--sm"
              aria-haspopup="true" aria-expanded="false">${escHtml(label || 'Edit')}</button>
      <div class="collection-controls__menu asc-panel asc-panel--no-pad" hidden>
        <ul class="asc-ui-menu" role="menu">
          <li role="none">
            <button type="button" class="collection-controls__rename-btn asc-ui-menu__item" role="menuitem">Rename</button>
          </li>
          <li role="none"><hr class="asc-ui-menu__separator"></li>
          <li role="none"${isDefault ? ' hidden' : ''}>
            <button type="button" class="collection-controls__delete-btn asc-ui-menu__item collection-controls__menu-item--danger" role="menuitem">Delete collection</button>
          </li>
        </ul>
      </div>
    </div>`;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

function initInteractions(block, collection, isDefault, section) {
  initMenu(block);
  initRename(block, collection, section);
  initShare(block, collection);
  initDownload(block, collection);
  if (!isDefault) initDelete(block, collection);
}

// ── Actions menu ──────────────────────────────────────────────────────────────

function closeMenu(block) {
  block.querySelector('.collection-controls__menu')?.setAttribute('hidden', '');
  block.querySelector('.collection-controls__menu-trigger')?.setAttribute('aria-expanded', 'false');
}

function initMenu(block) {
  const trigger = block.querySelector('.collection-controls__menu-trigger');
  const menu = block.querySelector('.collection-controls__menu');
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

function initRename(block, collection, section) {
  block.querySelector('.collection-controls__rename-btn')?.addEventListener('click', () => {
    const nameEl = section?.querySelector('h1');
    if (!nameEl) return;

    const current = nameEl.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'collection-controls__name-input';
    input.value = current;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
      const val = input.value.trim();
      if (val && val !== current) services.collections.rename(collection.id, val);
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
  block.querySelector('.collection-controls__delete-btn')?.addEventListener('click', () => {
    if (!window.confirm(`Delete "${collection.name}"? This cannot be undone.`)) return;
    services.collections.delete(collection.id);
    const managePath = configurations.collections?.managePath || '/collections/';
    window.location.href = managePath;
  });
}

// ── Share ─────────────────────────────────────────────────────────────────────

function renderPastSharesHtml(label, variant) {
  const history = storage.get(SHARE_HISTORY_KEY) || [];
  if (!history.length) return '';

  const dateItems = history.map((entry) => {
    const dateLabel = new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `
      <li class="collection-controls__past-share-row">
        <span class="asc-ui-menu__item-label" title="${escAttr(entry.url)}">${escHtml(entry.title || 'Untitled')}</span>
        <span class="asc-ui-menu__item-meta">${escHtml(dateLabel)}</span>
        <button type="button" class="btn btn--ghost btn--circle btn--sm collection-controls__share-history-copy"
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
    <div class="asc-ui-dropdown collection-controls__past-shares-dropdown">
      <button type="button"
              class="btn btn--${variant} collection-controls__past-shares-trigger"
              aria-expanded="false"
              aria-haspopup="true">
        ${escHtml(label || 'Past Shares')} <span class="asc-ui-count asc-ui-count--muted">${history.length}</span>
      </button>
      <div class="asc-ui-dropdown__panel collection-controls__past-shares-panel" hidden>
        <ul class="asc-ui-menu">${dateItems}</ul>
      </div>
    </div>`;
}

function initShare(block, collection) {
  block.querySelector('.collection-controls__share-btn')?.addEventListener('click', () => {
    triggerAction(
      configurations.share?.actionPath || '/actions/share',
      { collectionId: collection.id },
    );
  });

  block.addEventListener('click', (e) => {
    const trigger = e.target.closest('.collection-controls__past-shares-trigger');
    if (trigger) {
      const panel = trigger.closest('.collection-controls__past-shares-dropdown')
        ?.querySelector('.collection-controls__past-shares-panel');
      if (!panel) return;
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      panel.hidden = expanded;
      trigger.setAttribute('aria-expanded', String(!expanded));
      return;
    }

    const copyBtn = e.target.closest('.collection-controls__share-history-copy');
    if (copyBtn) {
      flashCopy(copyBtn, copyBtn.dataset.url);
      return;
    }

    if (!e.target.closest('.collection-controls__past-shares-dropdown')) {
      const openDropdown = block.querySelector('.collection-controls__past-shares-panel:not([hidden])');
      if (openDropdown) {
        openDropdown.hidden = true;
        openDropdown.closest('.collection-controls__past-shares-dropdown')
          ?.querySelector('.collection-controls__past-shares-trigger')
          ?.setAttribute('aria-expanded', 'false');
      }
    }
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
