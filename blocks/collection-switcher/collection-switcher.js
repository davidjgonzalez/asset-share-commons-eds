import services from '../../scripts/asc/services/services.js';
import { Events as CollectionEvents } from '../../scripts/asc/services/collections/collections.js';

const configurations = (await import('../../scripts/configurations.js')).default;

const MANAGE_PATH = configurations.collections?.managePath || '/collections';

/**
 * Collection-switcher block — persistent header widget.
 *
 * Renders a compact trigger button showing the active collection name and asset count.
 * Clicking it opens a dropdown that lets the user:
 *   - See all collections with their asset counts
 *   - Click any collection to make it the active collection
 *   - Create a new collection inline
 *   - Navigate to the full collections management page
 *
 * Place in the site header or any persistent area of the page.
 */
export default async function decorate(block) {
  await render(block);

  // React to collection changes (add/remove/create/activate/etc.)
  document.addEventListener(CollectionEvents.CHANGED, async () => {
    await render(block);
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) {
      block.querySelector('.cs__dropdown')?.setAttribute('hidden', '');
    }
  });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

async function render(block) {
  const active = await services.collections.getActive(false);
  const all = await services.collections.getAll(false);
  const activeId = services.collections.getActiveId();

  block.innerHTML = html(active, all, activeId);
  initInteractions(block);
}

function html(active, all, activeId) {
  const count = active?.assetIds?.length ?? 0;
  return `
    <div class="cs__wrapper">
      <button class="cs__trigger" aria-expanded="false" aria-haspopup="listbox">
        <span class="cs__trigger-name">${escHtml(active?.name || 'My Collection')}</span>
        <span class="cs__trigger-count" aria-label="${count} assets">${count}</span>
        <span class="cs__trigger-arrow" aria-hidden="true">▾</span>
      </button>

      <div class="cs__dropdown" hidden role="dialog" aria-label="Collections">
        <ul class="cs__list" role="listbox" aria-label="Select active collection">
          ${all.map((c) => collectionOption(c, activeId)).join('')}
        </ul>

        <div class="cs__create-wrap">
          <form class="cs__create-form" hidden>
            <input type="text" class="cs__create-input" placeholder="Collection name" maxlength="80" />
            <button type="submit" class="btn btn--primary btn--sm">Create</button>
            <button type="button" class="cs__create-cancel btn btn--ghost btn--sm">✕</button>
          </form>
          <button class="cs__create-btn btn btn--ghost btn--sm">+ New collection</button>
        </div>

        <div class="cs__footer">
          <a href="${MANAGE_PATH}" class="cs__manage-link">Manage collections</a>
        </div>
      </div>
    </div>`;
}

function collectionOption(collection, activeId) {
  const isActive = collection.id === activeId;
  const count = collection.assetIds?.length ?? 0;
  return `
    <li class="cs__option${isActive ? ' cs__option--active' : ''}"
        role="option"
        aria-selected="${isActive}"
        data-collection-id="${collection.id}">
      <span class="cs__option-name">${escHtml(collection.name)}</span>
      <span class="cs__option-count">${count}</span>
      ${isActive ? '<span class="cs__option-check" aria-hidden="true">✓</span>' : ''}
    </li>`;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

function initInteractions(block) {
  const trigger = block.querySelector('.cs__trigger');
  const dropdown = block.querySelector('.cs__dropdown');

  // Toggle dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.hasAttribute('hidden');
    if (open) {
      dropdown.removeAttribute('hidden');
      trigger.setAttribute('aria-expanded', 'true');
    } else {
      dropdown.setAttribute('hidden', '');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  // Activate collection on click
  block.querySelectorAll('.cs__option').forEach((opt) => {
    opt.addEventListener('click', () => {
      services.collections.setActive(opt.dataset.collectionId);
      dropdown.setAttribute('hidden', '');
      trigger.setAttribute('aria-expanded', 'false');
    });
  });

  // Show create form
  block.querySelector('.cs__create-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    block.querySelector('.cs__create-form').removeAttribute('hidden');
    block.querySelector('.cs__create-btn').setAttribute('hidden', '');
    block.querySelector('.cs__create-input').focus();
  });

  // Hide create form
  block.querySelector('.cs__create-cancel').addEventListener('click', () => {
    block.querySelector('.cs__create-form').setAttribute('hidden', '');
    block.querySelector('.cs__create-btn').removeAttribute('hidden');
    block.querySelector('.cs__create-input').value = '';
  });

  // Submit new collection
  block.querySelector('.cs__create-form').addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const input = block.querySelector('.cs__create-input');
    const name = input.value.trim();
    if (!name) return;
    const newCollection = services.collections.create(name);
    services.collections.setActive(newCollection.id);
    // Dropdown will re-render via CHANGED event
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
