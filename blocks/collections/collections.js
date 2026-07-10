/** @owner user */
import Asset from '../../scripts/asc/core/models/asset.js';
import services from '../../scripts/asc/core/services/services.js';
import { Events as CollectionEvents } from '../../scripts/asc/core/services/collections/collections.js';
import { escHtml, escAttr, formatUpdated } from '../../scripts/asc/html.js';

const configurations = (await import('../../scripts/asc/configurations.js')).default;

const COLLECTION_PATH = configurations.collections?.collectionPath || '/collections/collection';

/**
 * Collections block — index/management page for all user collections.
 * Page title and intro copy are authored in Universal Editor above this block.
 *
 * Features:
 *   - Grid of collection cards: mosaic of up to 4 asset thumbnails (lazy-loaded),
 *     name, asset type counts, total count, last updated, Open / Delete buttons
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
  loadMosaics(block);
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
  const thumbIds = (collection.assetIds || []).slice(0, 20);

  return `
    <li class="collections__card asc-ui-card asc-ui-card--interactive${isActive ? ' asc-ui-card--active' : ''}"
        data-collection-id="${escAttr(collection.id)}"
        data-thumb-ids="${escAttr(thumbIds.join(','))}">
      <a class="collections__card-link" href="${COLLECTION_PATH}?id=${escAttr(collection.id)}">
        ${mosaicHtml(count, thumbIds)}
        <div class="collections__card-content">
          <div class="asc-ui-card__header">
            <h2 class="collections__card-name asc-ui-card__title">${escHtml(collection.name)}</h2>
          </div>
          <div class="asc-ui-card__body">
            ${typeCountsHtml(collection)}
            <p class="collections__card-count"><span class="collections__card-count-num">${count}</span> asset${count !== 1 ? 's' : ''}</p>
            ${updated
    ? `<p class="collections__card-updated"><time datetime="${escAttr(updated.iso)}">${escHtml(updated.label)}</time></p>`
    : ''}
          </div>
        </div>
      </a>
      ${!isActive || !isDefault ? `
      <div class="collections__card-actions asc-ui-card__footer">
        ${!isActive
    ? `<button type="button" class="collections__card-activate btn btn--secondary btn--sm"
               data-collection-id="${escAttr(collection.id)}"
               aria-label="Set ${escAttr(collection.name)} as active collection">Set active</button>`
    : ''}
        ${!isDefault
    ? `<button type="button" class="collections__card-delete btn btn--ghost btn--sm"
               data-collection-id="${escAttr(collection.id)}"
               aria-label="Delete ${escAttr(collection.name)} collection">Delete</button>`
    : ''}
      </div>` : ''}
    </li>`;
}

// Maps actual thumbnail count to a CSS grid layout group.
// 1→1×1, 2→2×1, 3→3×1, 4→2×2, 5-10→5×2, 11-15→5×3, 16-20→5×4 (default)
function mosaicLayout(n) {
  if (n <= 4) return n;
  if (n <= 10) return 10;
  if (n <= 15) return 15;
  return 20;
}

function mosaicHtml(count, thumbIds) {
  if (count === 0) {
    return `<div class="collections__card-mosaic collections__card-mosaic--empty" aria-hidden="true">
      <span class="collections__card-mosaic-icon">📁</span>
    </div>`;
  }
  const cells = thumbIds.map(() =>
    `<div class="asc-ui-collection-card__thumb asc-ui-skeleton" aria-hidden="true"></div>`,
  ).join('');
  return `<div class="collections__card-mosaic" aria-hidden="true">
    <div class="asc-ui-collection-card__thumbs" data-count="${mosaicLayout(thumbIds.length)}">${cells}</div>
  </div>`;
}

function typeCountsHtml(collection) {
  const assetItems = (collection.items || []).filter((i) => i.type === 'asset');
  if (!assetItems.length) return '';
  // Only show breakdown when every asset has a known mimeType
  if (assetItems.some((i) => !i.mimeType)) return '';

  const counts = { image: 0, video: 0, document: 0, other: 0 };
  assetItems.forEach(({ mimeType }) => {
    if (mimeType.startsWith('image/')) counts.image++;
    else if (mimeType.startsWith('video/')) counts.video++;
    else if (mimeType.startsWith('application/')) counts.document++;
    else counts.other++;
  });

  const parts = [
    counts.image && `${counts.image} ${counts.image === 1 ? 'image' : 'images'}`,
    counts.video && `${counts.video} ${counts.video === 1 ? 'video' : 'videos'}`,
    counts.document && `${counts.document} ${counts.document === 1 ? 'doc' : 'docs'}`,
    counts.other && `${counts.other} other`,
  ].filter(Boolean);

  return parts.length
    ? `<p class="collections__card-types">${escHtml(parts.join(' · '))}</p>`
    : '';
}

// ─── Mosaic lazy-loading ───────────────────────────────────────────────────────

function loadMosaics(block) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      loadCardMosaic(entry.target);
    });
  }, { rootMargin: '200px' });

  block.querySelectorAll('.collections__card[data-thumb-ids]').forEach((card) => {
    if (card.dataset.thumbIds) observer.observe(card);
  });
}

async function loadCardMosaic(card) {
  const assetIds = card.dataset.thumbIds?.split(',').filter(Boolean) || [];
  if (!assetIds.length) return;

  const thumbEls = [...card.querySelectorAll('.asc-ui-collection-card__thumb')];

  await Promise.all(assetIds.map(async (assetId, i) => {
    const el = thumbEls[i];
    if (!el) return;
    try {
      const asset = await Asset.create(assetId);
      if (!asset?.path) return;
      const srcset = services.renditions.getThumbnailSrcset(asset);
      const url = srcset.length
        ? srcset[Math.floor(srcset.length / 2)].url
        : services.renditions.getThumbnailUrl(asset);
      const img = document.createElement('img');
      img.alt = asset.description || asset.title || asset.name || '';
      img.loading = 'lazy';
      img.src = url;
      if (srcset.length) {
        img.srcset = srcset.map((r) => `${r.url} ${r.size.width}w`).join(', ');
        img.sizes = '(min-width: 768px) 120px, 80px';
      }
      el.classList.remove('asc-ui-skeleton');
      el.appendChild(img);
    } catch {
      el.classList.remove('asc-ui-skeleton');
    }
  }));
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
