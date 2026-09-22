/** @owner user */
import { readBlockConfig } from '../../scripts/asc/core/utils/blocks.js';
import { SEARCH_FORM } from '../../scripts/asc/core/utils/search.js';
import assetTeaser from '../../scripts/asc/core/parts/asset-teaser/asset-teaser.js';
import collectionToggle from '../../scripts/asc/core/parts/collection-toggle/collection-toggle.js';
import { initSelection } from '../../scripts/asc/core/utils/selection.js';
import { mountToHeader } from '../../scripts/asc/core/utils/header-mount.js';
import { Events as CollectionEvents } from '../../scripts/asc/core/services/collections/collections.js';
import services from '../../scripts/asc/core/services/services.js';
import configurations from '../../scripts/asc/configurations.js';
import { toggleRenditionMenu, prefetchRenditionSizes } from '../../scripts/asc/rendition-download-menu.js';
import { canCopyImage, copyImageToClipboard } from '../../scripts/asc/core/utils/clipboard-image.js';
import { withViewTransition } from '../../scripts/asc/core/utils/view-transition.js';

const MASONRY_SIZES = '(min-width: 1400px) 25vw, (min-width: 1000px) 33vw, (min-width: 640px) 50vw, 100vw';
const MASONRY_COL_WIDTH = 360; // target column width — smaller value = more columns at wider viewports
const FILL_LEAD_PX = 1200; // how far below the viewport bottom triggers a load, in px
const MAX_AUTO_FILL_ROUNDS = 50; // safety cap on consecutive auto-triggered loads per fresh search
// Kept low deliberately: the skeleton always renders a full page's worth of
// placeholders with no way to know the real result count in advance, so a
// narrow query (fewer real results than the skeleton assumed) shrinks the
// results container — and everything below it, including the footer —
// right after the response lands. A smaller count bounds how large that
// shrink can be, at the cost of the loading state looking less "full" when
// a query does return many results.
const SKELETON_COUNT = 6;

const ICONS = {
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  copyUrl: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  copyImage: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  star: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9"/></svg>',
  minus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3.5 8h9"/></svg>',
};

// Per-container masonry state: tracks column elements and round-robin index.
const masonryState = new WeakMap();

// ── Default labels for built-in properties in list column headers ─────────
const PROP_LABELS = {
  title: 'Name', thumbnail: '', 'file-type': 'Type', 'file-size': 'Size',
  'file-extension': 'Ext', dimensions: 'Dimensions', width: 'Width', height: 'Height',
  modified: 'Modified', created: 'Created', description: 'Description',
  filename: 'Filename', 'mime-type': 'MIME Type',
};

// ── Default list column definitions ──────────────────────────────────────
const DEFAULT_LIST_COLS = [
  { property: 'thumbnail', width: '88px'  },
  { property: 'title',     width: '1fr'   },
  { property: 'file-type', width: '120px' },
  { property: 'file-size', width: '90px'  },
  { property: 'modified',  width: '150px' },
];

// Trailing actions cell holds up to 5 icon buttons (favorite + collection
// toggles, download/copy-url/copy-image) at ~32px each plus gaps/padding —
// narrower than this clips or overlaps them.
const DEFAULT_ACTIONS_WIDTH = '220px';

function getListCols() {
  const configured = configurations.searchResults?.views?.list;
  if (!configured) return DEFAULT_LIST_COLS;
  // Normalise: strings become { property } objects
  return configured.map((c) => (typeof c === 'string' ? { property: c } : c));
}

