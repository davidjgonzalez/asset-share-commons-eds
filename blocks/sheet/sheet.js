/** @owner user */
import services from '../../scripts/asc/services/services.js';
import { escHtml, escAttr } from '../../scripts/html.js';

/**
 * Sheet block — a download/rendition selection page.
 *
 * URL params:
 *   sheet      — compressed payload: { title, description?, expiresAt?, items[] }
 *   renditions — compressed array of rendition definition IDs (still supported)
 */
export default async function decorate(block) {
  const params = new URLSearchParams(window.location.search);
  const {
    mixedItems, assetMap, title, description, expiresAt, textElements,
  } = await getDataFromSearchParams(params);

  if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
    block.innerHTML = expiredHtml(expiresAt);
    return;
  }

  const assetCount = mixedItems.filter((i) => i.type === 'asset').length;
  block.innerHTML = html(mixedItems, assetMap, title, description, assetCount, textElements);
  initSheetBoard(block);
}

// ─── HTML ────────────────────────────────────────────────────────────────────

function expiredHtml(expiresAt) {
  const date = new Date(expiresAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return `
    <div class="sheet__expired">
      <p class="sheet__expired-title">This link has expired</p>
      <p class="sheet__expired-message">The link you followed expired on ${date}.</p>
    </div>`;
}

function html(mixedItems, assetMap, title, description, assetCount, textElements = []) {
  return `
    <a href="/" class="sheet__back">&#8592; Back to search</a>
    <div class="sheet__header">
      <div class="sheet__header-meta">
        <h1 class="sheet__title">${escHtml(title) || 'Download Sheet'}</h1>
        ${description ? `<p class="sheet__description">${escHtml(description)}</p>` : ''}
        <p class="sheet__count">${assetCount} asset${assetCount === 1 ? '' : 's'}</p>
      </div>
    </div>
    ${boardHtml(mixedItems, assetMap, textElements)}
  `;
}

const BOARD_CARD_W = 160;
const BOARD_CARD_H = 210;
const BOARD_GAP = 24;

function boardHtml(mixedItems, assetMap, textElements = []) {
  const assets = mixedItems.filter((item) => item.type === 'asset');
  const n = assets.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));

  const cards = assets.map((item, i) => {
    const asset = assetMap.get(item.id);
    if (!asset) return '';
    let x;
    let y;
    if (item.x != null && Number.isFinite(item.x) && item.y != null && Number.isFinite(item.y)) {
      ({ x, y } = item);
    } else {
      const col = i % cols;
      const row = Math.floor(i / cols);
      x = BOARD_GAP + col * (BOARD_CARD_W + BOARD_GAP);
      y = BOARD_GAP + row * (BOARD_CARD_H + BOARD_GAP);
    }
    return boardCard(asset, item.notes, x, y);
  }).join('');

  const textEls = textElements.map((t) => boardTextEl(t)).join('');
  const isEmpty = !n && !textElements.length;

  return `
    <div class="sheet__board-viewport">
      <div class="sheet__board-canvas">
        ${cards}
        ${textEls}
      </div>
      ${isEmpty ? '<p class="sheet__board-empty">No assets selected.</p>' : ''}
      <div class="asc-ui-segmented asc-ui-segmented--xl sheet__board-toolbar" role="toolbar" aria-label="Board tools">
        <button type="button" class="asc-ui-segmented__option sheet__board-fit">Fit view</button>
        <button type="button" class="asc-ui-segmented__option sheet__board-expand">Expand</button>
      </div>
    </div>
  `;
}

function boardTextEl(t) {
  return `<div class="sheet__board-text" style="left: ${t.x}px; top: ${t.y}px; width: ${t.w}px; min-height: ${t.h}px;">${escHtml(t.content || '')}</div>`;
}

function boardCard(asset, notes, x, y) {
  const thumbnailUrl = services.renditions.getThumbnailUrl(asset);

  return `
    <article class="asc-ui-asset-card sheet__board-card"
             data-asc-asset="${escAttr(asset.uuid)}"
             style="left: ${x}px; top: ${y}px;">
      <div class="asc-ui-asset-card__thumb">
        ${notes ? '<span class="asc-ui-asset-card__badge"><span class="sheet__board-note-dot" title="Has notes"></span></span>' : ''}
        <img src="${thumbnailUrl}" alt="${escHtml(asset.title)}" loading="lazy" draggable="false" />
      </div>
      <div class="asc-ui-asset-card__body">
        <p class="asc-ui-asset-card__title">${escHtml(asset.title)}</p>
        ${notes ? `<p class="sheet__board-card-note">${escHtml(notes)}</p>` : ''}
      </div>
    </article>`;
}

// ─── Board pan/zoom ───────────────────────────────────────────────────────────

