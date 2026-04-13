import { readBlockConfig } from '../../scripts/asc/utils/search.js';
import assetTeaser from '../../scripts/asc/parts/asset-teaser/asset-teaser.js';
import collectionToggle from '../../scripts/asc/parts/collection-toggle/collection-toggle.js';
import services from '../../scripts/asc/services/services.js';
import configurations from '../../scripts/configurations.js';

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
    return `<img class="asc-list-view__thumb" src="${esc(asset.thumbnail)}" alt="" loading="lazy">`;
  }
  return esc(valToText(asset.getProperty(property)));
}

function renderListActionsCell(asset, renditionId) {
  return `
    <div class="asc-list-view__actions">
      ${collectionToggle(asset, { addLabel: 'Add to collection', removeLabel: 'Remove from collection' })}
      <button type="button"
              class="search-results__quick-download btn btn--secondary btn--sm"
              data-asc-asset="${esc(asset.uuid)}"
              data-rendition-id="${esc(renditionId)}"
              aria-label="Download asset">
        ↓
      </button>
    </div>`;
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
              class="search-results__quick-download btn btn--secondary btn--sm"
              data-asc-asset="${esc(assetId)}"
              data-rendition-id="${esc(renditionId)}"
              aria-label="Download asset">
        ↓
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
      <select name="asc.search-results.display" form="${config.form}" aria-label="View">
        <option value="cards" ${sel(display, 'cards')}>Cards</option>
        <option value="list" ${sel(display, 'list')}>List</option>
        <option value="masonry" ${sel(display, 'masonry')}>Masonry</option>
      </select>
      <select name="orderby" form="${config.form}" aria-label="Sort by">
        <option value="@jcr:score" ${sel(orderby, '@jcr:score')}>Relevance</option>
        <option value="@jcr:content/metadata/dc:created" ${sel(orderby, '@jcr:content/metadata/dc:created')}>Created Date</option>
        <option value="@jcr:content/metadata/dc:title" ${sel(orderby, '@jcr:content/metadata/dc:title')}>Title</option>
      </select>
      <select name="orderby.sort" form="${config.form}" aria-label="Order">
        <option value="desc" ${sel(orderbySort, 'desc')}>Descending</option>
        <option value="asc" ${sel(orderbySort, 'asc')}>Ascending</option>
      </select>
    </div>

    <input type="hidden" name="p.limit" value="${config.limit || 24}" form="${config.form}"/>
    <input type="hidden" name="p.offset" value="0" form="${config.form}"/>
    <input type="hidden" name="asc.search-results.more" value="true"/>
    <input type="hidden" name="asc.search-results.total" value="0"/>

    <div data-asc-results>
      <!-- Inject point for results here based on asc.search-results.display -->
    </div>
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

  /* Display the results */
  document.addEventListener('asc:search:complete', async (event) => {
    const { results } = event.detail;

    if (!results) {
      console.warn('Search completed but no results data received');
      return;
    }

    block.querySelector('[name="asc.search-results.more"]').value = results.more;
    block.querySelector('[name="asc.search-results.total"]').value = results.total || 0;

    const newOffset = Number.parseInt(block.querySelector('[name="p.offset"]').value, 10) + (results.size || 0);
    block.querySelector('[name="p.offset"]').value = newOffset;

    const display = getDisplayMode(block);
    const resultsEl = block.querySelector('[data-asc-results]');
    resultsEl.dataset.display = display;

    if (event.detail.type === 'load-more') {
      if (display === 'list') {
        resultsEl.querySelector('.asc-list-view__rows')
          ?.insertAdjacentHTML('beforeend', renderListRows(results.assets || [], getListCols(), quickDownloadRendition));
      } else {
        resultsEl.insertAdjacentHTML('beforeend',
          results.assets?.map((asset) => assetTeaser(asset, { mode: 'card', view: display })).join('') || '');
      }
    } else if (results.size === 0) {
      resultsEl.innerHTML = '<h4>No results found.</h4>';
    } else if (display === 'list') {
      resultsEl.innerHTML = renderListView(results.assets, quickDownloadRendition);
    } else {
      resultsEl.innerHTML = results.assets
        .map((asset) => assetTeaser(asset, { mode: 'card', view: display })).join('') || '';
    }

    attachImageHandlers(resultsEl);
    injectQuickDownloadButtons(resultsEl, display, quickDownloadRendition);
    isLoadingMore = false;
    setTimeout(maybeLoadMore, 1);
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

  /* Infinite scroll */
  function maybeLoadMore() {
    const moreInput = block.querySelector('[name="asc.search-results.more"]');
    if (!moreInput || moreInput.value === 'false' || isLoadingMore) {
      return;
    }

    const resultsEl = block.querySelector('[data-asc-results]');
    if (!resultsEl || !resultsEl.lastElementChild) return;

    const lastResult = resultsEl.lastElementChild;
    const rect = lastResult.getBoundingClientRect();

    if (rect.top < window.innerHeight + 1080) {
      isLoadingMore = true;
      document.dispatchEvent(
        new CustomEvent('asc:search:execute', {
          detail: { type: 'load-more' },
        }),
      );
    }
  }

  document.addEventListener('scroll', maybeLoadMore, { passive: true });
  window.addEventListener('resize', maybeLoadMore);
}

// Initial search is triggered by search.js once all blocks are loaded (asc:blocks:loaded).
// No need to dispatch here — search.js owns page-load search initiation.
// eslint-disable-next-line no-unused-vars
async function emitEvents(_block, _config) {}
