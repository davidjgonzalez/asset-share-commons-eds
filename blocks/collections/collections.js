/** @owner user */
import Asset from '../../scripts/asc/core/models/asset.js';
import services from '../../scripts/asc/core/services/services.js';
import { Events as CollectionEvents } from '../../scripts/asc/core/services/collections/collections.js';
import { escHtml, escAttr, formatUpdated } from '../../scripts/asc/html.js';
import { readBlockConfig } from '../../scripts/asc/core/utils/blocks.js';
import { MAX_MOSAIC_THUMBS, mosaicRowCounts, mosaicHeight } from '../../scripts/asc/core/utils/mosaic.js';
import { wireDialogClose } from '../../scripts/asc.js';

const configurations = (await import('../../scripts/asc/configurations.js')).default;

const COLLECTION_PATH = configurations.collections?.collectionPath || '/collections/collection';

/**
 * Collections block — index/management page for all user collections, or a
 * compact horizontal rail (e.g. for placing on the homepage).
 * Page title and intro copy are authored in DA.live above this block.
 *
 * Content config (key | value rows):
 *   display  'grid' (default, full management page) | 'rail' (compact strip —
 *            no create/duplicate/delete actions, horizontal scroll)
 *   limit    max collections to show; 0 or omitted = no limit
 *
 * Features:
 *   - Grid or rail of collection cards: mosaic of up to 4 asset thumbnails
 *     (lazy-loaded), name, asset type counts, total count, last updated
 *   - Grid mode adds: "New Collection" modal dialog, Set active / Duplicate /
 *     Delete actions per card
 *   - Re-renders on any collection change event
 *   - Navigate to collection detail page at COLLECTION_PATH?id=<uuid>
 */
