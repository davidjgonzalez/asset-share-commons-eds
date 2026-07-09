/** @owner user */
import services from '../../scripts/asc/services/services.js';
import { Events as CollectionEvents } from '../../scripts/asc/services/collections/collections.js';
import { escHtml, escAttr } from '../../scripts/html.js';

const configurations = (await import('../../scripts/configurations.js')).default;

// ─── Module-level drag / selection state ─────────────────────────────────────

let _cardDragMoved = false;
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
    displayProperties: [],
    details: null,
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
    } else if (key === 'display-properties') {
      config.displayProperties = val ? val.split(/[\n,·•]+/).map((p) => p.trim()).filter(Boolean) : [];
    } else if (key === 'details') config.details = val || null;
  });
  return config;
}

// ─── Asset type label ─────────────────────────────────────────────────────────

function assetTypeLabel(mimeType) {
  if (!mimeType) return 'Asset';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType.startsWith('audio/')) return 'Audio';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'Document';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentation';
  const ext = services.fileType.getExtension(mimeType);
  return ext ? ext.toUpperCase() : 'Asset';
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
    return JSON.parse(localStorage.getItem(VIEWPORT_KEY(id))) || { panX: 0, panY: 0, zoom: 1 };
  } catch {
    return { panX: 0, panY: 0, zoom: 1 };
  }
}