function getActionsWidth() {
  return configurations.searchResults?.views?.listActionsWidth || DEFAULT_ACTIONS_WIDTH;
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const EMPTY_CELL_HTML = '<span class="asc-list-view__empty">—</span>';

function renderListCell(col, asset) {
  // Escape-hatch: custom render function
  if (col.render) return col.render(asset, services) ?? EMPTY_CELL_HTML;

  const { property } = col;
  if (property === 'thumbnail') {
    const alt = esc(asset.description || asset.title || asset.name || '');
    const srcset = services.renditions.getThumbnailSrcset(asset);
    if (srcset.length) {
      const srcsetAttr = srcset.map((r) => `${r.url} ${r.size.width}w`).join(', ');
      return `<img class="asc-list-view__thumb" src="${esc(srcset[0].url)}" srcset="${srcsetAttr}" sizes="88px" alt="${alt}" loading="lazy">`;
    }
    return `<img class="asc-list-view__thumb" src="${esc(asset.thumbnail)}" alt="${alt}" loading="lazy">`;
  }
  const { text } = asset.getProperty(property);
  return text ? esc(text) : EMPTY_CELL_HTML;
}

function quickActionButtonsHtml(assetId) {
  return `
    <div class="search-results__quick-actions">
      <button type="button"
              class="search-results__quick-action search-results__quick-download asc-ui-icon-btn"
              data-asc-asset="${esc(assetId)}"
              aria-haspopup="true" aria-expanded="false"
              aria-label="Download asset" title="Download asset">${ICONS.download}</button>
      <button type="button"
              class="search-results__quick-action search-results__quick-copy-url asc-ui-icon-btn"
              data-asc-asset="${esc(assetId)}"
              aria-haspopup="true" aria-expanded="false"
              aria-label="Copy rendition URL" title="Copy rendition URL">${ICONS.copyUrl}</button>
      <button type="button"
              class="search-results__quick-action search-results__quick-copy-image asc-ui-icon-btn"
              data-asc-asset="${esc(assetId)}"
              aria-haspopup="true" aria-expanded="false"
              aria-label="Copy image" title="Copy image">${ICONS.copyImage}</button>
    </div>`;
}

// Fallback face for assets with no image preview — glyph + short label using the
// kit's .asc-ui-filetype primitive (styles/ui-kit.css). Keyed off the same
// data-asc-file-type value set by asset-teaser.js (asset.getProperty('file-type')),
// see scripts/asc/core/services/properties/file-type.js for the full label set.
const FILETYPE_FACES = {
  PDF: { glyph: '📕', ext: 'PDF' },
  Video: { glyph: '🎬', ext: 'Video' },
  Audio: { glyph: '🎵', ext: 'Audio' },
  'Word Doc': { glyph: '📝', ext: 'Doc' },
  Excel: { glyph: '📊', ext: 'Excel' },
  PowerPoint: { glyph: '📙', ext: 'Slides' },
  Zip: { glyph: '📦', ext: 'Zip' },
};
const DEFAULT_FILETYPE_FACE = { glyph: '📄', ext: 'File' };

function fileTypeFaceHtml(fileType) {
  const face = FILETYPE_FACES[fileType] || DEFAULT_FILETYPE_FACE;
  return `
    <div class="asc-ui-filetype">
      <span class="asc-ui-filetype__glyph" aria-hidden="true">${face.glyph}</span>
      <span class="asc-ui-filetype__ext">${esc(face.ext)}</span>
    </div>`;
}

function renderListActionsCell(asset) {
  return `
    <div class="asc-list-view__actions">
      ${collectionToggle(asset, { favorite: true })}
      ${collectionToggle(asset, { addLabel: 'Add to collection', removeLabel: 'Remove from collection' })}
      ${quickActionButtonsHtml(asset.uuid)}
    </div>`;
}

// Native-tooltip support: mirrors aria-label onto title for any button inside
// the results grid. Covers the quick-action buttons' static labels (set inline
// above) as well as labels set asynchronously elsewhere — e.g. the favorite/
// add-to-collection toggle labels hydrated by collection-toggle.js (ASC Core),
// and the transient "Image copied"/"Link copied" swaps during copy feedback.
function observeAriaLabelTitles(root) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(({ target, attributeName }) => {
      if (attributeName !== 'aria-label') return;
      const label = target.getAttribute('aria-label');
      if (label) target.title = label;
      else target.removeAttribute('title');
    });
  });
  observer.observe(root, { attributes: true, attributeFilter: ['aria-label'], subtree: true });
}

function getMasonryState(container) {
  if (masonryState.has(container)) return masonryState.get(container);
  const count = idealMasonryColCount(container);
  const cols = Array.from({ length: count }, () => {
    const col = document.createElement('div');
    col.className = 'masonry-col';
    container.appendChild(col);
    return col;
  });
  const state = { cols, next: 0 };
  masonryState.set(container, state);
  return state;
}

function idealMasonryColCount(container) {
  return Math.min(8, Math.max(2, Math.floor((container.offsetWidth || window.innerWidth) / MASONRY_COL_WIDTH)));
}