export default async function decorate(block) {
  const config = readBlockConfig(block, {}, { display: 'grid', limit: 0 });
  const isRail = config.display === 'rail';
  const limit = Number(config.limit) || 0;

  await render(block, isRail, limit);

  document.addEventListener(CollectionEvents.CHANGED, async () => {
    await render(block, isRail, limit);
  });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

async function render(block, isRail, limit) {
  const collections = await services.collections.getAll(false);
  const activeId = services.collections.getActiveId();
  const data = services.collections._getData();
  const defaultId = data.defaultId;
  const sorted = [...collections].sort((a, b) => {
    const tb = new Date(b.modifiedAt || 0).getTime();
    const ta = new Date(a.modifiedAt || 0).getTime();
    return tb - ta;
  });
  const shown = limit > 0 ? sorted.slice(0, limit) : sorted;

  block.innerHTML = html(shown, activeId, defaultId, isRail);
  initInteractions(block, isRail);
  loadMosaics(block);
  renderHeaderActions(block, isRail);
}

function html(collections, activeId, defaultId, isRail) {
  return `
    <section class="collections__shell" aria-label="Collections">
      <ul class="collections__grid${isRail ? ' collections__grid--rail' : ''}" role="list">
        ${collections.length
    ? collections.map((c) => collectionCard(c, activeId, defaultId, isRail)).join('')
    : `<li class="collections__empty asc-ui-empty-state">
          <span class="asc-ui-empty-state__icon" aria-hidden="true">📁</span>
          <p class="asc-ui-empty-state__title">No collections yet</p>
          <p class="asc-ui-empty-state__hint">Create a collection to start building a downloadable set of assets.</p>
        </li>`}
      </ul>
    </section>`;
}

function collectionCard(collection, activeId, defaultId, isRail) {
  const count = collection.assetIds?.length ?? 0;
  const isActive = collection.id === activeId;
  const isDefault = collection.id === defaultId;
  const updated = formatUpdated(collection.modifiedAt);
  const thumbIds = (collection.assetIds || []).slice(0, MAX_MOSAIC_THUMBS);
  const overflow = count - thumbIds.length;

  return `
    <li class="collections__card asc-ui-card asc-ui-card--interactive${isActive ? ' asc-ui-card--active' : ''}"
        data-collection-id="${escAttr(collection.id)}"
        data-thumb-ids="${escAttr(thumbIds.join(','))}">
      <a class="collections__card-link" href="${COLLECTION_PATH}?id=${escAttr(collection.id)}">
        ${mosaicHtml(count, thumbIds, overflow)}
        <div class="collections__card-content">
          <div class="asc-ui-card__header">
            <h2 class="collections__card-name asc-ui-card__title">${escHtml(collection.name)}</h2>
            ${isDefault ? '<span class="asc-ui-badge" title="This is the default collection — it can’t be deleted">Default</span>' : ''}
          </div>
          <div class="asc-ui-card__body">
            ${typeCountsHtml(collection)}
            <p class="collections__card-count"><span class="collections__card-count-num">${count}</span> asset${count !== 1 ? 's' : ''}</p>
            ${updated
    ? `<p class="collections__card-updated">Updated <time datetime="${escAttr(updated.iso)}">${escHtml(updated.label)}</time></p>`
    : ''}
          </div>
        </div>
      </a>
      ${isRail ? '' : `
      <div class="collections__card-actions asc-ui-card__footer">
        ${!isActive
    ? `<button type="button" class="collections__card-activate btn btn--secondary btn--sm"
               data-collection-id="${escAttr(collection.id)}"
               aria-label="Set ${escAttr(collection.name)} as active collection">Set active</button>`
    : ''}
        <button type="button" class="collections__card-duplicate btn btn--secondary btn--sm"
                data-collection-id="${escAttr(collection.id)}"
                data-collection-name="${escAttr(collection.name)}"
                aria-label="Duplicate ${escAttr(collection.name)} collection">Duplicate</button>
        ${!isDefault
    ? `<button type="button" class="collections__card-delete btn btn--ghost btn--sm"
               data-collection-id="${escAttr(collection.id)}"
               aria-label="Delete ${escAttr(collection.name)} collection">Delete</button>`
    : ''}
      </div>`}
    </li>`;
}

function mosaicHtml(count, thumbIds, overflow) {
  if (count === 0) {
    return `<div class="collections__card-mosaic collections__card-mosaic--empty" aria-hidden="true">
      <span class="collections__card-mosaic-icon">🦗</span>
      <span class="collections__card-mosaic-text">So empty…</span>
    </div>`;
  }

  const rowCounts = mosaicRowCounts(thumbIds.length);
  const height = mosaicHeight(rowCounts.length);

  const rowsHtml = rowCounts.map((rowCount, rowIndex) => {
    const isLastRow = rowIndex === rowCounts.length - 1;
    const cells = Array.from({ length: rowCount }, (_, i) => {
      const isLastCell = isLastRow && i === rowCount - 1;
      const more = isLastCell && overflow > 0
        ? `<span class="asc-ui-collection-card__thumb-more">+${overflow}</span>` : '';
      return `<div class="asc-ui-collection-card__thumb asc-ui-skeleton" aria-hidden="true">${more}</div>`;
    }).join('');
    return `<div class="asc-ui-collection-card__thumb-row" style="--collection-card-row-cols: ${rowCount}">${cells}</div>`;
  }).join('');

  return `<div class="collections__card-mosaic" aria-hidden="true">
    <div class="asc-ui-collection-card__thumbs" style="--collection-card-mosaic-height: ${height}px">${rowsHtml}</div>
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

function initInteractions(block, isRail) {
  // Rail mode omits the toolbar and per-card management actions — nothing
  // below is rendered into the DOM, so nothing to wire up.
  if (isRail) return;

  // Set active
  block.querySelectorAll('.collections__card-activate').forEach((btn) => {
    btn.addEventListener('click', () => {
      services.collections.setActive(btn.dataset.collectionId);
    });
  });

  // Duplicate
  block.querySelectorAll('.collections__card-duplicate').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { collectionId, collectionName } = btn.dataset;
      const suggested = `${collectionName} copy`;
      const name = window.prompt('Name for the new collection:', suggested)?.trim();
      if (!name) return;
      services.collections.duplicate(collectionId, name);
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

// ─── Header actions ───────────────────────────────────────────────────────────

// "New Collection" is injected as a DOM sibling of the authored <h1> in the
// page's sibling "content" block (docs/starter-kit/collections.html), rather
// than rendered inside this block's own toolbar, so it lands on the same row
// as the page title via CSS grid (collections.css). Same technique as
// renderTitleMenu in collection-controls.js — must land as an `afterend`
// sibling of h1, never a child: tokens.js's page-wide `{{ }}` registry can
// re-resolve h1's textContent at any time (e.g. an unrelated fragment reload
// calling registerTokens() again), which would wipe any children stuffed
// inside it. Sibling placement is immune.
function renderHeaderActions(block, isRail) {
  const titleBlock = block.closest('.section')?.querySelector('.content.block:has(> h1)');
  if (!titleBlock) return;

  const existing = titleBlock.querySelector('.collections__new-btn');
  if (isRail) {
    existing?.remove();
    return;
  }
  if (existing) return;

  titleBlock.querySelector('h1').insertAdjacentHTML(
    'afterend',
    '<button type="button" class="collections__new-btn btn btn--primary">New Collection</button>',
  );
  titleBlock.querySelector('.collections__new-btn').addEventListener('click', () => {
    openNewCollectionDialog();
  });
}

export function openNewCollectionDialog({ activate = false } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow collections__new-dialog';
  dialog.setAttribute('aria-labelledby', 'collections-new-title');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="collections-new-title">New Collection</h2>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>&#x2715;</button>
    </header>
    <div class="asc-dialog__body collections__new-fields">
      <label class="asc-ui-field">
        <span class="asc-ui-field__label">Name</span>
        <input type="text" class="collections__new-name" placeholder="e.g. Q1 campaign" maxlength="80" autocomplete="off" />
      </label>
      <label class="asc-ui-field">
        <span class="asc-ui-field__label">Description</span>
        <textarea class="collections__new-description" rows="3" maxlength="500"></textarea>
        <span class="asc-ui-field__hint">Optional.</span>
      </label>
    </div>
    <footer class="asc-dialog__footer">
      <button type="button" class="btn btn--secondary" data-dialog-close>Cancel</button>
      <div class="asc-dialog__footer-end">
        <button type="button" class="collections__new-submit btn btn--primary">Create</button>
      </div>
    </footer>`;

  document.body.appendChild(dialog);
  dialog.showModal();
  wireDialogClose(dialog);
  dialog.addEventListener('close', () => dialog.remove());

  const input = dialog.querySelector('.collections__new-name');
  const descInput = dialog.querySelector('.collections__new-description');
  input.focus();

  const submit = () => {
    const name = input.value.trim();
    if (!name) return;
    const created = services.collections.create(name, descInput.value.trim());
    if (activate) services.collections.setActive(created.id);
    dialog.close();
  };

  dialog.querySelector('.collections__new-submit').addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}