function fitSheetBoard(block) {
  const viewport = block.querySelector('.sheet__board-viewport');
  const canvas = block.querySelector('.sheet__board-canvas');
  if (!viewport || !canvas) return;

  const cards = [...canvas.querySelectorAll('.sheet__board-card, .sheet__board-text')];
  if (!cards.length) return;

  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  cards.forEach((card) => {
    const x = parseFloat(card.style.left) || 0;
    const y = parseFloat(card.style.top) || 0;
    const isText = card.classList.contains('sheet__board-text');
    const w = card.offsetWidth || (isText ? 160 : BOARD_CARD_W);
    const h = card.offsetHeight || (isText ? 60 : BOARD_CARD_H);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  const PAD = 72; // 3 × --spacing-lg (4.5rem)
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  if (!contentW || !contentH || !vw || !vh) return;

  const zoom = Math.min(
    (vw - 2 * PAD) / contentW,
    (vh - 2 * PAD) / contentH,
    1.0,
  );
  const panX = (vw - contentW * zoom) / 2 - minX * zoom;
  const panY = PAD - minY * zoom;

  canvas.dataset.panX = panX;
  canvas.dataset.panY = panY;
  canvas.dataset.zoom = zoom;
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

function initSheetBoard(block) {
  const viewport = block.querySelector('.sheet__board-viewport');
  const canvas = block.querySelector('.sheet__board-canvas');
  if (!viewport || !canvas) return;

  function getState() {
    return {
      panX: parseFloat(canvas.dataset.panX) || 0,
      panY: parseFloat(canvas.dataset.panY) || 0,
      zoom: parseFloat(canvas.dataset.zoom) || 1,
    };
  }

  function applyTransform(panX, panY, zoom) {
    canvas.dataset.panX = panX;
    canvas.dataset.panY = panY;
    canvas.dataset.zoom = zoom;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    let { panX, panY, zoom } = getState();
    if (e.ctrlKey || e.metaKey) {
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.1), 4);
      panX = cx - (cx - panX) * (newZoom / zoom);
      panY = cy - (cy - panY) * (newZoom / zoom);
      zoom = newZoom;
    } else {
      panX -= e.deltaX;
      panY -= e.deltaY;
    }
    applyTransform(panX, panY, zoom);
  }, { passive: false });

  block.querySelector('.sheet__board-fit')?.addEventListener('click', () => {
    fitSheetBoard(block);
  });

  viewport.addEventListener('click', (e) => {
    const card = e.target.closest('.sheet__board-card');
    if (!card?.dataset.ascAsset) return;
    document.body.dispatchEvent(new CustomEvent('asc:asset:details:open', {
      bubbles: true,
      detail: { data: { ascAsset: card.dataset.ascAsset } },
    }));
  });

  // Restore expand state before the initial fit so viewport dimensions are correct
  if (localStorage.getItem('asc:sheetBoardExpanded') === 'true') {
    block.setAttribute('data-expanded', '');
    const expandBtn = block.querySelector('.sheet__board-expand');
    if (expandBtn) expandBtn.textContent = 'Collapse';
  }

  block.querySelector('.sheet__board-expand')?.addEventListener('click', () => {
    const isExpanded = block.hasAttribute('data-expanded');
    const expandBtn = block.querySelector('.sheet__board-expand');
    if (isExpanded) {
      block.removeAttribute('data-expanded');
      expandBtn.textContent = 'Expand';
      localStorage.setItem('asc:sheetBoardExpanded', 'false');
    } else {
      block.setAttribute('data-expanded', '');
      expandBtn.textContent = 'Collapse';
      localStorage.setItem('asc:sheetBoardExpanded', 'true');
    }
    requestAnimationFrame(() => fitSheetBoard(block));
  });

  // Double RAF: first frame applies CSS (expand state, viewport height), second measures layout
  requestAnimationFrame(() => requestAnimationFrame(() => fitSheetBoard(block)));
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function getDataFromSearchParams(queryParameters) {
  const sheetParam = queryParameters.get('sheet');
  if (!sheetParam) {
    return {
      mixedItems: [], assetMap: new Map(),
      title: '', description: '', expiresAt: null, textElements: [],
    };
  }

  const parts = await services.url.decompressToArray(sheetParam);
  const json = parts.join(',');
  const {
    title = '', description = '', expiresAt = null, items = [], textElements = [],
  } = JSON.parse(json);

  const mixedItems = items.map((entry) => {
    if (entry.startsWith('~')) {
      const sepIdx = entry.indexOf('|||', 1);
      return {
        type: 'section',
        title: sepIdx === -1 ? entry.slice(1) : entry.slice(1, sepIdx),
        body: sepIdx === -1 ? '' : entry.slice(sepIdx + 3),
      };
    }
    const sepIdx = entry.indexOf('|||');
    const base = sepIdx !== -1 ? entry.slice(0, sepIdx) : entry;
    const notes = sepIdx !== -1 ? entry.slice(sepIdx + 3) : undefined;
    const atIdx = base.indexOf('@');
    const id = atIdx !== -1 ? base.slice(0, atIdx) : base;
    const result = { type: 'asset', id };
    if (notes) result.notes = notes;
    if (atIdx !== -1) {
      const posStr = base.slice(atIdx + 1);
      const comma = posStr.indexOf(',');
      if (comma !== -1) {
        result.x = parseInt(posStr.slice(0, comma), 10);
        result.y = parseInt(posStr.slice(comma + 1), 10);
      }
    }
    return result;
  });

  const assetIds = mixedItems.filter((i) => i.type === 'asset').map((i) => i.id);
  const fetchedAssets = await Promise.all(assetIds.map((id) => services.search.getAssetById(id)));
  const assetMap = new Map(fetchedAssets.filter(Boolean).map((a) => [a.uuid, a]));

  return {
    mixedItems, assetMap, title, description, expiresAt, textElements,
  };
}