// Redistribute existing masonry items across a new column count on resize —
// getMasonryState() only picks a count once (at first render), so without this
// the columns just stretch/shrink instead of adding/removing as the viewport changes.
function reflowMasonryColumns(container) {
  const state = masonryState.get(container);
  if (!state) return;

  const targetCount = idealMasonryColCount(container);
  if (targetCount === state.cols.length) return;

  // Recover original round-robin insertion order by reading row-by-row across columns.
  const maxRows = Math.max(0, ...state.cols.map((col) => col.children.length));
  const items = [];
  for (let row = 0; row < maxRows; row += 1) {
    state.cols.forEach((col) => {
      if (col.children[row]) items.push(col.children[row]);
    });
  }

  const newCols = Array.from({ length: targetCount }, () => {
    const col = document.createElement('div');
    col.className = 'masonry-col';
    return col;
  });
  items.forEach((item, i) => newCols[i % targetCount].appendChild(item));

  container.replaceChildren(...newCols);
  state.cols = newCols;
  state.next = items.length;
}

// Masonry has no fixed aspect-ratio box (unlike cards/list — see
// asset-teaser.css), so without intrinsic size hints the browser can't
// reserve an image's footprint before it loads; every image finishing then
// shifts everything below it in the column (CLS). Setting width/height
// attrs (not CSS) lets the browser compute the right aspect ratio up front
// while still rendering at width:100%/height:auto.
//
// Falls back to a 4:3 guess (matching the no-preview fallback face's ratio
// elsewhere in this file) when the asset has no dimensions metadata — an
// asset missing that property got zero reservation at all (aspect-ratio:
// auto), which is worse than an imperfect guess: the real image swapping in
// at a different ratio still shifts things once, but a fully-unreserved box
// guarantees a shift every time, and a bigger one (0 height to full height).
function applyMasonryDimensions(col, asset) {
  const img = col.lastElementChild?.querySelector('.asc-asset-teaser__preview img');
  if (!img) return;
  const { width, height } = asset.getProperty('dimensions').data || {};
  img.width = width || 4;
  img.height = height || 3;
}

function appendMasonryItems(container, assets) {
  const state = getMasonryState(container);
  assets.forEach((asset) => {
    const col = state.cols[state.next % state.cols.length];
    col.insertAdjacentHTML('beforeend',
      assetTeaser(asset, { mode: 'card', view: 'masonry' })
        .replace(/sizes="[^"]*"/, `sizes="${MASONRY_SIZES}"`));
    applyMasonryDimensions(col, asset);
    state.next += 1;
  });
}

function renderListRows(assets, cols) {
  return assets.map((asset) => `
    <div class="asc-list-view__row"
         data-asc-asset="${esc(asset.uuid)}"
         data-asc-action="asset:details:open@click"
         role="row"
         tabindex="0">
      ${cols.map((col) => `<div class="asc-list-view__cell" role="cell">${renderListCell(col, asset)}</div>`).join('')}
      <div class="asc-list-view__cell asc-list-view__cell--actions" role="cell">${renderListActionsCell(asset)}</div>
    </div>`).join('');
}

function renderListView(assets) {
  const cols = getListCols();
  const trackSizes = [...cols.map((c) => c.width || 'auto'), getActionsWidth()].join(' ');
  const headers = cols.map((col) => {
    const label = col.label ?? PROP_LABELS[col.property] ?? col.property ?? '';
    return `<div class="asc-list-view__cell asc-list-view__cell--header" role="columnheader">${label}</div>`;
  }).join('');

  return `
    <div class="asc-list-view" style="--asc-list-cols: ${trackSizes}" role="table">
      <div class="asc-list-view__header" role="row">${headers}<div class="asc-list-view__cell asc-list-view__cell--header asc-list-view__cell--actions-header" role="columnheader">Actions</div></div>
      <div class="asc-list-view__rows" role="rowgroup">
        ${renderListRows(assets, cols)}
      </div>
    </div>`;
}

const VALID_DISPLAY_MODES = new Set(['masonry', 'cards', 'list']);

function getDisplayMode() {
  const value = document.querySelector('[name="asc.search-results.display"]')?.value;
  return VALID_DISPLAY_MODES.has(value) ? value : 'masonry';
}

// Promote the first N result images to eager + high priority for LCP.
// Only called on fresh renders (not load-more); load-more images are below the fold.
// Count 4 covers the first visible row across 2–4 column grid layouts.
function promoteAboveFoldImages(container, count = 4) {
  let promoted = 0;
  for (const img of container.querySelectorAll('img')) {
    if (promoted >= count) break;
    img.loading = 'eager';
    img.fetchPriority = 'high';
    promoted += 1;
  }
}

function markNoPreview(img) {
  const teaser = img.closest('.asc-asset-teaser');
  if (!teaser) return;
  teaser.classList.add('asc-asset-teaser--no-preview');
  const preview = teaser.querySelector('.asc-asset-teaser__preview');
  if (preview && !preview.querySelector('.asc-ui-filetype')) {
    preview.insertAdjacentHTML('beforeend', fileTypeFaceHtml(teaser.dataset.ascFileType));
  }
}

function attachImageHandlers(resultsEl) {
  resultsEl.querySelectorAll('.asc-asset-teaser__preview img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) {
      markNoPreview(img);
      return;
    }
    img.addEventListener('error', () => markNoPreview(img), { once: true });
  });
}

