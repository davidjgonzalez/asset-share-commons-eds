/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import { Events as CollectionEvents } from '../../scripts/asc/core/services/collections/collections.js';
import AssetAccessError from '../../scripts/asc/core/models/asset-access-error.js';
import { escHtml, escAttr } from '../../scripts/asc/html.js';
import defaultBoardItemHtml from '../../scripts/asc/board-item.js';
import { toggleRenditionMenu, prefetchRenditionSizes } from '../../scripts/asc/rendition-download-menu.js';

const configurations = (await import('../../scripts/asc/configurations.js')).default;

// Swap in a fully custom item renderer via configurations.board.itemRenderer — see
// scripts/asc/board-item.js (the default implementation) for the markup contract.
const boardItemHtml = configurations.board?.itemRenderer || defaultBoardItemHtml;

// ─── Module-level drag / selection state ─────────────────────────────────────

let _itemDragMoved = false;
let _rubberBandJustSelected = false;
let _openPanelState = null;
let _noteHoverTimer = null;
const _selectedItems = new Set();

// ─── localStorage key helpers ─────────────────────────────────────────────────

const BOARD_TEXT_KEY = (id) => `asc:boardText:${id}`;
const VIEWPORT_KEY = (id) => `asc:boardViewport:${id}`;

// ─── Config parsing ───────────────────────────────────────────────────────────

function parseConfig(block) {
  const config = {
    source: 'sheet',
    mode: 'view',
    notes: true,
    searchProperties: [],
    details: null,
    sheetUrl: null,
  };
  [...block.children].forEach((row) => {
    const [keyCell, valCell] = [...row.children];
    if (!keyCell || !valCell) return;
    const key = keyCell.textContent.trim().toLowerCase();
    const val = valCell.textContent.trim();
    if (key === 'source') config.source = val || 'sheet';
    else if (key === 'mode') config.mode = val || 'view';
    else if (key === 'notes') config.notes = val.toLowerCase() !== 'false';
    else if (key === 'search-properties') {
      config.searchProperties = val ? val.split(',').map((p) => p.trim()).filter(Boolean) : [];
    } else if (key === 'details') config.details = val || null;
    else if (key === 'sheet-url') config.sheetUrl = val || null;
  });
  return config;
}

// ─── Details path resolution ──────────────────────────────────────────────────

function matchesMime(pattern, mime) {
  if (pattern === '*/*') return true;
  if (pattern.endsWith('/*')) return mime.startsWith(pattern.slice(0, -2));
  return mime === pattern;
}

