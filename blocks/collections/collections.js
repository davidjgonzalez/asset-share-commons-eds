/** @owner user */
import services from '../../scripts/asc/services/services.js';
import { Events as CollectionEvents } from '../../scripts/asc/services/collections/collections.js';
import { escHtml, escAttr, formatUpdated } from '../../scripts/html.js';

const configurations = (await import('../../scripts/configurations.js')).default;

const COLLECTION_PATH = configurations.collections?.collectionPath || '/collections/collection';

/**
 * Collections block — index/management page for all user collections.
 * Page title and intro copy are authored in Universal Editor above this block.
 *
 * Features:
 *   - Grid of collection cards: name, asset count, last updated, Open / Delete buttons
 *   - Inline "New collection" form
 *   - Re-renders on any collection change event
 *   - Navigate to collection detail page at COLLECTION_PATH?id=<uuid>
 */
export default async function decorate(block) {
  await render(block);

  document.addEventListener(CollectionEvents.CHANGED, async () => {
    await render(block);
  });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

async function render(block) {
  const collections = await services.collections.getAll(false);
  const activeId = services.collections.getActiveId();
  const data = services.collections._getData();
  const defaultId = data.defaultId;
  const sorted = [...collections].sort((a, b) => {
    const tb = new Date(b.modifiedAt || 0).getTime();
    const ta = new Date(a.modifiedAt || 0).getTime();
    return tb - ta;
  });

  block.innerHTML = html(sorted, activeId, defaultId);
  initInteractions(block);
}

function html(collections, activeId, defaultId) {
  return `
    <section class="collections__shell" aria-label="Collections">
      <div class="collections__toolbar">
        <button type="button" class="collections__new-btn btn btn--primary">New Collection</button>
      </div>

      <form class="collections__new-form" hidden>
        <label class="collections__new-label asc-ui-field">
          <span class="asc-ui-field__label">Name</span>
          <input type="text" class="collections__new-name" placeholder="e.g. Q1 campaign" maxlength="80" autocomplete="off" />
        </label>
        <div class="collections__new-actions">
          <button type="submit" class="btn btn--primary">Create</button>
          <button type="button" class="collections__new-cancel btn btn--secondary">Cancel</button>
        </div>
      </form>

      <ul class="collections__grid" role="list">
        ${collections.length
    ? collections.map((c) => collectionCard(c, activeId, defaultId)).join('')
    : `<li class="collections__empty asc-ui-empty-state">
          <span class="asc-ui-empty-state__icon" aria-hidden="true">📁</span>
          <p class="asc-ui-empty-state__title">No collections yet</p>
          <p class="asc-ui-empty-state__hint">Create a collection to start building a downloadable set of assets.</p>
        </li>`}
      </ul>
    </section>`;
}

function collectionCard(collection, activeId, defaultId) {
  const count = collection.assetIds?.length ?? 0;
  const isActive = collection.id === activeId;
  const isDefault = collection.id === defaultId;
  const updated = formatUpdated(collection.modifiedAt);

  return `
    <li class="collections__card asc-ui-card asc-ui-card--interactive${isActive ? ' asc-ui-card--active' : ''}"
        data-collection-id="${collection.id}">
      <div class="asc-ui-card__body">
        <div class="asc-ui-card__header">
          <h2 class="collections__card-name asc-ui-card__title">${escHtml(collection.name)}</h2>
          <div class="collections__card-badges" role="presentation">
            ${isActive ? '<span class="asc-ui-badge asc-ui-badge--primary">Active</span>' : ''}
            ${isDefault ? '<span class="asc-ui-badge">Default</span>' : ''}
          </div>
        </div>
        <p class="collections__card-count"><span class="collections__card-count-num">${count}</span> asset${count !== 1 ? 's' : ''}</p>
        ${updated
    ? `<p class="collections__card-updated"><time datetime="${escAttr(updated.iso)}">${escHtml(updated.label)}</time></p>`
    : ''}
      </div>
      <div class="collections__card-actions asc-ui-card__footer">
        <a class="collections__card-open btn btn--primary btn--sm"
           href="${COLLECTION_PATH}?id=${collection.id}">Open</a>
        ${!isActive
    ? `<button type="button" class="collections__card-activate btn btn--secondary btn--sm"
                 data-collection-id="${collection.id}">Set active</button>`
    : ''}
        ${!isDefault
    ? `<button type="button" class="collections__card-delete btn btn--ghost btn--sm"
                 data-collection-id="${collection.id}">Delete</button>`
    : ''}
      </div>
    </li>`;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

function initInteractions(block) {
  // Show/hide create form
  block.querySelector('.collections__new-btn').addEventListener('click', () => {
    const form = block.querySelector('.collections__new-form');
    form.removeAttribute('hidden');
    form.querySelector('.collections__new-name').focus();
  });

  block.querySelector('.collections__new-cancel').addEventListener('click', () => {
    const form = block.querySelector('.collections__new-form');
    form.setAttribute('hidden', '');
    form.querySelector('.collections__new-name').value = '';
  });

  block.querySelector('.collections__new-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = block.querySelector('.collections__new-name');
    const name = input.value.trim();
    if (!name) return;
    services.collections.create(name);
    input.value = '';
    block.querySelector('.collections__new-form').setAttribute('hidden', '');
  });

  // Set active
  block.querySelectorAll('.collections__card-activate').forEach((btn) => {
    btn.addEventListener('click', () => {
      services.collections.setActive(btn.dataset.collectionId);
    });
  });

  // Delete
  block.querySelectorAll('.collections__card-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.collections__card');
      const name = card?.querySelector('.collections__card-name')?.textContent?.trim() || 'this collection';
      if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
      services.collections.delete(btn.dataset.collectionId);
    });
  });
}