function injectQuickActionButtons(resultsEl, display) {
  if (display === 'list') return;

  // Only the generic +/− toggle, not the favorite star toggle — each card renders
  // both (asset-teaser.js), and injecting into both would duplicate the download/
  // copy-url/copy-image buttons and overlap them behind the favorite toggle.
  // Inserted as a sibling of the toggle (not a child) so the toggle's own width
  // stays fixed at one button — the favorite toggle's left offset is computed
  // from that fixed width and would otherwise land on top of these buttons.
  resultsEl.querySelectorAll('.asc-asset-teaser .asc-collection-toggle--generic').forEach((toggle) => {
    const teaser = toggle.closest('.asc-asset-teaser');
    if (!teaser || teaser.querySelector('.search-results__quick-actions')) return;
    const assetId = teaser.dataset?.ascAsset;
    if (!assetId) return;

    toggle.insertAdjacentHTML('afterend', quickActionButtonsHtml(assetId));
  });
}

function triggerAssetDownload(rendition, asset) {
  if (!rendition?.url) return;
  const link = document.createElement('a');
  link.href = rendition.url;
  link.download = asset.filename || asset.title || 'asset';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Briefly swap a quick-action button's icon to a checkmark to confirm the click did
// something invisible (a clipboard write has no other visible feedback).
function flashCopyIcon(btn) {
  const original = btn.innerHTML;
  btn.innerHTML = ICONS.check;
  setTimeout(() => {
    btn.innerHTML = original;
  }, 1500);
}

function copyRenditionUrl(btn, rendition) {
  if (!rendition?.url) return;
  navigator.clipboard.writeText(rendition.url).then(() => flashCopyIcon(btn));
}

// Flashes a checkmark either way, but the aria-label distinguishes "copied the
// image" from "copied the link instead" (e.g. blocked by CORS) — see
// scripts/asc/core/utils/clipboard-image.js for why the fallback exists. Restores the
// original label alongside the icon so a screen reader hears "Copy image"
// again next time, not a stale "Image copied".
async function copyRenditionImage(btn, rendition) {
  if (!rendition?.url) return;
  const result = await copyImageToClipboard(rendition);
  if (result === 'failed') return;
  const originalLabel = btn.getAttribute('aria-label');
  btn.setAttribute('aria-label', result === 'image' ? 'Image copied' : 'Link copied (image copy unavailable)');
  flashCopyIcon(btn);
  setTimeout(() => btn.setAttribute('aria-label', originalLabel), 1500);
}

// Card/masonry-shaped skeleton tile, composed from the same asc-ui-asset-card
// kit primitive real results use — so the loading state fills the grid with
// content-shaped placeholders instead of one flat background rectangle.
function skeletonCardHtml() {
  return `
    <article class="asc-ui-asset-card" aria-hidden="true">
      <div class="asc-ui-asset-card__thumb asc-ui-skeleton"></div>
      <div class="asc-ui-asset-card__body">
        <p class="asc-ui-asset-card__title asc-ui-skeleton asc-ui-skeleton--title"></p>
        <p class="asc-ui-asset-card__meta asc-ui-skeleton asc-ui-skeleton--text"></p>
      </div>
    </article>`;
}

function skeletonListHtml() {
  const cols = getListCols();
  const trackSizes = [...cols.map((c) => c.width || 'auto'), getActionsWidth()].join(' ');
  const rows = Array.from({ length: SKELETON_COUNT }, () => `
    <div class="asc-list-view__row" aria-hidden="true">
      ${cols.map((col) => `<div class="asc-list-view__cell">${col.property === 'thumbnail'
    ? '<span class="asc-ui-skeleton asc-list-view__thumb"></span>'
    : '<span class="asc-ui-skeleton asc-ui-skeleton--text"></span>'}</div>`).join('')}
      <div class="asc-list-view__cell"></div>
    </div>`).join('');

  return `<div class="asc-list-view" style="--asc-list-cols: ${trackSizes}">${rows}</div>`;
}

// Masonry mode lays results out as flex `.masonry-col` columns (see
// [data-display="masonry"] in search-results.css), not the plain grid cards
// mode uses — without wrapping skeleton tiles in the same columns, the bare
// flex container shrinks each tile to its content width instead of the
// clamped column width, collapsing the skeletons into thin slivers.
function skeletonMasonryHtml(container) {
  const count = idealMasonryColCount(container);
  const cols = Array.from({ length: count }, () => []);
  Array.from({ length: SKELETON_COUNT }, (_, i) => cols[i % count].push(skeletonCardHtml()));
  return cols.map((tiles) => `<div class="masonry-col">${tiles.join('')}</div>`).join('');
}

function skeletonHtml(display, container) {
  if (display === 'list') return skeletonListHtml();
  if (display === 'masonry') return skeletonMasonryHtml(container);
  return Array.from({ length: SKELETON_COUNT }, skeletonCardHtml).join('');
}

function pluralAssets(count) {
  return `${count} asset${count === 1 ? '' : 's'}`;
}

// Which collection each bulk action targets, and the copy for its confirmation toast.
const BULK_ACTIONS = {
  favorite: {
    method: 'addAsset', verb: 'Added', preposition: 'to', collectionId: () => services.collections.getDefaultId(), destination: () => 'Favorites',
  },
  unfavorite: {
    method: 'removeAsset', verb: 'Removed', preposition: 'from', collectionId: () => services.collections.getDefaultId(), destination: () => 'Favorites',
  },
  collection: {
    method: 'addAsset', verb: 'Added', preposition: 'to', collectionId: () => services.collections.getActiveId(), destination: (name) => name,
  },
  uncollection: {
    method: 'removeAsset', verb: 'Removed', preposition: 'from', collectionId: () => services.collections.getActiveId(), destination: (name) => name,
  },
};

// Ctrl/cmd+click and shift+click (wired by initSelection() on [data-asc-results])
// select results without opening the details modal; this bar surfaces once that
// selection is non-empty, favoriting/collecting every selected asset in one action
// instead of one toggle click per result.
function setupBulkActions(block, bar, selection) {
  const countEl = bar.querySelector('[data-bulk-count]');
  const favoriteBtn = bar.querySelector('[data-bulk-action="favorite"]');
  const unfavoriteBtn = bar.querySelector('[data-bulk-action="unfavorite"]');
  const collectionBtn = bar.querySelector('[data-bulk-action="collection"]');
  const uncollectionBtn = bar.querySelector('[data-bulk-action="uncollection"]');
  const addLabelEl = bar.querySelector('[data-bulk-add-label]');
  const removeLabelEl = bar.querySelector('[data-bulk-remove-label]');
  let activeCollectionName = 'the collection';

  // Recomputes which add/remove buttons show, and the active-collection labels,
  // against the current selection. Runs on every selection change and whenever
  // collection membership changes elsewhere (another block adding/removing an
  // asset, or switching the active collection) while the bar stays open.
  // Add hides only once every selected asset already belongs (still useful to
  // add the rest of a mixed selection); Remove shows as soon as any of them do.
  async function refreshActions(assetIds) {
    if (assetIds.length === 0) return;

    const favoriteId = services.collections.getDefaultId();
    const activeId = services.collections.getActiveId();
    const favoriteIsActive = activeId === favoriteId;

    const favoriteMembership = await Promise.all(
      assetIds.map((id) => services.collections.hasAsset(id, favoriteId)),
    );
    favoriteBtn.hidden = favoriteMembership.every(Boolean);
    unfavoriteBtn.hidden = !favoriteMembership.some(Boolean);

    // Duplicate of the favorite pair once the active collection IS Favorites —
    // same dedup rule the per-asset collection-toggle part applies.
    if (favoriteIsActive) {
      collectionBtn.hidden = true;
      uncollectionBtn.hidden = true;
      return;
    }

    const active = await services.collections.get(activeId);
    activeCollectionName = active?.name || 'the collection';
    addLabelEl.textContent = `Add to ${activeCollectionName}`;
    removeLabelEl.textContent = `Remove from ${activeCollectionName}`;

    const activeMembership = await Promise.all(
      assetIds.map((id) => services.collections.hasAsset(id, activeId)),
    );
    collectionBtn.hidden = activeMembership.every(Boolean);
    uncollectionBtn.hidden = !activeMembership.some(Boolean);
  }

  // Selection events bubble from [data-asc-results] (see selection.js) up through
  // block — listening here keeps working even though that element's contents (but
  // not the element itself) get replaced on every render.
  block.addEventListener('asc:selection:change', (event) => {
    const { selected } = event.detail;
    bar.hidden = selected.size === 0;
    countEl.textContent = String(selected.size);
    refreshActions([...selected]);
  });

  document.addEventListener(CollectionEvents.CHANGED, () => {
    if (bar.hidden) return;
    refreshActions([...selection.getSelected()]);
  });

  bar.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-bulk-action]');
    if (!trigger) return;

    const { bulkAction } = trigger.dataset;
    if (bulkAction === 'clear') {
      selection.clear();
      return;
    }
    if (bulkAction === 'select-all') {
      selection.selectAll();
      return;
    }

    const action = BULK_ACTIONS[bulkAction];
    if (!action) return;

    const assetIds = [...selection.getSelected()];
    const collectionId = action.collectionId();
    assetIds.forEach((assetId) => services.collections[action.method](assetId, collectionId));

    const destination = action.destination(activeCollectionName);
    services.notifications.notify(
      `${action.verb} ${pluralAssets(assetIds.length)} ${action.preposition} ${destination}`,
      { type: 'success' },
    );
    selection.clear();
  });
}