function resolveDetailsPath(detailsBase, mime) {
  const templates = configurations.assetDetails?.templates || {};
  for (const [pattern, tplPath] of Object.entries(templates)) {
    if (pattern === 'default') continue;
    if (matchesMime(pattern, mime)) {
      const parts = tplPath.replace(/^\//, '').split('/');
      const relative = parts.slice(1).join('/');
      return relative ? `${detailsBase}/${relative}` : detailsBase;
    }
  }
  const defaultPath = templates.default;
  if (defaultPath) {
    const parts = defaultPath.replace(/^\//, '').split('/');
    const relative = parts.slice(1).join('/');
    return relative ? `${detailsBase}/${relative}` : detailsBase;
  }
  return detailsBase;
}

function openDetails(uuid, asset, config) {
  if (config.details) {
    const mime = asset?.getProperty('mime-type')?.data || '';
    const path = resolveDetailsPath(config.details, mime);
    window.location.href = `${path}?asset=${encodeURIComponent(uuid)}`;
  } else {
    document.body.dispatchEvent(new CustomEvent('asc:asset:details:open', {
      bubbles: true,
      detail: { data: { ascAsset: uuid } },
    }));
  }
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function getBoardTextItems(id) {
  try {
    return JSON.parse(localStorage.getItem(BOARD_TEXT_KEY(id))) || [];
  } catch {
    return [];
  }
}

function setBoardTextItems(id, items) {
  localStorage.setItem(BOARD_TEXT_KEY(id), JSON.stringify(items));
}

function saveTextItem(id, el) {
  const { textId } = el.dataset;
  if (!textId) return;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (!w || !h) return;
  const items = getBoardTextItems(id);
  const item = items.find((t) => t.id === textId);
  if (!item) return;
  item.x = Math.round(parseFloat(el.style.left) || 0);
  item.y = Math.round(parseFloat(el.style.top) || 0);
  item.w = w;
  item.h = h;
  item.content = el.querySelector('.board__text-content')?.innerText?.trim() || '';
  setBoardTextItems(id, items);
}

function getViewport(id) {
  try {
    return JSON.parse(localStorage.getItem(VIEWPORT_KEY(id)));
  } catch {
    return null;
  }
}

function setViewport(id, state) {
  localStorage.setItem(VIEWPORT_KEY(id), JSON.stringify(state));
}

/**
 * Stable signature for "which items are currently on the board" (membership only, not
 * position) — lets a persisted *automatic* fit be trusted on a later load only if the
 * board's contents haven't changed since, and safely discarded (recomputed fresh) if they
 * have. A *manual* pan/zoom/centerOn is saved without a signature and is always trusted
 * regardless of content changes — the user chose that view deliberately.
 */
function contentSignature(items) {
  return items
    .map((el) => el.dataset.ascAsset || el.dataset.textId || '')
    .sort()
    .join(',');
}

// ─── HTML renderers ───────────────────────────────────────────────────────────

function expiredHtml(expiresAt) {
  const date = new Date(expiresAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return `
    <div class="board__expired">
      <p class="board__expired-title">This link has expired</p>
      <p class="board__expired-message">The link you followed expired on ${escHtml(date)}.</p>
    </div>`;
}

function textElementHtml(t, interactive) {
  return `
    <div class="board__text-element${interactive ? '' : ' board__text-element--readonly'}"
         style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px"
         data-text-id="${escAttr(t.id)}">
      ${interactive ? `
      <button type="button"
              class="btn btn--ghost btn--icon btn--sm board__text-remove"
              data-text-id="${escAttr(t.id)}"
              aria-label="Remove text element">&#x2715;</button>` : ''}
      <div class="board__text-content" contenteditable="false">${escHtml(t.content)}</div>
    </div>`;
}

function viewportHtml(assetItems, textItems, config) {
  const interactive = config.mode === 'interactive';
  const cards = assetItems.map((item, i) => boardItemHtml(item, i, config)).join('');
  const texts = textItems.map((t) => textElementHtml(t, interactive)).join('');

  return `
    <div class="board__viewport">
      <div class="board__canvas">
        ${cards}
        ${texts}
      </div>
      <div class="board__controls">
        <div class="asc-ui-segmented board__toolbar" role="toolbar" aria-label="Board tools">
          <button type="button" class="asc-ui-segmented__option board__fit">Fit view</button>
          ${interactive ? `
          <button type="button" class="asc-ui-segmented__option board__align-grid">Align to grid</button>
          <button type="button" class="asc-ui-segmented__option board__add-text">+ Text</button>` : ''}
          ${config.searchProperties.length ? `<input type="search" class="board__search" placeholder="Search…" aria-label="Search assets">` : ''}
        </div>
      </div>
      <div class="board__minimap asc-panel asc-panel--no-pad" hidden aria-hidden="true">
        <div class="board__minimap-inner">
          <div class="board__minimap-viewport"></div>
        </div>
      </div>
    </div>`;
}

// ─── Data loading ─────────────────────────────────────────────────────────────

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

async function loadFromCollection(id) {
  const collection = await services.collections.get(id, true);
  if (!collection) return null;
  // Keep forbidden items too — the recipient of a shared collection may lack access to
  // some of the assets in it; those render as a locked placeholder (see board-item.js)
  // instead of silently disappearing.
  const assetItems = (collection.hydratedItems || [])
    .filter((i) => i.type === 'asset' && (i.asset || i.forbidden));
  const textItems = getBoardTextItems(id);
  return { collection, assetItems, textItems };
}

async function loadFromSheet(sheetParam) {
  if (!sheetParam) {
    return {
      meta: { title: '', description: '', expiresAt: null },
      assetItems: [],
      textItems: [],
    };
  }
  let payload;
  try {
    const parts = await services.url.decompressToArray(sheetParam);
    if (!parts) throw new Error('decompression failed');
    payload = JSON.parse(parts.join(','));
  } catch (err) {
    console.warn('[ASC] Failed to decode sheet URL — treating as invalid:', err);
    return { meta: { invalid: true, title: '', description: '', expiresAt: null }, assetItems: [], textItems: [] };
  }

  const {
    title = '', description = '', expiresAt = null, items = [], textElements = [],
  } = payload;

  const mixedItems = items.map(parseEntry);
  const assetIds = mixedItems.filter((i) => i.type === 'asset').map((i) => i.id);
  const fetchedAssets = await Promise.all(assetIds.map((id) => services.search.getAssetById(id)));
  // Keyed by the requested id, not the resolved asset's uuid — same reasoning as
  // collections.js _hydrateAssets: a forbidden/missing lookup has no uuid of its own.
  const resultMap = new Map(assetIds.map((id, i) => [id, fetchedAssets[i]]));

  const assetItems = mixedItems
    .filter((i) => i.type === 'asset')
    .map((i) => {
      const result = resultMap.get(i.id);
      const forbidden = result instanceof AssetAccessError;
      return { ...i, asset: forbidden ? null : result, forbidden };
    })
    .filter((i) => i.asset || i.forbidden);

  return {
    meta: { title, description, expiresAt },
    assetItems,
    textItems: textElements,
  };
}

function sheetParamFromUrl(sheetUrl) {
  if (!sheetUrl) return null;
  try {
    return new URL(sheetUrl, window.location.origin).searchParams.get('sheet');
  } catch {
    return null;
  }
}

// ─── Selection helpers ────────────────────────────────────────────────────────

function selectItem(el) {
  el.classList.add('board__item--selected');
  _selectedItems.add(el);
}

function deselectItem(el) {
  el.classList.remove('board__item--selected');
  _selectedItems.delete(el);
}

function deselectAll() {
  _selectedItems.forEach((el) => el.classList.remove('board__item--selected'));
  _selectedItems.clear();
}

function toggleItem(el) {
  if (_selectedItems.has(el)) deselectItem(el);
  else selectItem(el);
}

// ─── Fit-view computation ─────────────────────────────────────────────────────

function computeFitViewport(cards, viewport) {
  if (!cards.length) return { panX: 0, panY: 0, zoom: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  cards.forEach((card) => {
    const x = parseFloat(card.style.left) || 0;
    const y = parseFloat(card.style.top) || 0;
    const w = card.offsetWidth || 240;
    const h = card.offsetHeight || 180;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  const PAD = 72;
  const PAD_TOP = 112; // extra clearance under the floating toolbar so cards aren't tucked under it
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  if (!contentW || !contentH || !vw || !vh) return { panX: 0, panY: 0, zoom: 1 };
  const zoom = Math.min(
    (vw - 2 * PAD) / contentW,
    (vh - PAD_TOP - PAD) / contentH,
    1.0,
  );
  const panX = (vw - contentW * zoom) / 2 - minX * zoom;
  const panY = PAD_TOP - minY * zoom;
  return { panX, panY, zoom };
}

// ─── Notes panel ──────────────────────────────────────────────────────────────

const PANEL_SIDE_ORDER = ['bottom', 'right', 'top', 'left'];
const PANEL_TAIL_SIZE = 12;

/**
 * Position the notes panel relative to the item's card, not the notes button. Sides are
 * tried in order of preference — bottom, right, top, left — and the first one the panel
 * actually fits in wins; if none fit, whichever has the most free space is used instead.
 * The panel is then centered along that side and a CSS tail (::after, driven by
 * data-side + --tail-pos) points back at the card's center, clamped to stay on the panel.
 */
function positionPanel(panel, card, viewport) {
  const cardRect = card.getBoundingClientRect();
  const vRect = viewport.getBoundingClientRect();
  const pw = panel.offsetWidth || 220;
  const ph = panel.offsetHeight || 160;
  const gap = 10;
  const margin = 4;

  const cardLeft = cardRect.left - vRect.left;
  const cardTop = cardRect.top - vRect.top;
  const cardRight = cardRect.right - vRect.left;
  const cardBottom = cardRect.bottom - vRect.top;
  const cardCenterX = cardLeft + cardRect.width / 2;
  const cardCenterY = cardTop + cardRect.height / 2;

  const space = {
    bottom: vRect.height - cardBottom,
    right: vRect.width - cardRight,
    top: cardTop,
    left: cardLeft,
  };
  const needed = {
    top: ph + gap, bottom: ph + gap, left: pw + gap, right: pw + gap,
  };

  const side = PANEL_SIDE_ORDER.find((s) => space[s] >= needed[s])
    ?? PANEL_SIDE_ORDER.slice().sort((a, b) => space[b] - space[a])[0];

  let left;
  let top;
  if (side === 'top' || side === 'bottom') {
    left = cardCenterX - pw / 2;
    top = side === 'top' ? cardTop - ph - gap : cardBottom + gap;
  } else {
    top = cardCenterY - ph / 2;
    left = side === 'left' ? cardLeft - pw - gap : cardRight + gap;
  }

  const clampedLeft = Math.max(margin, Math.min(left, vRect.width - pw - margin));
  const clampedTop = Math.max(margin, Math.min(top, vRect.height - ph - margin));

  panel.style.left = `${clampedLeft}px`;
  panel.style.top = `${clampedTop}px`;
  panel.dataset.side = side;

  const tailPos = side === 'top' || side === 'bottom'
    ? Math.max(PANEL_TAIL_SIZE, Math.min(cardCenterX - clampedLeft, pw - PANEL_TAIL_SIZE))
    : Math.max(PANEL_TAIL_SIZE, Math.min(cardCenterY - clampedTop, ph - PANEL_TAIL_SIZE));
  panel.style.setProperty('--tail-pos', `${tailPos}px`);
}

function repositionOpenPanel() {
  if (!_openPanelState) return;
  const { panel, card, viewport } = _openPanelState;
  if (!document.contains(panel)) { _openPanelState = null; return; }
  positionPanel(panel, card, viewport);
}

function openNotePanel(block, card, className, innerHtml, mode) {
  block.querySelector('.board__notes-panel')?.remove();
  _openPanelState = null;
  const panel = document.createElement('div');
  panel.className = className;
  panel.innerHTML = innerHtml;
  const viewport = block.querySelector('.board__viewport');
  viewport.appendChild(panel);
  positionPanel(panel, card, viewport);
  _openPanelState = {
    panel, card, viewport, mode,
  };
  return { panel, viewport };
}

function openNotePreview(block, card) {
  const notes = card.dataset.ascNotes || '';
  if (!notes) return;

  const { panel } = openNotePanel(
    block, card,
    'asc-panel board__notes-panel board__notes-panel--preview',
    `<p class="board__notes-preview-text">${escHtml(notes)}</p>`,
    'preview',
  );

  panel.addEventListener('mouseenter', () => clearTimeout(_noteHoverTimer));
  panel.addEventListener('mouseleave', () => {
    const state = _openPanelState;
    if (state?.mode === 'preview') {
      _noteHoverTimer = setTimeout(() => {
        if (_openPanelState === state) {
          state.panel.remove();
          _openPanelState = null;
        }
      }, 150);
    }
  });
}

function openNoteEdit(block, collectionId, card) {
  const assetId = card.dataset.ascAsset;
  const currentNotes = card.dataset.ascNotes || '';

  const { panel } = openNotePanel(
    block, card,
    'asc-panel board__notes-panel',
    `<div class="asc-ui-field">
      <textarea class="board__notes-textarea"
                placeholder="Add a note about this asset…"
                rows="4">${escHtml(currentNotes)}</textarea>
    </div>
    <div class="board__notes-actions">
      <button type="button" class="board__notes-done btn btn--secondary btn--sm">Done</button>
    </div>`,
    'edit',
  );

  const textarea = panel.querySelector('.board__notes-textarea');
  textarea.focus();

  let removeOutsideClick = () => {};

  function saveAndClose() {
    const notes = textarea.value.trim();
    services.collections.updateItem(collectionId, assetId, { notes });
    updateItemNotes(card, notes);
    removeOutsideClick();
    panel.remove();
    _openPanelState = null;
  }

  panel.querySelector('.board__notes-done').addEventListener('click', saveAndClose);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { textarea.value = currentNotes; saveAndClose(); }
  });

  setTimeout(() => {
    function onOutsideClick(e) {
      if (!panel.contains(e.target) && !card.contains(e.target)) {
        saveAndClose();
      }
    }
    document.addEventListener('click', onOutsideClick);
    removeOutsideClick = () => document.removeEventListener('click', onOutsideClick);
  }, 0);
}

function updateItemNotes(card, notes) {
  card.classList.toggle('board__item--has-note', !!notes);
  card.dataset.ascNotes = notes || '';
}

// ─── Pan/zoom engine ──────────────────────────────────────────────────────────

function initPanZoom(block, persistId, onChange) {
  const viewport = block.querySelector('.board__viewport');
  const canvas = block.querySelector('.board__canvas');
  if (!viewport || !canvas) {
    return {
      getState: () => ({ panX: 0, panY: 0, zoom: 1 }),
      applyFit() {},
      fitView() {},
      centerOn() {},
      hasValidSavedViewport: false,
    };
  }

  const currentItems = () => [...canvas.querySelectorAll('.board__item, .board__text-element')];

  const savedRaw = persistId ? getViewport(persistId) : null;
  const hasValidSavedViewport = !!savedRaw
    && (savedRaw.sig == null || savedRaw.sig === contentSignature(currentItems()));
  let { panX, panY, zoom } = hasValidSavedViewport ? savedRaw : { panX: 0, panY: 0, zoom: 1 };

  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 3.0;

  let panning = false;
  let lastX = 0;
  let lastY = 0;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 1) return;
    panning = true;
    lastX = e.clientX;
    lastY = e.clientY;
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('board__viewport--panning');
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!panning) return;
    panX += e.clientX - lastX;
    panY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    repositionOpenPanel();
    onChange?.();
  });

  function endPan(save) {
    if (!panning) return;
    panning = false;
    viewport.classList.remove('board__viewport--panning');
    if (save && persistId) setViewport(persistId, { panX, panY, zoom });
  }

  viewport.addEventListener('pointerup', () => endPan(true));
  viewport.addEventListener('pointercancel', () => endPan(false));

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = viewport.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
      panX = cursorX - (cursorX - panX) * (newZoom / zoom);
      panY = cursorY - (cursorY - panY) * (newZoom / zoom);
      zoom = newZoom;
    } else {
      panX -= e.deltaX;
      panY -= e.deltaY;
    }
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    if (persistId) setViewport(persistId, { panX, panY, zoom });
    repositionOpenPanel();
    onChange?.();
  }, { passive: false });

  // `persist` defaults to true for deliberate user actions (manual pan/wheel already persist
  // directly above, with no signature — always trusted; this covers applyFit()/fitView()
  // callers like the "Fit view" button and Align-to-grid). The live-search narrowed-to-matches
  // fit must always pass persist=false — it's a temporary view of a subset, never the user's
  // chosen viewport. Every other persisted fit is tagged with a content signature, so a later
  // load only restores it if the board's contents haven't changed since (otherwise it recomputes
  // fresh) — this is what caused boards to load "not fitting": a stale fit for a smaller/older
  // set of cards was being trusted verbatim regardless of what's actually on the board now.
  function applyFit(fit, persist = true) {
    ({ panX, panY, zoom } = fit);
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    if (persist && persistId) setViewport(persistId, { ...fit, sig: contentSignature(currentItems()) });
    repositionOpenPanel();
    onChange?.();
  }

  function fitView(persist = true) {
    const allCards = [...canvas.querySelectorAll('.board__item, .board__text-element')];
    applyFit(computeFitViewport(allCards, viewport), persist);
  }

  function centerOn(x, y) {
    panX = viewport.clientWidth / 2 - x * zoom;
    panY = viewport.clientHeight / 2 - y * zoom;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    if (persistId) setViewport(persistId, { panX, panY, zoom });
    repositionOpenPanel();
    onChange?.();
  }

  return {
    getState: () => ({ panX, panY, zoom }),
    applyFit,
    fitView,
    centerOn,
    hasValidSavedViewport,
  };
}

// ─── Search filter ────────────────────────────────────────────────────────────

function initSearch(block, panZoom) {
  const input = block.querySelector('.board__search');
  if (!input) return;
  const viewport = block.querySelector('.board__viewport');
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) {
      viewport.removeAttribute('data-board-searching');
      block.querySelectorAll('.board__item, .board__text-element').forEach((card) => card.classList.remove('board__item--match'));
      panZoom.fitView(false);
      return;
    }
    viewport.setAttribute('data-board-searching', '');
    const matches = [];
    block.querySelectorAll('.board__item, .board__text-element').forEach((card) => {
      const haystack = card.classList.contains('board__text-element')
        ? (card.querySelector('.board__text-content')?.textContent || '').toLowerCase()
        : [card.dataset.filter, card.dataset.ascNotes].filter(Boolean).join(' ').toLowerCase();
      const hit = haystack.includes(q);
      card.classList.toggle('board__item--match', hit);
      if (hit) matches.push(card);
    });
    // Never persist a search-narrowed fit — it's a temporary view, not the user's chosen viewport.
    if (matches.length) panZoom.applyFit(computeFitViewport(matches, viewport), false);
  });
}

// ─── Rubber-band selection ────────────────────────────────────────────────────

function initRubberBand(block, panZoom) {
  const viewport = block.querySelector('.board__viewport');
  const canvas = block.querySelector('.board__canvas');
  if (!viewport || !canvas) return;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button === 1) return;
    if (e.target.closest('.board__item, .board__text-element')) return;
    if (e.target.closest('.board__notes-panel, .board__toolbar, .board__controls')) return;

    const viewportRect = viewport.getBoundingClientRect();
    const startX = e.clientX - viewportRect.left;
    const startY = e.clientY - viewportRect.top;
    let endX = startX;
    let endY = startY;

    const selRect = document.createElement('div');
    selRect.className = 'board__selection-rect';
    viewport.appendChild(selRect);

    const rbMove = (ev) => {
      endX = ev.clientX - viewportRect.left;
      endY = ev.clientY - viewportRect.top;
      selRect.style.left = `${Math.min(startX, endX)}px`;
      selRect.style.top = `${Math.min(startY, endY)}px`;
      selRect.style.width = `${Math.abs(endX - startX)}px`;
      selRect.style.height = `${Math.abs(endY - startY)}px`;
    };

    const rbUp = () => {
      document.removeEventListener('pointermove', rbMove);
      document.removeEventListener('pointerup', rbUp);
      selRect.remove();

      const rbW = Math.abs(endX - startX);
      const rbH = Math.abs(endY - startY);
      if (rbW < 4 && rbH < 4) { deselectAll(); return; }

      const rbLeft = Math.min(startX, endX);
      const rbTop = Math.min(startY, endY);
      const rbRight = rbLeft + rbW;
      const rbBottom = rbTop + rbH;
      const { panX, panY, zoom } = panZoom.getState();

      deselectAll();
      canvas.querySelectorAll('.board__item, .board__text-element').forEach((item) => {
        const cx = parseFloat(item.style.left) || 0;
        const cy = parseFloat(item.style.top) || 0;
        const itemVpLeft = cx * zoom + panX;
        const itemVpTop = cy * zoom + panY;
        const itemVpRight = itemVpLeft + item.offsetWidth * zoom;
        const itemVpBottom = itemVpTop + item.offsetHeight * zoom;
        if (itemVpRight > rbLeft && itemVpLeft < rbRight
          && itemVpBottom > rbTop && itemVpTop < rbBottom) {
          selectItem(item);
        }
      });
      if (_selectedItems.size > 0) _rubberBandJustSelected = true;
    };

    document.addEventListener('pointermove', rbMove);
    document.addEventListener('pointerup', rbUp);
  });
}

// ─── Card drag ────────────────────────────────────────────────────────────────

function initItemDrag(block, collectionId, panZoom) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.board__item');
    if (!card) return;
    if (e.target.closest('.board__item-remove, .board__notes-btn, .board__rendition-action')) return;

    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    _itemDragMoved = false;

    const { zoom } = panZoom.getState();

    const isInGroup = _selectedItems.has(card) && _selectedItems.size > 1;
    const dragGroup = isInGroup ? [..._selectedItems] : [card];

    const zVal = Date.now();
    dragGroup.forEach((c) => { c.style.zIndex = zVal; });

    const startPositions = dragGroup.map((c) => ({
      el: c,
      left: parseFloat(c.style.left) || 0,
      top: parseFloat(c.style.top) || 0,
    }));

    card.setPointerCapture(e.pointerId);
    dragGroup.forEach((c) => c.classList.add('board__item--dragging'));

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) _itemDragMoved = true;
      if (!_itemDragMoved) return;
      startPositions.forEach(({ el, left, top }) => {
        el.style.left = `${left + dx / zoom}px`;
        el.style.top = `${top + dy / zoom}px`;
      });
      if (_openPanelState && dragGroup.includes(_openPanelState.card)) repositionOpenPanel();
    }

    function onUp() {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onUp);
      dragGroup.forEach((c) => c.classList.remove('board__item--dragging'));
      if (_itemDragMoved) {
        startPositions.forEach(({ el }) => {
          if (el.dataset.ascAsset) {
            const x = Math.round(parseFloat(el.style.left));
            const y = Math.round(parseFloat(el.style.top));
            services.collections.updateItem(collectionId, el.dataset.ascAsset, { x, y });
          }
        });
      }
    }

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
  });
}

// ─── Notes hover preview (shared by interactive and view-only boards) ─────────

// Hovering anywhere on an item with a note shows the preview — the notes button itself
// is only for opening the add/edit panel (click), not for triggering the hover preview.
function initNotesHover(block) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.board__item');
    if (!card) return;
    clearTimeout(_noteHoverTimer);
    if (!card.classList.contains('board__item--has-note')) return;
    if (_openPanelState?.mode === 'edit') return;
    if (_openPanelState?.card === card) return;
    openNotePreview(block, card);
  });

  viewport.addEventListener('mouseout', (e) => {
    const card = e.target.closest('.board__item');
    if (!card) return;
    if (e.relatedTarget?.closest('.board__item') === card) return;
    if (e.relatedTarget?.closest('.board__notes-panel')) return;
    const state = _openPanelState;
    if (state?.mode === 'preview') {
      _noteHoverTimer = setTimeout(() => {
        if (_openPanelState === state) {
          state.panel.remove();
          _openPanelState = null;
        }
      }, 150);
    }
  });
}

// ─── Board click routing (interactive mode) ───────────────────────────────────

function initBoardClicks(block, collectionId, config) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('click', (e) => {
    if (e.target.closest('.board__rendition-action')) return;
    if (!e.target.closest('.board__item, .board__notes-panel, .board__toolbar, .board__controls, .board__text-element')) {
      if (_rubberBandJustSelected) { _rubberBandJustSelected = false; return; }
      deselectAll();
    }

    const removeBtn = e.target.closest('.board__item-remove');
    if (removeBtn) {
      services.collections.removeAsset(removeBtn.dataset.ascAsset, collectionId);
      return;
    }

    const notesBtn = e.target.closest('.board__notes-btn');
    if (notesBtn) {
      const card = notesBtn.closest('.board__item');
      if (card) {
        clearTimeout(_noteHoverTimer);
        if (_openPanelState?.mode === 'preview') {
          _openPanelState.panel.remove();
          _openPanelState = null;
        }
        openNoteEdit(block, collectionId, card);
      }
      return;
    }

    const card = e.target.closest('.board__item');
    if (card) {
      if (!_itemDragMoved) {
        if (e.shiftKey) {
          toggleItem(card);
        } else if (card.classList.contains('board__item--locked')) {
          // No asset data to show a details modal for — just select it, same as
          // any item with no data-asc-asset at all.
          deselectAll();
          selectItem(card);
        } else if (card.dataset.ascAsset) {
          openDetails(card.dataset.ascAsset, null, config);
        } else {
          deselectAll();
          selectItem(card);
        }
      }
      _itemDragMoved = false;
    }
  });

  initNotesHover(block);
}

// ─── Align to grid ────────────────────────────────────────────────────────────

function initAlignGrid(block, collectionId, panZoom) {
  const canvas = block.querySelector('.board__canvas');
  const viewport = block.querySelector('.board__viewport');

  block.querySelector('.board__align-grid')?.addEventListener('click', () => {
    const allItems = [...canvas.querySelectorAll('.board__item, .board__text-element')];
    if (!allItems.length) return;

    const SNAP = 24;
    const MIN_GAP = 16;

    const layout = allItems.map((el) => ({
      el,
      x: Math.round((parseFloat(el.style.left) || 0) / SNAP) * SNAP,
      y: Math.round((parseFloat(el.style.top) || 0) / SNAP) * SNAP,
      w: el.offsetWidth || 240,
      h: el.offsetHeight || 180,
    }));

    for (let pass = 0; pass < layout.length; pass++) {
      let changed = false;
      layout.sort((a, b) => (Math.abs(a.y - b.y) > 2 ? a.y - b.y : a.x - b.x));
      for (let i = 0; i < layout.length; i++) {
        for (let j = i + 1; j < layout.length; j++) {
          const a = layout[i];
          const b = layout[j];
          if (a.x < b.x + b.w + MIN_GAP && a.x + a.w + MIN_GAP > b.x
              && a.y < b.y + b.h + MIN_GAP && a.y + a.h + MIN_GAP > b.y) {
            const pushRight = Math.ceil((a.x + a.w + MIN_GAP) / SNAP) * SNAP;
            const pushDown = Math.ceil((a.y + a.h + MIN_GAP) / SNAP) * SNAP;
            if (Math.abs(pushRight - b.x) <= Math.abs(pushDown - b.y)) {
              b.x = pushRight;
            } else {
              b.y = pushDown;
            }
            changed = true;
          }
        }
      }
      if (!changed) break;
    }

    allItems.forEach((el) => { el.style.transition = 'left 0.2s ease, top 0.2s ease'; });
    layout.forEach(({ el, x, y }) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    });

    setTimeout(() => {
      allItems.forEach((el) => { el.style.transition = ''; });
      layout.forEach(({ el, x, y }) => {
        if (el.dataset.ascAsset) {
          services.collections.updateItem(collectionId, el.dataset.ascAsset, { x, y });
        } else if (el.dataset.textId) {
          saveTextItem(collectionId, el);
        }
      });
      const allCards = [...canvas.querySelectorAll('.board__item, .board__text-element')];
      panZoom.applyFit(computeFitViewport(allCards, viewport));
      repositionOpenPanel();
    }, 230);
  });
}

// ─── Text elements ────────────────────────────────────────────────────────────

function initTextElement(el, storeId) {
  const content = el.querySelector('.board__text-content');
  const { textId } = el.dataset;

  const ro = new ResizeObserver(() => saveTextItem(storeId, el));
  ro.observe(el);

  const enterEditMode = () => {
    content.contentEditable = 'true';
    el.dataset.editing = 'true';
    content.focus();
    const range = document.createRange();
    range.selectNodeContents(content);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  el.addEventListener('dblclick', (ev) => { ev.stopPropagation(); enterEditMode(); });

  content.addEventListener('blur', () => {
    content.contentEditable = 'false';
    delete el.dataset.editing;
    saveTextItem(storeId, el);
  });

  content.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); content.blur(); }
  });

  el.querySelector('.board__text-remove')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const items = getBoardTextItems(storeId).filter((t) => t.id !== textId);
    setBoardTextItems(storeId, items);
    deselectItem(el);
    ro.disconnect();
    el.remove();
  });

  el.addEventListener('pointerdown', (ev) => {
    if (el.dataset.editing) return;
    if (ev.target.closest('.board__text-remove')) return;
    const elRect = el.getBoundingClientRect();
    if (ev.clientX > elRect.right - 16 && ev.clientY > elRect.bottom - 16) return;
    ev.stopPropagation();

    const startX = ev.clientX;
    const startY = ev.clientY;
    let moved = false;

    const isInGroup = _selectedItems.has(el) && _selectedItems.size > 1;
    const dragGroup = isInGroup ? [..._selectedItems] : [el];
    const startPositions = dragGroup.map((item) => ({
      item,
      left: parseFloat(item.style.left) || 0,
      top: parseFloat(item.style.top) || 0,
    }));

    el.setPointerCapture(ev.pointerId);
    dragGroup.forEach((item) => item.classList.add('board__item--dragging'));

    function onMove(mev) {
      const dx = mev.clientX - startX;
      const dy = mev.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
      if (!moved) return;

      // Read zoom from canvas transform so text-element drag stays in sync with pan/zoom engine.
      const canvas = el.closest('.board__canvas');
      const match = canvas?.style.transform?.match(/scale\(([^)]+)\)/);
      const zoom = match ? parseFloat(match[1]) : 1;

      startPositions.forEach(({ item, left, top }) => {
        item.style.left = `${left + dx / zoom}px`;
        item.style.top = `${top + dy / zoom}px`;
      });
    }

    function onUp(uev) {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      dragGroup.forEach((item) => item.classList.remove('board__item--dragging'));

      if (moved) {
        startPositions.forEach(({ item }) => {
          if (item.dataset.textId) saveTextItem(storeId, item);
          if (item.dataset.ascAsset) {
            const x = Math.round(parseFloat(item.style.left));
            const y = Math.round(parseFloat(item.style.top));
            services.collections.updateItem(storeId, item.dataset.ascAsset, { x, y });
          }
        });
      } else if (!uev.target.closest('.board__text-remove')) {
        if (uev.shiftKey) toggleItem(el);
        else { deselectAll(); selectItem(el); }
      }
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });
}

function initTextElements(block, storeId) {
  const canvas = block.querySelector('.board__canvas');
  if (!canvas) return;
  canvas.querySelectorAll('.board__text-element').forEach((el) => {
    initTextElement(el, storeId);
  });
}

function initAddText(block, storeId, panZoom) {
  block.querySelector('.board__add-text')?.addEventListener('click', () => {
    const viewport = block.querySelector('.board__viewport');
    const canvas = block.querySelector('.board__canvas');
    if (!viewport || !canvas) return;

    const { panX, panY, zoom } = panZoom.getState();
    const x = Math.round((viewport.clientWidth / 2 - panX) / zoom - 100);
    const y = Math.round((viewport.clientHeight / 2 - panY) / zoom - 40);

    const newItem = {
      id: crypto.randomUUID(),
      x,
      y,
      w: 200,
      h: 80,
      content: 'New text',
    };

    const items = getBoardTextItems(storeId);
    items.push(newItem);
    setBoardTextItems(storeId, items);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = textElementHtml(newItem, true);
    const textEl = wrapper.firstElementChild;
    canvas.appendChild(textEl);
    initTextElement(textEl, storeId);

    textEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  });
}

// ─── View-only click handler ──────────────────────────────────────────────────

function initViewClicks(block, config) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('click', (e) => {
    if (e.target.closest('.board__rendition-action')) return;
    const card = e.target.closest('.board__item');
    if (!card?.dataset.ascAsset || card.classList.contains('board__item--locked')) return;
    openDetails(card.dataset.ascAsset, null, config);
  });

  initNotesHover(block);
}

function flashActionIcon(button, success) {
  const original = button.innerHTML;
  button.innerHTML = success
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  setTimeout(() => { button.innerHTML = original; }, success ? 1500 : 3000);
}

function downloadRendition(asset, rendition) {
  if (!rendition?.url) return;
  const link = document.createElement('a');
  link.href = rendition.url;
  link.download = rendition.filename || asset.filename || asset.title || 'asset';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function initRenditionActions(block) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  const getAsset = (button) => window.asc?.cache?.assets?.get(button.dataset.ascAsset);
  viewport.addEventListener('click', (event) => {
    const button = event.target.closest('.board__rendition-action');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    const asset = getAsset(button);
    if (!asset) return;
    const action = button.dataset.boardAction;
    toggleRenditionMenu(button, asset, async (rendition) => {
      if (action === 'download') {
        downloadRendition(asset, rendition);
      } else if (action === 'copy-url') {
        try {
          await navigator.clipboard.writeText(rendition.url);
          flashActionIcon(button, true);
        } catch {
          flashActionIcon(button, false);
        }
      }
    }, { title: action === 'download' ? 'Download' : 'Copy URL' });
  });

  viewport.addEventListener('mouseover', (event) => {
    const button = event.target.closest('.board__rendition-action');
    const asset = button && getAsset(button);
    if (asset) prefetchRenditionSizes(asset);
  });
}

// ─── Minimap ──────────────────────────────────────────────────────────────────

const MINIMAP_PAD = 6;

function minimapContentBounds(items) {
  if (!items.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  items.forEach((el) => {
    const x = parseFloat(el.style.left) || 0;
    const y = parseFloat(el.style.top) || 0;
    const w = el.offsetWidth || 240;
    const h = el.offsetHeight || 180;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  return {
    minX, minY, maxX, maxY,
  };
}

/**
 * Small overview panel showing every card/text element scaled down, plus a rectangle
 * marking the current visible viewport — click anywhere on it to jump there (zoom unchanged).
 * Recomputes markers whenever the canvas's content changes (add/remove/drag any item), via
 * MutationObserver rather than threading a refresh call through every interaction handler.
 * The viewport indicator alone is cheap to update on every pan/zoom change (see onChange
 * callback wired in initPanZoom).
 */
function initMinimap(block, panZoom) {
  const viewport = block.querySelector('.board__viewport');
  const canvas = block.querySelector('.board__canvas');
  const minimap = block.querySelector('.board__minimap');
  const inner = block.querySelector('.board__minimap-inner');
  const indicator = block.querySelector('.board__minimap-viewport');
  if (!viewport || !canvas || !minimap || !inner || !indicator) return { updateIndicator() {} };

  let bounds = null;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function updateIndicator() {
    if (!bounds) return;
    const { panX, panY, zoom } = panZoom.getState();
    const vx = -panX / zoom;
    const vy = -panY / zoom;
    const vw = viewport.clientWidth / zoom;
    const vh = viewport.clientHeight / zoom;
    indicator.style.left = `${offsetX + vx * scale}px`;
    indicator.style.top = `${offsetY + vy * scale}px`;
    indicator.style.width = `${Math.max(4, vw * scale)}px`;
    indicator.style.height = `${Math.max(4, vh * scale)}px`;
  }

  function refresh() {
    const items = [...canvas.querySelectorAll('.board__item, .board__text-element')];
    bounds = minimapContentBounds(items);
    if (!bounds) {
      minimap.hidden = true;
      return;
    }
    minimap.hidden = false;

    const w = Math.max(1, bounds.maxX - bounds.minX);
    const h = Math.max(1, bounds.maxY - bounds.minY);
    scale = Math.min(
      (inner.clientWidth - 2 * MINIMAP_PAD) / w,
      (inner.clientHeight - 2 * MINIMAP_PAD) / h,
    );
    offsetX = MINIMAP_PAD - bounds.minX * scale;
    offsetY = MINIMAP_PAD - bounds.minY * scale;

    inner.querySelectorAll('.board__minimap-marker').forEach((m) => m.remove());
    items.forEach((el) => {
      const x = parseFloat(el.style.left) || 0;
      const y = parseFloat(el.style.top) || 0;
      const w2 = el.offsetWidth || 240;
      const h2 = el.offsetHeight || 180;
      const isText = el.classList.contains('board__text-element');
      const marker = document.createElement('div');
      marker.className = `board__minimap-marker${isText ? ' board__minimap-marker--text' : ''}`;
      marker.style.left = `${offsetX + x * scale}px`;
      marker.style.top = `${offsetY + y * scale}px`;
      marker.style.width = `${Math.max(2, w2 * scale)}px`;
      marker.style.height = `${Math.max(2, h2 * scale)}px`;
      inner.appendChild(marker);
    });

    updateIndicator();
  }

  function jumpTo(e) {
    const rect = inner.getBoundingClientRect();
    const targetX = (e.clientX - rect.left - offsetX) / scale;
    const targetY = (e.clientY - rect.top - offsetY) / scale;
    panZoom.centerOn(targetX, targetY);
  }

  // Drag anywhere on the minimap to continuously pan, not just a single jump on click.
  inner.addEventListener('pointerdown', (e) => {
    if (!bounds) return;
    e.stopPropagation();
    inner.setPointerCapture(e.pointerId);
    jumpTo(e);

    const onMove = (mev) => jumpTo(mev);
    const onUp = () => {
      inner.removeEventListener('pointermove', onMove);
      inner.removeEventListener('pointerup', onUp);
      inner.removeEventListener('pointercancel', onUp);
    };
    inner.addEventListener('pointermove', onMove);
    inner.addEventListener('pointerup', onUp);
    inner.addEventListener('pointercancel', onUp);
  });

  let refreshScheduled = false;
  const observer = new MutationObserver(() => {
    if (refreshScheduled) return;
    refreshScheduled = true;
    requestAnimationFrame(() => { refreshScheduled = false; refresh(); });
  });
  observer.observe(canvas, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['style'],
  });

  // Defer the first refresh (double rAF, matching the main fitView's timing) rather than
  // computing synchronously right after the DOM was replaced — belt-and-braces against any
  // layout not being settled yet immediately after a full block re-render.
  requestAnimationFrame(() => requestAnimationFrame(refresh));

  return { updateIndicator };
}

// ─── Board orchestrator ───────────────────────────────────────────────────────

const BOARD_BOTTOM_MARGIN = 64;
const BOARD_MIN_HEIGHT = 420;

// Fill down to the bottom of the browser viewport instead of guessing a fixed vh —
// how much page content sits above the board (title, toolbar, etc.) varies per page,
// so a fixed vh percentage either overshoots (cut off below the fold) or undershoots
// (a gap before the viewport's bottom edge) depending on the page.
function sizeViewport(block) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;
  const available = window.innerHeight - viewport.getBoundingClientRect().top - BOARD_BOTTOM_MARGIN;
  viewport.style.height = `${Math.max(available, BOARD_MIN_HEIGHT)}px`;
}

function initBoard(block, config, collectionId) {
  _selectedItems.clear();
  sizeViewport(block);

  const panZoom = initPanZoom(block, collectionId, () => minimap?.updateIndicator());
  const minimap = initMinimap(block, panZoom);

  block.querySelector('.board__fit')?.addEventListener('click', () => panZoom.fitView());

  initSearch(block, panZoom);
  initRenditionActions(block);

  if (config.mode === 'interactive' && collectionId) {
    initRubberBand(block, panZoom);
    initItemDrag(block, collectionId, panZoom);
    initBoardClicks(block, collectionId, config);
    initTextElements(block, collectionId);
    initAddText(block, collectionId, panZoom);
    initAlignGrid(block, collectionId, panZoom);
  } else {
    initViewClicks(block, config);
  }

  if (!panZoom.hasValidSavedViewport) {
    requestAnimationFrame(() => requestAnimationFrame(() => panZoom.fitView(false)));
  }
}

// ─── Main decorate ────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const config = parseConfig(block);
  const params = new URLSearchParams(window.location.search);

  block.innerHTML = '';

  // Window resizes AND layout shifts from async content above the board (e.g. the
  // collection-controls toolbar expanding once its data loads) can change how much
  // space is left — re-measure whenever the page's layout changes, not just on resize.
  let resizeRaf;
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => sizeViewport(block));
  }).observe(document.body);

  if (config.source === 'collection' && config.mode !== 'sheet-url') {
    const id = params.get('id');
    if (!id) {
      block.innerHTML = '<p class="board__error">No collection id in URL.</p>';
      return;
    }

    async function renderCollection() {
      const result = await loadFromCollection(id);
      if (!result) {
        block.innerHTML = '<p class="board__error">Collection not found.</p>';
        return;
      }
      const { assetItems, textItems } = result;
      block.innerHTML = viewportHtml(assetItems, textItems, config);
      initBoard(block, config, id);
    }

    await renderCollection();

    document.addEventListener(CollectionEvents.CHANGED, async (e) => {
      if (e.detail?.id && e.detail.id !== id) return;
      await renderCollection();
    });
  } else {
    const sheetParam = config.mode === 'sheet-url'
      ? sheetParamFromUrl(config.sheetUrl)
      : params.get('sheet');
    if (config.mode === 'sheet-url' && !sheetParam) {
      block.innerHTML = '<p class="board__error">A static sheet requires a valid Sheet URL.</p>';
      return;
    }
    if (config.mode === 'sheet-url') block.dataset.ascSheetParam = sheetParam;
    const { meta, assetItems, textItems } = await loadFromSheet(sheetParam);

    if (meta.invalid) {
      block.innerHTML = '<p class="board__error">This sheet link is invalid or corrupted.</p>';
      return;
    }

    if (meta.expiresAt && Date.now() > new Date(meta.expiresAt).getTime()) {
      block.innerHTML = expiredHtml(meta.expiresAt);
      return;
    }

    const boardConfig = config.mode === 'sheet-url' ? { ...config, mode: 'view' } : config;
    block.innerHTML = viewportHtml(assetItems, textItems, boardConfig);

    initBoard(block, boardConfig, null);
  }
}
