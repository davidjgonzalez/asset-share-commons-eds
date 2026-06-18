/** @owner user */
import services from '../../scripts/asc/services/services.js';
import { Events as CollectionEvents } from '../../scripts/asc/services/collections/collections.js';
import { escHtml } from '../../scripts/html.js';

const configurations = (await import('../../scripts/configurations.js')).default;

const MANAGE_PATH = configurations.collections?.managePath || '/collections/';

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
      block.querySelector('.collection-switcher__dropdown')?.setAttribute('hidden', '');
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
    <div class="collection-switcher__wrapper">
      <button class="collection-switcher__trigger btn btn--secondary btn--lg" aria-expanded="false" aria-haspopup="listbox">
        <span class="collection-switcher__trigger-name">${escHtml(active?.name || 'My Collection')}</span>
        <span class="asc-ui-count" aria-label="${count} assets">${count}</span>
        <span class="collection-switcher__trigger-arrow" aria-hidden="true">▾</span>
      </button>

      <div class="collection-switcher__dropdown" hidden role="dialog" aria-label="Collections">
        <ul class="asc-ui-menu" role="listbox" aria-label="Select active collection">
          ${all.map((c) => collectionOption(c, activeId)).join('')}
        </ul>

        <div class="collection-switcher__create-wrap">
          <form class="collection-switcher__create-form" hidden>
            <input type="text" class="collection-switcher__create-input" placeholder="Collection name" maxlength="80" />
            <button type="submit" class="btn btn--primary">Create</button>
            <button type="button" class="collection-switcher__create-cancel btn btn--ghost btn--sm">✕</button>
          </form>
          <button class="collection-switcher__create-btn">+ New collection</button>
        </div>

        <div class="collection-switcher__footer">
          <a href="${MANAGE_PATH}" class="collection-switcher__manage-link">Manage collections</a>
        </div>
      </div>
    </div>`;
}

function collectionOption(collection, activeId) {
  const isActive = collection.id === activeId;
  const count = collection.assetIds?.length ?? 0;
  return `
    <li>
      <button class="asc-ui-menu__item${isActive ? ' asc-ui-menu__item--active' : ''}"
              type="button"
              role="option"
              aria-selected="${isActive}"
              data-collection-id="${collection.id}">
        <span class="asc-ui-menu__item-label">${escHtml(collection.name)}</span>
        <span class="asc-ui-menu__item-meta">${count}</span>
        ${isActive ? '<span class="asc-ui-menu__item-check" aria-hidden="true">✓</span>' : ''}
      </button>
    </li>`;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

function initInteractions(block) {
  const trigger = block.querySelector('.collection-switcher__trigger');
  const dropdown = block.querySelector('.collection-switcher__dropdown');

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
  block.querySelectorAll('.asc-ui-menu__item').forEach((opt) => {
    opt.addEventListener('click', () => {
      services.collections.setActive(opt.dataset.collectionId);
      dropdown.setAttribute('hidden', '');
      trigger.setAttribute('aria-expanded', 'false');
    });
  });

  // Show create form
  block.querySelector('.collection-switcher__create-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    block.querySelector('.collection-switcher__create-form').removeAttribute('hidden');
    block.querySelector('.collection-switcher__create-btn').setAttribute('hidden', '');
    block.querySelector('.collection-switcher__create-input').focus();
  });

  // Hide create form
  block.querySelector('.collection-switcher__create-cancel').addEventListener('click', () => {
    block.querySelector('.collection-switcher__create-form').setAttribute('hidden', '');
    block.querySelector('.collection-switcher__create-btn').removeAttribute('hidden');
    block.querySelector('.collection-switcher__create-input').value = '';
  });

  // Submit new collection
  block.querySelector('.collection-switcher__create-form').addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const input = block.querySelector('.collection-switcher__create-input');
    const name = input.value.trim();
    if (!name) return;
    const newCollection = services.collections.create(name);
    services.collections.setActive(newCollection.id);
    // Dropdown will re-render via CHANGED event
  });
}