function setViewport(id, state) {
  localStorage.setItem(VIEWPORT_KEY(id), JSON.stringify(state));
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

function buildSearchStr(asset, config) {
  if (!config.searchProperties.length) return '';
  return config.searchProperties.map((prop) => asset.getProperty(prop).text).join(' ').toLowerCase().trim();
}

function cardBodyHtml(asset, config) {
  if (config.displayProperties.length) {
    return config.displayProperties.map((prop) => {
      const pv = asset.getProperty(prop);
      if (!pv.html) return '';
      return `<p class="asc-ui-asset-card__meta">${pv.html}</p>`;
    }).filter(Boolean).join('');
  }
  const mimeType = asset.getProperty('mime-type').data || asset.mimeType || '';
  return `<p class="asc-ui-asset-card__title" title="${escHtml(asset.title)}">${escHtml(assetTypeLabel(mimeType))}</p>`;
}

function boardCardHtml(item, index, config) {
  const { asset, notes: itemNotes } = item;
  const x = item.x !== undefined ? item.x : 80 + (index % 10) * 180;
  const y = item.y !== undefined ? item.y : 80 + Math.floor(index / 10) * 160;
  const srcset = services.renditions.getThumbnailSrcset(asset);
  const thumbnailUrl = srcset.length
    ? srcset[Math.floor(srcset.length / 2)].url
    : services.renditions.getThumbnailUrl(asset);
  const srcsetAttr = srcset.length
    ? srcset.map((r) => `${r.url} ${r.size.width}w`).join(', ')
    : '';
  const searchStr = buildSearchStr(asset, config);
  const interactive = config.mode === 'interactive';
  const showNotes = config.notes;

  return `
    <article class="asc-ui-asset-card board__card${showNotes && itemNotes ? ' board__card--has-note' : ''}"
             style="left: ${x}px; top: ${y}px"
             data-asc-asset="${escAttr(asset.uuid)}"
             ${searchStr ? `data-filter="${escAttr(searchStr)}"` : ''}
             ${interactive && showNotes ? `data-asc-notes="${escAttr(itemNotes || '')}"` : ''}>
      <div class="asc-ui-asset-card__thumb">
        ${interactive ? `
        <div class="asc-ui-asset-card__overlay">
          <button type="button"
                  class="asc-ui-icon-btn asc-ui-icon-btn--sm board__card-remove"
                  data-asc-asset="${escAttr(asset.uuid)}"
                  aria-label="Remove ${escHtml(asset.title)} from collection">&#x2715;</button>
        </div>` : ''}
        <img src="${escAttr(thumbnailUrl)}"${srcsetAttr ? ` srcset="${srcsetAttr}" sizes="(min-width: 1024px) 160px, 140px"` : ''} alt="${escHtml(asset.description || asset.title || asset.name || '')}" loading="lazy" draggable="false">
      </div>
      <div class="asc-ui-asset-card__body">
        ${cardBodyHtml(asset, config)}
      </div>
      ${interactive && showNotes ? `
      <div class="asc-ui-asset-card__footer">
        <button type="button"
                class="asc-ui-icon-btn asc-ui-icon-btn--sm board__notes-btn"
                data-asc-asset="${escAttr(asset.uuid)}"
                aria-label="Notes"
                title="Notes">&#9998;</button>
      </div>` : ''}
    </article>`;
}

function textElementHtml(t, interactive) {
  return `
    <div class="board__text-element"
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
  const cards = assetItems.map((item, i) => boardCardHtml(item, i, config)).join('');
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
    </div>`;
}

function sheetHeaderHtml(title, description, assetCount) {
  return `
    <a href="/" class="board__back">&#8592; Back to search</a>
    <div class="board__sheet-header">
      <h1 class="board__sheet-title">${escHtml(title) || 'Download Sheet'}</h1>
      ${description ? `<p class="board__sheet-description">${escHtml(description)}</p>` : ''}
      <p class="board__sheet-count">${assetCount} asset${assetCount === 1 ? '' : 's'}</p>
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
  const assetItems = (collection.hydratedItems || [])
    .filter((i) => i.type === 'asset' && i.asset);
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
  const parts = await services.url.decompressToArray(sheetParam);
  const {
    title = '', description = '', expiresAt = null, items = [], textElements = [],
  } = JSON.parse(parts.join(','));

  const mixedItems = items.map(parseEntry);
  const assetIds = mixedItems.filter((i) => i.type === 'asset').map((i) => i.id);
  const fetchedAssets = await Promise.all(assetIds.map((id) => services.search.getAssetById(id)));
  const assetMap = new Map(fetchedAssets.filter(Boolean).map((a) => [a.uuid, a]));

  const assetItems = mixedItems
    .filter((i) => i.type === 'asset' && assetMap.has(i.id))
    .map((i) => ({ ...i, asset: assetMap.get(i.id) }));

  return {
    meta: { title, description, expiresAt },
    assetItems,
    textItems: textElements,
  };
}

// ─── Selection helpers ────────────────────────────────────────────────────────

function selectItem(el) {
  el.classList.add('board__card--selected');
  _selectedItems.add(el);
}

function deselectItem(el) {
  el.classList.remove('board__card--selected');
  _selectedItems.delete(el);
}

function deselectAll() {
  _selectedItems.forEach((el) => el.classList.remove('board__card--selected'));
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
    const w = card.offsetWidth || 160;
    const h = card.offsetHeight || 200;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  const PAD = 72;
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  if (!contentW || !contentH || !vw || !vh) return { panX: 0, panY: 0, zoom: 1 };
  const zoom = Math.min(
    (vw - 2 * PAD) / contentW,
    (vh - 2 * PAD) / contentH,
    1.0,
  );
  const panX = (vw - contentW * zoom) / 2 - minX * zoom;
  const panY = PAD - minY * zoom;
  return { panX, panY, zoom };
}

// ─── Notes panel ──────────────────────────────────────────────────────────────

function positionPanel(panel, btn, viewport) {
  const btnRect = btn.getBoundingClientRect();
  const vRect = viewport.getBoundingClientRect();
  const pw = panel.offsetWidth || 220;
  const ph = panel.offsetHeight || 160;
  const gap = 10;
  const tailCenter = 26;

  const btnCX = btnRect.left - vRect.left + btnRect.width / 2;
  let left = btnCX - tailCenter;
  let useRightTail = false;

  if (left + pw > vRect.width - 4) {
    left = btnCX - (pw - tailCenter);
    useRightTail = true;
  }
  left = Math.max(4, left);

  const aboveTop = btnRect.top - vRect.top - ph - gap;
  const belowTop = btnRect.bottom - vRect.top + gap;
  const goAbove = aboveTop >= 4;
  const top = goAbove ? aboveTop : belowTop;

  panel.classList.remove('asc-ui-bubble--br', 'asc-ui-bubble--tl', 'asc-ui-bubble--tr');
  if (goAbove) {
    if (useRightTail) panel.classList.add('asc-ui-bubble--br');
  } else {
    panel.classList.add(useRightTail ? 'asc-ui-bubble--tr' : 'asc-ui-bubble--tl');
  }

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function repositionOpenPanel() {
  if (!_openPanelState) return;
  const { panel, btn, viewport } = _openPanelState;
  if (!document.contains(panel)) { _openPanelState = null; return; }
  positionPanel(panel, btn, viewport);
}

function openNotePanel(block, card, btn, className, innerHtml, mode) {
  block.querySelector('.board__notes-panel')?.remove();
  _openPanelState = null;
  const panel = document.createElement('div');
  panel.className = className;
  panel.innerHTML = innerHtml;
  const viewport = block.querySelector('.board__viewport');
  viewport.appendChild(panel);
  positionPanel(panel, btn, viewport);
  _openPanelState = {
    panel, card, btn, viewport, mode,
  };
  return { panel, viewport };
}

function openNotePreview(block, card, btn) {
  const notes = card.dataset.ascNotes || '';
  if (!notes) return;

  const { panel } = openNotePanel(
    block, card, btn,
    'asc-ui-bubble board__notes-panel board__notes-panel--preview',
    `<p class="board__notes-preview-text">${escHtml(notes)}</p>`,
    'preview',
  );

  panel.addEventListener('mouseenter', () => clearTimeout(_noteHoverTimer));
  panel.addEventListener('mouseleave', () => {
    if (_openPanelState?.mode === 'preview') {
      _noteHoverTimer = setTimeout(() => {
        if (_openPanelState?.mode === 'preview') {
          _openPanelState.panel.remove();
          _openPanelState = null;
        }
      }, 150);
    }
  });
}

function openNoteEdit(block, collectionId, card) {
  const assetId = card.dataset.ascAsset;
  const currentNotes = card.dataset.ascNotes || '';
  const btn = card.querySelector('.board__notes-btn');

  const { panel } = openNotePanel(
    block, card, btn,
    'asc-ui-bubble board__notes-panel',
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
    updateCardNotes(card, notes);
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

function updateCardNotes(card, notes) {
  card.classList.toggle('board__card--has-note', !!notes);
  card.dataset.ascNotes = notes || '';
}

// ─── Pan/zoom engine ──────────────────────────────────────────────────────────

function initPanZoom(block, persistId) {
  const viewport = block.querySelector('.board__viewport');
  const canvas = block.querySelector('.board__canvas');
  if (!viewport || !canvas) return { getState: () => ({ panX: 0, panY: 0, zoom: 1 }), applyFit() {}, fitView() {} };

  const saved = persistId ? getViewport(persistId) : { panX: 0, panY: 0, zoom: 1 };
  let { panX, panY, zoom } = saved;

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
  }, { passive: false });

  function applyFit(fit) {
    ({ panX, panY, zoom } = fit);
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    if (persistId) setViewport(persistId, fit);
    repositionOpenPanel();
  }

  function fitView() {
    const allCards = [...canvas.querySelectorAll('.board__card, .board__text-element')];
    applyFit(computeFitViewport(allCards, viewport));
  }

  return {
    getState: () => ({ panX, panY, zoom }),
    applyFit,
    fitView,
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
      block.querySelectorAll('.board__card').forEach((card) => card.classList.remove('board__card--match'));
      panZoom.fitView();
      return;
    }
    viewport.setAttribute('data-board-searching', '');
    const matches = [];
    block.querySelectorAll('.board__card').forEach((card) => {
      const haystack = [card.dataset.filter, card.dataset.ascNotes].filter(Boolean).join(' ').toLowerCase();
      const hit = haystack.includes(q);
      card.classList.toggle('board__card--match', hit);
      if (hit) matches.push(card);
    });
    if (matches.length) panZoom.applyFit(computeFitViewport(matches, viewport));
  });
}

// ─── Rubber-band selection ────────────────────────────────────────────────────

function initRubberBand(block, panZoom) {
  const viewport = block.querySelector('.board__viewport');
  const canvas = block.querySelector('.board__canvas');
  if (!viewport || !canvas) return;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button === 1) return;
    if (e.target.closest('.board__card, .board__text-element')) return;
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
      canvas.querySelectorAll('.board__card, .board__text-element').forEach((item) => {
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

function initCardDrag(block, collectionId, panZoom) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.board__card');
    if (!card) return;
    if (e.target.closest('.board__card-remove, .board__notes-btn')) return;

    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    _cardDragMoved = false;

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
    dragGroup.forEach((c) => c.classList.add('board__card--dragging'));

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) _cardDragMoved = true;
      if (!_cardDragMoved) return;
      startPositions.forEach(({ el, left, top }) => {
        el.style.left = `${left + dx / zoom}px`;
        el.style.top = `${top + dy / zoom}px`;
      });
    }

    function onUp() {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onUp);
      dragGroup.forEach((c) => c.classList.remove('board__card--dragging'));
      if (_cardDragMoved) {
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

// ─── Board click routing (interactive mode) ───────────────────────────────────

function initBoardClicks(block, collectionId, config) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('click', (e) => {
    if (!e.target.closest('.board__card, .board__notes-panel, .board__toolbar, .board__controls, .board__text-element')) {
      if (_rubberBandJustSelected) { _rubberBandJustSelected = false; return; }
      deselectAll();
    }

    const removeBtn = e.target.closest('.board__card-remove');
    if (removeBtn) {
      services.collections.removeAsset(collectionId, removeBtn.dataset.ascAsset);
      return;
    }

    const notesBtn = e.target.closest('.board__notes-btn');
    if (notesBtn) {
      const card = notesBtn.closest('.board__card');
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

    const card = e.target.closest('.board__card');
    if (card) {
      if (!_cardDragMoved) {
        if (e.shiftKey) {
          toggleItem(card);
        } else if (card.dataset.ascAsset) {
          openDetails(card.dataset.ascAsset, null, config);
        } else {
          deselectAll();
          selectItem(card);
        }
      }
      _cardDragMoved = false;
    }
  });

  viewport.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.board__notes-btn');
    if (!btn) return;
    clearTimeout(_noteHoverTimer);
    const card = btn.closest('.board__card');
    if (card?.classList.contains('board__card--has-note') && !_openPanelState) {
      openNotePreview(block, card, btn);
    }
  });

  viewport.addEventListener('mouseout', (e) => {
    if (!e.target.closest('.board__notes-btn')) return;
    if (e.relatedTarget?.closest('.board__notes-panel')) return;
    if (_openPanelState?.mode === 'preview') {
      _noteHoverTimer = setTimeout(() => {
        if (_openPanelState?.mode === 'preview') {
          _openPanelState.panel.remove();
          _openPanelState = null;
        }
      }, 150);
    }
  });
}

// ─── Align to grid ────────────────────────────────────────────────────────────

function initAlignGrid(block, collectionId, panZoom) {
  const canvas = block.querySelector('.board__canvas');
  const viewport = block.querySelector('.board__viewport');

  block.querySelector('.board__align-grid')?.addEventListener('click', () => {
    const allItems = [...canvas.querySelectorAll('.board__card, .board__text-element')];
    if (!allItems.length) return;

    const SNAP = 24;
    const MIN_GAP = 16;

    const layout = allItems.map((el) => ({
      el,
      x: Math.round((parseFloat(el.style.left) || 0) / SNAP) * SNAP,
      y: Math.round((parseFloat(el.style.top) || 0) / SNAP) * SNAP,
      w: el.offsetWidth || 160,
      h: el.offsetHeight || 200,
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
      const allCards = [...canvas.querySelectorAll('.board__card, .board__text-element')];
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
    dragGroup.forEach((item) => item.classList.add('board__card--dragging'));

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
      dragGroup.forEach((item) => item.classList.remove('board__card--dragging'));

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
    const card = e.target.closest('.board__card');
    if (!card?.dataset.ascAsset) return;
    openDetails(card.dataset.ascAsset, null, config);
  });
}

// ─── Board orchestrator ───────────────────────────────────────────────────────

function initBoard(block, config, collectionId) {
  _selectedItems.clear();

  const hasSavedViewport = collectionId && localStorage.getItem(VIEWPORT_KEY(collectionId)) !== null;

  const panZoom = initPanZoom(block, collectionId);

  block.querySelector('.board__fit')?.addEventListener('click', () => panZoom.fitView());

  initSearch(block, panZoom);

  if (config.mode === 'interactive' && collectionId) {
    initRubberBand(block, panZoom);
    initCardDrag(block, collectionId, panZoom);
    initBoardClicks(block, collectionId, config);
    initTextElements(block, collectionId);
    initAddText(block, collectionId, panZoom);
    initAlignGrid(block, collectionId, panZoom);
  } else {
    initViewClicks(block, config);
  }

  if (!hasSavedViewport) {
    requestAnimationFrame(() => requestAnimationFrame(() => panZoom.fitView()));
  }
}

// ─── Main decorate ────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const config = parseConfig(block);
  const params = new URLSearchParams(window.location.search);

  block.innerHTML = '';

  if (config.source === 'collection') {
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
    const sheetParam = params.get('sheet');
    const { meta, assetItems, textItems } = await loadFromSheet(sheetParam);

    if (meta.expiresAt && Date.now() > new Date(meta.expiresAt).getTime()) {
      block.innerHTML = expiredHtml(meta.expiresAt);
      return;
    }

    const assetCount = assetItems.length;
    block.innerHTML = sheetHeaderHtml(meta.title, meta.description, assetCount)
      + viewportHtml(assetItems, textItems, config);

    initBoard(block, config, null);
  }
}
