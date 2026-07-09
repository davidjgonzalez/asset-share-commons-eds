/** @owner user */
import { readBlockConfig } from '../../scripts/asc/utils/blocks.js';
import { SEARCH_FORM } from '../../scripts/asc/utils/search.js';
import assetTeaser from '../../scripts/asc/parts/asset-teaser/asset-teaser.js';
import collectionToggle from '../../scripts/asc/parts/collection-toggle/collection-toggle.js';
import services from '../../scripts/asc/services/services.js';
import configurations from '../../scripts/configurations.js';

const MASONRY_SIZES = '(min-width: 1400px) 25vw, (min-width: 1000px) 33vw, (min-width: 640px) 50vw, 100vw';
const MASONRY_COL_WIDTH = 360; // target column width — smaller value = more columns at wider viewports

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
  { property: 'modified',  width: '120px' },
];

function getListCols() {
  const configured = configurations.searchResults?.views?.list;
  if (!configured) return DEFAULT_LIST_COLS;
  // Normalise: strings become { property } objects
  return configured.map((c) => (typeof c === 'string' ? { property: c } : c));
}

// Convert any property value to a display string
function valToText(val) {
  if (val == null) return '—';
  if (typeof val === 'object' && val.width != null) return `${val.width} \u00d7 ${val.height}`;
  return String(val);
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderListCell(col, asset) {
  // Escape-hatch: custom render function
  if (col.render) return col.render(asset, services) ?? '—';

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
  return esc(asset.getProperty(property).text || '—');
}

function renderListActionsCell(asset, renditionId) {
  return `
    <div class="asc-list-view__actions">
      ${collectionToggle(asset, { addLabel: 'Add to collection', removeLabel: 'Remove from collection' })}
      <button type="button"
              class="search-results__quick-download btn btn--secondary btn--circle btn--sm"
              data-asc-asset="${esc(asset.uuid)}"
              data-rendition-id="${esc(renditionId)}"
              aria-label="Download asset">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
    </div>`;
}

function getMasonryState(container) {
  if (masonryState.has(container)) return masonryState.get(container);
  const count = Math.min(8, Math.max(2, Math.floor((container.offsetWidth || window.innerWidth) / MASONRY_COL_WIDTH)));
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

function appendMasonryItems(container, assets) {
  const state = getMasonryState(container);
  assets.forEach((asset) => {
    const col = state.cols[state.next % state.cols.length];
    col.insertAdjacentHTML('beforeend',
      assetTeaser(asset, { mode: 'card', view: 'masonry' })
        .replace(/sizes="[^"]*"/, `sizes="${MASONRY_SIZES}"`));
    state.next += 1;
  });
}

function renderListRows(assets, cols, renditionId) {
  return assets.map((asset) => `
    <div class="asc-list-view__row"
         data-asc-asset="${esc(asset.uuid)}"
         data-asc-action="asset:details:open@click"
         role="row">
      ${cols.map((col) => `<div class="asc-list-view__cell" role="cell">${renderListCell(col, asset)}</div>`).join('')}
      <div class="asc-list-view__cell asc-list-view__cell--actions" role="cell">${renderListActionsCell(asset, renditionId)}</div>
    </div>`).join('');
}

function renderListView(assets, renditionId) {
  const cols = getListCols();
  const trackSizes = [...cols.map((c) => c.width || 'auto'), '136px'].join(' ');
  const headers = cols.map((col) => {
    const label = col.label ?? PROP_LABELS[col.property] ?? col.property ?? '';
    return `<div class="asc-list-view__cell asc-list-view__cell--header" role="columnheader">${label}</div>`;
  }).join('');

  return `
    <div class="asc-list-view" style="--asc-list-cols: ${trackSizes}" role="table">
      <div class="asc-list-view__header" role="row">${headers}<div class="asc-list-view__cell asc-list-view__cell--header asc-list-view__cell--actions-header" role="columnheader">Actions</div></div>
      <div class="asc-list-view__rows" role="rowgroup">
        ${renderListRows(assets, cols, renditionId)}
      </div>
    </div>`;
}

function getDisplayMode(block) {
  return block.querySelector('[name="asc.search-results.display"]')?.value || 'masonry';
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

function attachImageHandlers(resultsEl) {
  resultsEl.querySelectorAll('.asc-asset-teaser__preview img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) {
      img.closest('.asc-asset-teaser')?.classList.add('asc-asset-teaser--no-preview');
      return;
    }
    img.addEventListener('error', () => {
      img.closest('.asc-asset-teaser')?.classList.add('asc-asset-teaser--no-preview');
    }, { once: true });
  });
}

function injectQuickDownloadButtons(resultsEl, display, renditionId = 'original') {
  if (display === 'list') return;

  resultsEl.querySelectorAll('.asc-asset-teaser .asc-collection-toggle').forEach((toggle) => {
    if (toggle.querySelector('.search-results__quick-download')) return;
    const teaser = toggle.closest('.asc-asset-teaser');
    const assetId = teaser?.dataset?.ascAsset;
    if (!assetId) return;

    toggle.insertAdjacentHTML('beforeend', `
      <button type="button"
              class="search-results__quick-download btn btn--secondary btn--circle btn--sm"
              data-asc-asset="${esc(assetId)}"
              data-rendition-id="${esc(renditionId)}"
              aria-label="Download asset">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>`);
  });
}

function resolveDownloadRendition(asset, preferredId) {
  return services.renditions.getRendition(asset, preferredId)
    || services.renditions.getRendition(asset, 'original')
    || services.renditions.getRendition(asset, 'web')
    || null;
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

export default async function decorate(block) {
  const config = readBlockConfig(block, {}, {
    'asc.search-results.display': 'masonry',
    limit: 100,
  });

  // Support friendly 'Default View' content key (lowercased to 'default-view' by EDS)
  if (config['default-view']) config['asc.search-results.display'] = config['default-view'];

  block.innerHTML = html(config);

  // Sync data-display from the rendered select (which has the URL-resolved initial value)
  block.querySelector('[data-asc-results]').dataset.display = block.querySelector('[name="asc.search-results.display"]').value;

  await addEventListeners(block, config);
  await emitEvents(block, config);
}

function html(config) {
  const params = new URLSearchParams(window.location.search);
  const display = params.get('asc.search-results.display') || config['asc.search-results.display'] || 'masonry';
  const orderby = params.get('orderby') || '';
  const orderbySort = params.get('orderby.sort') || '';

  const sel = (val, match) => (val === match ? 'selected' : '');

  return `
    <div class="search-results__toolbar">
      <select name="asc.search-results.display" form="${SEARCH_FORM}" aria-label="View">
        <option value="cards" ${sel(display, 'cards')}>Cards</option>
        <option value="list" ${sel(display, 'list')}>List</option>
        <option value="masonry" ${sel(display, 'masonry')}>Masonry</option>
      </select>
      <select name="orderby" form="${SEARCH_FORM}" aria-label="Sort by">
        <option value="@jcr:score" ${sel(orderby, '@jcr:score')}>Relevance</option>
        <option value="@jcr:content/metadata/dc:created" ${sel(orderby, '@jcr:content/metadata/dc:created')}>Created Date</option>
        <option value="@jcr:content/metadata/dc:title" ${sel(orderby, '@jcr:content/metadata/dc:title')}>Title</option>
      </select>
      <select name="orderby.sort" form="${SEARCH_FORM}" aria-label="Order">
        <option value="desc" ${sel(orderbySort, 'desc')}>Descending</option>
        <option value="asc" ${sel(orderbySort, 'asc')}>Ascending</option>
      </select>
    </div>

    <input type="hidden" name="p.limit" value="${config.limit || 24}" form="${SEARCH_FORM}"/>
    <input type="hidden" name="p.offset" value="0" form="${SEARCH_FORM}"/>
    <input type="hidden" name="asc.search-results.more" value="true"/>
    <input type="hidden" name="asc.search-results.total" value="0"/>

    <div data-asc-results data-loading></div>
  `;
}

async function addEventListeners(block, _config) {
  const quickDownloadRendition = configurations.searchResults?.quickActions?.downloadRendition || 'original';

  block.querySelectorAll('[name="asc.search-results.display"], [name="orderby"], [name="orderby.sort"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.name === 'asc.search-results.display') {
        block.querySelector('[data-asc-results]').dataset.display = input.value;
      }
      document.dispatchEvent(new CustomEvent('asc:search:execute', {
        detail: { type: 'page-load' },
      }));
    });
  });

  let isLoadingMore = false;
  let sentinel = null;
  let observer = null;

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

      isLoadingMore = true;
      document.dispatchEvent(new CustomEvent('asc:search:execute', {
        detail: { type: 'load-more' },
      }));
    }, { rootMargin: '600px 0px' });

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

    // Derive next offset from the server-reported values so fresh searches
    // (offset=0) always reset correctly.
    const newOffset = (results.offset || 0) + (results.size || 0);
    block.querySelector('[name="p.offset"]').value = newOffset;

    const display = getDisplayMode(block);
    const resultsEl = block.querySelector('[data-asc-results]');
    resultsEl.dataset.display = display;
    // Drop the loading placeholder so the grid cell height is no longer constrained.
    delete resultsEl.dataset.loading;

    if (event.detail.type === 'load-more') {
      if (display === 'list') {
        resultsEl.querySelector('.asc-list-view__rows')
          ?.insertAdjacentHTML('beforeend', renderListRows(results.assets || [], getListCols(), quickDownloadRendition));
      } else if (display === 'masonry') {
        appendMasonryItems(resultsEl, results.assets || []);
      } else {
        resultsEl.insertAdjacentHTML('beforeend',
          results.assets?.map((asset) => assetTeaser(asset, { mode: 'card', view: display })).join('') || '');
      }
    } else if (results.size === 0) {
      resultsEl.innerHTML = `
        <div class="asc-ui-empty-state">
          <span class="asc-ui-empty-state__icon" aria-hidden="true">🔍</span>
          <p class="asc-ui-empty-state__title">No results found</p>
          <p class="asc-ui-empty-state__hint">Try adjusting your search terms or filters.</p>
        </div>`;
    } else if (display === 'list') {
      resultsEl.innerHTML = renderListView(results.assets, quickDownloadRendition);
    } else if (display === 'masonry') {
      resultsEl.innerHTML = '';
      masonryState.delete(resultsEl);
      appendMasonryItems(resultsEl, results.assets || []);
    } else {
      resultsEl.innerHTML = results.assets
        .map((asset) => assetTeaser(asset, { mode: 'card', view: display })).join('') || '';
    }

    if (event.detail.type !== 'load-more') {
      promoteAboveFoldImages(resultsEl);
    }

    attachImageHandlers(resultsEl);
    injectQuickDownloadButtons(resultsEl, display, quickDownloadRendition);
    isLoadingMore = false;
    setupSentinel();  // no-op after first call; observer handles subsequent loads

    // After a page-load search (filter change, new query), the IntersectionObserver
    // only fires on transitions. If the sentinel was already visible before the new
    // (potentially shorter) results rendered, no transition occurs and load-more
    // would never fire. Re-observe to force immediate re-evaluation.
    if (event.detail.type !== 'load-more' && sentinel && observer) {
      observer.unobserve(sentinel);
      observer.observe(sentinel);
    }
  });

  block.addEventListener('click', (event) => {
    if (event.target.closest('.asc-list-view__actions')) {
      event.stopPropagation();
    }

    const downloadBtn = event.target.closest('.search-results__quick-download');
    if (!downloadBtn) return;

    event.preventDefault();
    event.stopPropagation();

    const assetContainer = downloadBtn.closest('[data-asc-asset]');
    const assetId = downloadBtn.dataset.ascAsset || assetContainer?.dataset?.ascAsset;
    if (!assetId) return;

    const asset = window.asc?.cache?.assets?.get(assetId);
    if (!asset) return;

    const preferredId = downloadBtn.dataset.renditionId || quickDownloadRendition;
    const rendition = resolveDownloadRendition(asset, preferredId);
    triggerAssetDownload(rendition, asset);
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