export default async function decorate(block) {
  const config = readBlockConfig(block, {}, {
    'asc.search-results.display': 'masonry',
    limit: 100,
    'no-more-results-text': 'No more results',
  });

  // Support friendly 'Default View' content key (lowercased to 'default-view' by EDS)
  if (config['default-view']) config['asc.search-results.display'] = config['default-view'];

  block.innerHTML = html(config);

  const resultsEl = block.querySelector('[data-asc-results]');
  const storedDisplay = localStorage.getItem('asc.search-results.display');
  resultsEl.dataset.display = VALID_DISPLAY_MODES.has(storedDisplay)
    ? storedDisplay
    : (config['asc.search-results.display'] || 'masonry');
  resultsEl.innerHTML = skeletonHtml(resultsEl.dataset.display, resultsEl);

  await addEventListeners(block, config);
  await emitEvents(block, config);
}

function html(config) {
  return `
    <input type="hidden" name="p.limit" value="${config.limit || 24}" form="${SEARCH_FORM}"/>
    <input type="hidden" name="p.offset" value="0" form="${SEARCH_FORM}"/>
    <input type="hidden" name="asc.search-results.more" value="true"/>
    <input type="hidden" name="asc.search-results.total" value="0"/>

    <div class="search-results__bulk-actions asc-ui-selection-bar" role="toolbar" aria-label="Bulk actions" hidden>
      <span class="asc-ui-selection-bar__count"><span class="asc-ui-count" data-bulk-count>0</span> selected</span>
      <div class="asc-ui-selection-bar__actions">
        <button type="button" class="asc-ui-selection-bar__action" data-bulk-action="favorite">
          <span class="asc-ui-selection-bar__icon" aria-hidden="true">${ICONS.star}</span>
          Favorite
        </button>
        <button type="button" class="asc-ui-selection-bar__action" data-bulk-action="unfavorite" hidden>
          <span class="asc-ui-selection-bar__icon" aria-hidden="true">${ICONS.minus}</span>
          Remove from Favorites
        </button>
        <button type="button" class="asc-ui-selection-bar__action" data-bulk-action="collection">
          <span class="asc-ui-selection-bar__icon" aria-hidden="true">${ICONS.plus}</span>
          <span data-bulk-add-label>Add to collection</span>
        </button>
        <button type="button" class="asc-ui-selection-bar__action" data-bulk-action="uncollection" hidden>
          <span class="asc-ui-selection-bar__icon" aria-hidden="true">${ICONS.minus}</span>
          <span data-bulk-remove-label>Remove from collection</span>
        </button>
      </div>
      <div class="asc-ui-selection-bar__group">
        <button type="button" class="btn btn--ghost btn--sm" data-bulk-action="select-all">Select all</button>
        <button type="button" class="btn btn--ghost btn--sm" data-bulk-action="clear">Clear</button>
      </div>
    </div>

    <div data-asc-results data-loading></div>
    <p class="search-results__end" hidden>
      <span class="asc-ui-badge">${esc(config['no-more-results-text'])}</span>
    </p>
  `;
}

