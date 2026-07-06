/** @owner user */
import services from '../../scripts/asc/services/services.js';
import { escHtml, escAttr } from '../../scripts/html.js';

/**
 * Sheet block — a download/rendition selection page.
 *
 * URL params:
 *   sheet — compressed payload: { title, description?, expiresAt?, items[] }
 */
export default async function decorate(block) {
  const sheetParam = new URLSearchParams(window.location.search).get('sheet');

  const {
    title, description, expiresAt, items, textElements,
  } = await parseSheetMeta(sheetParam);

  if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
    block.innerHTML = expiredHtml(expiresAt);
    return;
  }

  const { mixedItems, assetMap } = await loadSheetItems(items);
  block.innerHTML = html(mixedItems, assetMap, title, description, textElements);
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

function html(mixedItems, assetMap, title, description, textElements = []) {
  const assetCount = mixedItems.filter((i) => i.type === 'asset').length;
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
const BOARD_TEXT_W = 160;
const BOARD_TEXT_H = 60;
const EXPAND_KEY = 'asc:sheetBoardExpanded';

function boardHtml(mixedItems, assetMap, textElements = []) {
  const assets = mixedItems.filter((item) => item.type === 'asset');
  const n = assets.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));

  const cards = assets.map((item, i) => {
    const asset = assetMap.get(item.id);
    if (!asset) return '';
    const hasPos = item.x != null && Number.isFinite(item.x) && item.y != null && Number.isFinite(item.y);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = hasPos ? item.x : BOARD_GAP + col * (BOARD_CARD_W + BOARD_GAP);
    const y = hasPos ? item.y : BOARD_GAP + row * (BOARD_CARD_H + BOARD_GAP);
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
      <div class="asc-ui-segmented asc-ui-segmented--lg sheet__board-toolbar" role="toolbar" aria-label="Board tools">
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
    const w = card.offsetWidth || (isText ? BOARD_TEXT_W : BOARD_CARD_W);
    const h = card.offsetHeight || (isText ? BOARD_TEXT_H : BOARD_CARD_H);
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

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    let panX = parseFloat(canvas.dataset.panX) || 0;
    let panY = parseFloat(canvas.dataset.panY) || 0;
    let zoom = parseFloat(canvas.dataset.zoom) || 1;
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
    canvas.dataset.panX = panX;
    canvas.dataset.panY = panY;
    canvas.dataset.zoom = zoom;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
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
  const expandBtn = block.querySelector('.sheet__board-expand');
  if (localStorage.getItem(EXPAND_KEY) === 'true') {
    block.setAttribute('data-expanded', '');
    if (expandBtn) expandBtn.textContent = 'Collapse';
  }

  expandBtn?.addEventListener('click', () => {
    const nowExpanded = !block.hasAttribute('data-expanded');
    block.toggleAttribute('data-expanded', nowExpanded);
    expandBtn.textContent = nowExpanded ? 'Collapse' : 'Expand';
    localStorage.setItem(EXPAND_KEY, String(nowExpanded));
    requestAnimationFrame(() => fitSheetBoard(block));
  });

  // Double RAF: first frame applies CSS (expand state, viewport height), second measures layout
  requestAnimationFrame(() => requestAnimationFrame(() => fitSheetBoard(block)));
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function parseSheetMeta(sheetParam) {
  if (!sheetParam) return { title: '', description: '', expiresAt: null, items: [], textElements: [] };
  const parts = await services.url.decompressToArray(sheetParam);
  const {
    title = '', description = '', expiresAt = null, items = [], textElements = [],
  } = JSON.parse(parts.join(','));
  return { title, description, expiresAt, items, textElements };
}

async function loadSheetItems(items) {
  const mixedItems = items.map(parseEntry);
  const assetIds = mixedItems.filter((i) => i.type === 'asset').map((i) => i.id);
  const fetchedAssets = await Promise.all(assetIds.map((id) => services.search.getAssetById(id)));
  const assetMap = new Map(fetchedAssets.filter(Boolean).map((a) => [a.uuid, a]));
  return { mixedItems, assetMap };
}

function parseSectionEntry(entry) {
  const sep = entry.indexOf('|||', 1);
  return {
    type: 'section',
    title: sep === -1 ? entry.slice(1) : entry.slice(1, sep),
    body: sep === -1 ? '' : entry.slice(sep + 3),
  };
}

function parseAssetEntry(entry) {
  const sep = entry.indexOf('|||');
  const base = sep !== -1 ? entry.slice(0, sep) : entry;
  const notes = sep !== -1 ? entry.slice(sep + 3) : undefined;
  const at = base.indexOf('@');
  const id = at !== -1 ? base.slice(0, at) : base;
  const item = { type: 'asset', id };
  if (notes) item.notes = notes;
  if (at !== -1) {
    const [xStr, yStr] = base.slice(at + 1).split(',');
    if (yStr !== undefined) {
      item.x = parseInt(xStr, 10);
      item.y = parseInt(yStr, 10);
    }
  }
  return item;
}

function parseEntry(entry) {
  return entry.startsWith('~') ? parseSectionEntry(entry) : parseAssetEntry(entry);
}