async function addEventListeners(block, _config) {
  let isLoadingMore = false;
  let sentinel = null;
  let observer = null;
  let fillRounds = 0;

  const resultsEl = block.querySelector('[data-asc-results]');
  new ResizeObserver(() => reflowMasonryColumns(resultsEl)).observe(resultsEl);
  observeAriaLabelTitles(resultsEl);

  const selection = initSelection(resultsEl);
  const bulkActionsBar = block.querySelector('.search-results__bulk-actions');
  setupBulkActions(block, bulkActionsBar, selection);
  // Teleport into the sticky header (same mechanism as search-active-filters) so
  // the bar stays visible while scrolling through a long results list.
  mountToHeader(bulkActionsBar);

  function requestLoadMore() {
    isLoadingMore = true;
    document.dispatchEvent(new CustomEvent('asc:search:execute', {
      detail: { type: 'load-more' },
    }));
  }

  function sentinelNearViewport() {
    if (!sentinel) return false;
    return sentinel.getBoundingClientRect().top < window.innerHeight + FILL_LEAD_PX;
  }

  function setupSentinel() {
    // Create a sentinel element just below the results; IntersectionObserver
    // triggers load-more when it enters the viewport instead of polling on scroll.
    if (sentinel) return;

    sentinel = document.createElement('div');
    sentinel.className = 'search-results__sentinel';
    block.querySelector('[data-asc-results]').after(sentinel);

    observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      const moreInput = block.querySelector('[name="asc.search-results.more"]');
      if (!moreInput || moreInput.value === 'false' || isLoadingMore) return;

      // A real user scroll is always a fresh not-intersecting -> intersecting
      // transition, so it always gets its own fill budget.
      fillRounds = 0;
      requestLoadMore();
    }, { rootMargin: `${FILL_LEAD_PX}px 0px` });

    observer.observe(sentinel);
  }

  /* Display the results */
  document.addEventListener('asc:search:complete', async (event) => {
    const { results } = event.detail;

    if (!results) {
      console.warn('Search completed but no results data received');
      return;
    }

    block.querySelector('[name="asc.search-results.more"]').value = results.more;
    block.querySelector('[name="asc.search-results.total"]').value = results.total || 0;

    const endEl = block.querySelector('.search-results__end');
    endEl.hidden = results.more || !(results.total > 0);

    // Derive next offset from the server-reported values so fresh searches
    // (offset=0) always reset correctly.
    const newOffset = (results.offset || 0) + (results.size || 0);
    block.querySelector('[name="p.offset"]').value = newOffset;

    const display = getDisplayMode();
    const resultsEl = block.querySelector('[data-asc-results]');
    resultsEl.dataset.display = display;
    // Drop the loading placeholder so the grid cell height is no longer constrained.
    delete resultsEl.dataset.loading;

    const applyFreshRender = () => {
      if (results.size === 0) {
        resultsEl.innerHTML = `
          <div class="asc-ui-empty-state asc-ui-empty-state--plain">
            <span class="asc-ui-empty-state__icon" aria-hidden="true">🔍</span>
            <p class="asc-ui-empty-state__title">No results found</p>
            <p class="asc-ui-empty-state__hint">Try adjusting your search terms or filters.</p>
          </div>`;
      } else if (display === 'list') {
        resultsEl.innerHTML = renderListView(results.assets);
      } else if (display === 'masonry') {
        resultsEl.innerHTML = '';
        masonryState.delete(resultsEl);
        appendMasonryItems(resultsEl, results.assets || []);
      } else {
        resultsEl.innerHTML = results.assets
          .map((asset) => assetTeaser(asset, { mode: 'card', view: display })).join('') || '';
      }
      promoteAboveFoldImages(resultsEl);
      attachImageHandlers(resultsEl);
      injectQuickActionButtons(resultsEl, display);
    };

    if (event.detail.type === 'load-more') {
      if (display === 'list') {
        resultsEl.querySelector('.asc-list-view__rows')
          ?.insertAdjacentHTML('beforeend', renderListRows(results.assets || [], getListCols()));
      } else if (display === 'masonry') {
        appendMasonryItems(resultsEl, results.assets || []);
      } else {
        resultsEl.insertAdjacentHTML('beforeend',
          results.assets?.map((asset) => assetTeaser(asset, { mode: 'card', view: display })).join('') || '');
      }
      attachImageHandlers(resultsEl);
      injectQuickActionButtons(resultsEl, display);
    } else {
      // withViewTransition's update callback does not run synchronously (confirmed:
      // document.startViewTransition(cb) returns before cb executes) — attaching
      // image handlers / injecting quick actions here, inside applyFreshRender,
      // guarantees the new cards actually exist in the DOM first. Calling them
      // right after this if/else (as before) raced the transition and silently
      // found nothing to inject into on a fresh render.
      withViewTransition(applyFreshRender);
    }

    isLoadingMore = false;
    setupSentinel(); // no-op after first call; observer handles further scroll-driven loads

    // A fresh render (new query, or a view-mode switch that re-renders from cached
    // results) replaces every item element — any prior selection no longer refers
    // to anything on screen, so drop it. load-more only appends, existing selected
    // items stay put.
    if (event.detail.type !== 'load-more') {
      fillRounds = 0;
      selection.clear();
    }

    // IntersectionObserver only fires on a not-intersecting -> intersecting transition.
    // If a page of results doesn't fill the viewport, the sentinel stays continuously
    // intersecting across appends and the observer never fires again on its own. Measure
    // directly and keep requesting more until the viewport is satisfied, results run out,
    // or the safety cap is hit.
    if (results.more && fillRounds < MAX_AUTO_FILL_ROUNDS && sentinelNearViewport()) {
      fillRounds += 1;
      requestLoadMore();
    }
  });

  function resolveAssetFor(el) {
    const assetContainer = el.closest('[data-asc-asset]');
    const assetId = el.dataset.ascAsset || assetContainer?.dataset?.ascAsset;
    return assetId && window.asc?.cache?.assets?.get(assetId);
  }

  block.addEventListener('click', (event) => {
    if (event.target.closest('.asc-list-view__actions')) {
      event.stopPropagation();
    }

    const downloadBtn = event.target.closest('.search-results__quick-download');
    const copyUrlBtn = !downloadBtn && event.target.closest('.search-results__quick-copy-url');
    const copyImageBtn = !downloadBtn && !copyUrlBtn && event.target.closest('.search-results__quick-copy-image');
    const trigger = downloadBtn || copyUrlBtn || copyImageBtn;
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();

    const asset = resolveAssetFor(trigger);
    if (!asset) return;

    if (downloadBtn) {
      toggleRenditionMenu(downloadBtn, asset, (rendition) => triggerAssetDownload(rendition, asset), {
        title: 'Downloads',
      });
    } else if (copyUrlBtn) {
      toggleRenditionMenu(copyUrlBtn, asset, (rendition) => copyRenditionUrl(copyUrlBtn, rendition), {
        title: 'Copy URL',
      });
    } else {
      toggleRenditionMenu(copyImageBtn, asset, (rendition) => copyRenditionImage(copyImageBtn, rendition), {
        title: 'Copy Image',
        filter: canCopyImage,
      });
    }
  });

  // Warm rendition file sizes on hover so the menu doesn't show blank sizes
  // while the user is still deciding whether to click it.
  block.addEventListener('mouseover', (event) => {
    const trigger = event.target.closest(
      '.search-results__quick-download, .search-results__quick-copy-url, .search-results__quick-copy-image',
    );
    if (!trigger) return;
    const asset = resolveAssetFor(trigger);
    if (asset) prefetchRenditionSizes(asset);
  });

  /* Drag-and-drop */
  block.addEventListener('dragstart', (event) => {
    const article = event.target.closest('[data-asc-asset]');
    if (!article) return;

    const assetId = article.dataset.ascAsset;
    const asset = window.asc?.cache?.assets?.get(assetId);
    if (!asset) return;

    const mimeType = article.dataset.ascMimeType || asset.mimeType || 'application/octet-stream';

    const rendition = services.renditions.getRendition(asset, 'original')
      || services.renditions.getRendition(asset, 'web');

    if (!rendition?.url) return;

    const filename = asset.filename || `${asset.title || 'asset'}`;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('DownloadURL', `${mimeType}:${filename}:${rendition.url}`);
    event.dataTransfer.setData('text/uri-list', rendition.url);
    event.dataTransfer.setData('text/plain', rendition.url);
  });
}

// Initial search is triggered by search.js once all blocks are loaded (asc:blocks:loaded).
// No need to dispatch here — search.js owns page-load search initiation.
// eslint-disable-next-line no-unused-vars
async function emitEvents(_block, _config) {}
