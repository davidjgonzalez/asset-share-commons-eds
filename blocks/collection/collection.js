/** @owner user */
import services from '../../scripts/asc/services/services.js';
import storage from '../../scripts/asc/services/storage/storage.js';
import { Events as CollectionEvents } from '../../scripts/asc/services/collections/collections.js';
import { Events as DownloadEvents, Status as DownloadStatus } from '../../scripts/asc/services/downloads/downloads.js';
import { escHtml, escAttr, formatUpdated } from '../../scripts/html.js';

const configurations = (await import('../../scripts/configurations.js')).default;

const SHEET_PATH = configurations.collections?.sheetPath || '/sheets/';
const SHARE_HISTORY_KEY = 'shareHistory';
const MAX_SHARE_HISTORY = 20;

// Tracks the section ID to focus after a re-render triggered by addSection
let _pendingSectionFocus = null;

let _cardDragMoved = false;
let _rubberBandJustSelected = false;

let _openPanelState = null;

const _selectedItems = new Set();

// ─── Mode & viewport state ─────────────────────────────────────────────────────

const MODE_KEY = (id) => `asc:collectionMode:${id}`;
const VIEWPORT_KEY = (id) => `asc:boardViewport:${id}`;
const BOARD_TEXT_KEY = (id) => `asc:boardText:${id}`;

function getBoardTextItems(collectionId) {
  try {
    return JSON.parse(localStorage.getItem(BOARD_TEXT_KEY(collectionId))) || [];
  } catch {
    return [];
  }
}

function setBoardTextItems(collectionId, items) {
  localStorage.setItem(BOARD_TEXT_KEY(collectionId), JSON.stringify(items));
}

function saveTextItem(collectionId, el) {
  const { textId } = el.dataset;
  if (!textId) return;
  const items = getBoardTextItems(collectionId);
  const item = items.find((t) => t.id === textId);
  if (!item) return;
  item.x = Math.round(parseFloat(el.style.left) || 0);
  item.y = Math.round(parseFloat(el.style.top) || 0);
  item.w = el.offsetWidth;
  item.h = el.offsetHeight;
  item.content = el.querySelector('.board__text-content')?.innerText?.trim() || '';
  setBoardTextItems(collectionId, items);
}

function getMode(collectionId) {
  return localStorage.getItem(MODE_KEY(collectionId)) || 'list';
}

function setMode(collectionId, mode) {
  localStorage.setItem(MODE_KEY(collectionId), mode);
}

function getViewport(collectionId) {
  try {
    return JSON.parse(localStorage.getItem(VIEWPORT_KEY(collectionId))) || { panX: 0, panY: 0, zoom: 1 };
  } catch {
    return { panX: 0, panY: 0, zoom: 1 };
  }
}

function setViewport(collectionId, state) {
  localStorage.setItem(VIEWPORT_KEY(collectionId), JSON.stringify(state));
}

/**
 * Collection block — detail/edit page for a single collection.
 *
 * Page URL: /collections/collection?id=<uuid>
 *
 * Features:
 *   - Editable collection name
 *   - Mixed item list: asset rows (120×90 thumbnail) and inline section widgets
 *   - Section widgets: editable h2 + Markdown textarea, saves on blur
 *   - "Add section" button appends a new empty section
 *   - Share / Download / Delete using global .btn utilities
 *   - Dialogs use .asc-dialog shell
 */
export default async function decorate(block) {
  const collectionId = resolveCollectionId();
  await render(block, collectionId);

  document.addEventListener(CollectionEvents.CHANGED, async (e) => {
    if (e.detail?.source === 'block') return;
    await render(block, collectionId);
  });

  document.addEventListener(DownloadEvents.CHANGED, () => refreshDownloadStatus(block));
  document.addEventListener(DownloadEvents.COMPLETE, () => refreshDownloadStatus(block));
  document.addEventListener(DownloadEvents.FAILED, () => refreshDownloadStatus(block));

  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) closeMenu(block);
  });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

async function render(block, collectionId) {
  const collection = await services.collections.get(collectionId, true);
  if (!collection) {
    block.innerHTML = '<p class="collection__not-found">Collection not found.</p>';
    return;
  }
  const data = services.collections._getData();
  const isDefault = data.defaultId === collection.id;
  const pendingJobs = services.downloads.getAll().filter(
    (j) => j.collectionId === collection.id
      && (j.status === DownloadStatus.RUNNING || j.status === DownloadStatus.PENDING),
  );
  const mode = getMode(collectionId);

  block.innerHTML = html(collection, isDefault, pendingJobs, mode);
  initInteractions(block, collection, isDefault, mode);
}

function html(collection, isDefault, pendingJobs, mode) {
  const items = collection.hydratedItems || [];
  const assetCount = (collection.assetIds || []).length;
  const updated = formatUpdated(collection.modifiedAt);
  return `
    <section class="collection__shell" aria-label="Collection">
    <header class="collection__header">
      <div class="collection__title-row">
        <h1 class="collection__name" data-collection-id="${collection.id}">${escHtml(collection.name)}</h1>
        <div class="collection__menu-wrap">
          <button type="button" class="collection__menu-trigger btn btn--ghost btn--icon btn--sm"
                  aria-label="Collection actions" aria-haspopup="true" aria-expanded="false">&#8943;</button>
          <div class="collection__menu asc-panel asc-panel--no-pad" hidden>
            <ul class="asc-ui-menu" role="menu">
              <li role="none">
                <button type="button" class="collection__rename-btn asc-ui-menu__item" role="menuitem">Rename</button>
              </li>
              ${!isDefault ? `
              <li role="none"><hr class="asc-ui-menu__separator"></li>
              <li role="none">
                <button type="button" class="collection__delete-btn asc-ui-menu__item collection__menu-item--danger" role="menuitem">Delete collection</button>
              </li>` : ''}
            </ul>
          </div>
        </div>
      </div>
      <p class="collection__meta">
        <span class="collection__meta-count">${assetCount} asset${assetCount !== 1 ? 's' : ''}</span>
        ${updated
    ? `<span class="collection__meta-sep" aria-hidden="true">&#183;</span><time class="collection__meta-updated" datetime="${escAttr(updated.iso)}">${escHtml(updated.label)}</time>`
    : ''}
      </p>
    </header>

    <div class="collection__toolbar">
      <div class="asc-ui-segmented asc-ui-segmented--sm collection__mode-toggle" role="group" aria-label="Display mode">
        <button type="button"
                class="asc-ui-segmented__option${mode === 'list' ? ' is-active' : ''}"
                data-mode="list" aria-pressed="${mode === 'list'}">&#9776; List</button>
        <button type="button"
                class="asc-ui-segmented__option${mode === 'board' ? ' is-active' : ''}"
                data-mode="board" aria-pressed="${mode === 'board'}">&#8862; Board</button>
      </div>
      <div class="collection__toolbar-end">
        <button type="button" class="collection__share-btn btn btn--secondary">Share</button>
        <button type="button" class="collection__download-btn btn btn--primary"
                ${assetCount === 0 ? 'disabled' : ''}>Download</button>
      </div>
    </div>

    ${pendingJobs.length ? renderJobsStatus(pendingJobs) : ''}

    ${mode === 'board' ? boardHtml(items, getBoardTextItems(collection.id)) : listHtml(items)}
    </section>`;
}

function listHtml(items) {
  return `
    <div class="collection__asset-list">
      ${items.length
    ? items.map((item) => (item.type === 'section' ? sectionWidget(item) : assetRow(item))).join('')
    : '<p class="collection__empty">No assets in this collection yet.</p>'}
      <button type="button" class="collection__add-section btn btn--ghost">+ Add section</button>
    </div>`;
}

function boardHtml(items, textItems) {
  const assetItems = items.filter((i) => i.type === 'asset' && i.asset);
  return `
    <div class="board__viewport">
      <div class="board__canvas">
        ${assetItems.map((item, index) => boardCard(item, index)).join('')}
        ${textItems.map((t) => boardTextElement(t)).join('')}
      </div>
      <button type="button" class="board__reset-view btn btn--ghost btn--sm">Fit view</button>
      <button type="button" class="board__clean-up btn btn--ghost btn--sm">Clean up</button>
      <button type="button" class="board__add-text btn btn--ghost btn--sm">+ Text</button>
    </div>`;
}

function boardCard(item, index) {
  const { asset, notes } = item;
  const x = item.x !== undefined ? item.x : 80 + (index % 10) * 180;
  const y = item.y !== undefined ? item.y : 80 + Math.floor(index / 10) * 160;
  const thumbnailUrl = services.renditions.getThumbnailUrl(asset);
  return `
    <article class="asc-ui-asset-card board__card"
             style="left: ${x}px; top: ${y}px"
             data-asc-asset="${escAttr(asset.uuid)}">
      <div class="asc-ui-asset-card__thumb">
        <span class="asc-ui-asset-card__badge">
          ${notes ? '<span class="board__notes-indicator" title="Has notes">&#128221;</span>' : ''}
        </span>
        <div class="asc-ui-asset-card__overlay">
          <button type="button"
                  class="asc-ui-icon-btn board__card-remove"
                  data-asc-asset="${escAttr(asset.uuid)}"
                  aria-label="Remove ${escHtml(asset.title)} from collection">&#x2715;</button>
        </div>
        <img src="${thumbnailUrl}" alt="${escHtml(asset.title)}" loading="lazy" draggable="false" />
      </div>
      <div class="asc-ui-asset-card__body">
        <p class="asc-ui-asset-card__title">${escHtml(asset.title)}</p>
        ${notes ? `<p class="board__card-notes-preview">${escHtml(notes)}</p>` : ''}
        <button type="button"
                class="btn btn--ghost btn--sm board__notes-btn"
                data-asc-asset="${escAttr(asset.uuid)}">${notes ? 'Edit note' : '+ Note'}</button>
      </div>
    </article>`;
}

function boardTextElement(t) {
  return `
    <div class="board__text-element"
         style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px"
         data-text-id="${escAttr(t.id)}">
      <button type="button"
              class="btn btn--ghost btn--icon btn--sm board__text-remove"
              data-text-id="${escAttr(t.id)}"
              aria-label="Remove text element">&#x2715;</button>
      <div class="board__text-content" contenteditable="false">${escHtml(t.content)}</div>
    </div>`;
}

function renderJobsStatus(jobs) {
  return `
    <div class="collection__jobs">
      <h3 class="collection__jobs-title">Active Downloads</h3>
      <ul class="collection__jobs-list">
        ${jobs.map((job) => `
          <li class="collection__job" data-job-id="${job.id}">
            <span class="collection__job-status collection__job-status--${job.status}">
              ${jobStatusLabel(job)}
            </span>
            ${job.status === DownloadStatus.COMPLETE && job.downloadUrl
    ? `<button type="button" class="collection__job-download btn btn--secondary btn--sm" data-job-id="${job.id}">Download again</button>`
    : ''}
            ${job.status === DownloadStatus.RUNNING
    ? `<button type="button" class="collection__job-resume btn btn--ghost btn--sm" data-job-id="${job.id}">Check status</button>`
    : ''}
          </li>`).join('')}
      </ul>
    </div>`;
}

function assetRow(item) {
  const { asset, notes } = item;
  const thumbnailUrl = services.renditions.getThumbnailUrl(asset);
  return `
    <div class="collection__asset-row"
         draggable="true"
         data-asc-asset="${asset.uuid}"
         data-item-type="asset">
      <div class="collection__asset-drag" aria-hidden="true" title="Drag to reorder"></div>
      <div class="collection__asset-thumb">
        <img src="${thumbnailUrl}" alt="${escHtml(asset.title)}" loading="lazy" />
      </div>
      <div class="collection__asset-info">
        <div class="collection__asset-title">${escHtml(asset.title)}</div>
        <div class="collection__asset-meta">${escHtml(asset.getProperty('file-type') || '')}</div>
        ${notes
    ? `<div class="collection__asset-note" data-asc-asset="${escAttr(asset.uuid)}">${escHtml(notes)}</div>`
    : `<button type="button" class="collection__asset-add-note" data-asc-asset="${escAttr(asset.uuid)}">+ add note</button>`}
      </div>
      <button type="button" class="collection__asset-remove btn btn--ghost btn--sm"
              aria-label="Remove ${escHtml(asset.title)} from collection"
              data-asc-action="collection:remove@click"
              data-asc-asset="${asset.uuid}">Remove</button>
    </div>`;
}

function sectionWidget(item) {
  return `
    <div class="collection__section-widget"
         draggable="true"
         data-section-id="${escAttr(item.id)}"
         data-item-type="section">
      <div class="collection__asset-drag" aria-hidden="true" title="Drag to reorder"></div>
      <div class="collection__section-content">
        <input type="text"
               class="collection__section-title"
               value="${escAttr(item.title)}"
               placeholder="Section heading…"
               aria-label="Section title" />
        <textarea class="collection__section-body"
                  placeholder="Optional description (Markdown supported)…"
                  rows="2"
                  aria-label="Section body">${escHtml(item.body)}</textarea>
      </div>
      <button type="button"
              class="collection__section-delete btn btn--ghost btn--sm"
              aria-label="Delete section"
              data-section-id="${escAttr(item.id)}">✕</button>
    </div>`;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

function initInteractions(block, collection, isDefault, mode) {
  initMenu(block);
  initRename(block, collection);
  initShare(block, collection);
  initDownload(block, collection);
  if (!isDefault) initDelete(block, collection);
  initModeToggle(block, collection.id);
  initJobActions(block);

  if (mode === 'board') {
    initBoard(block, collection);
    initCardDrag(block, collection);
    initBoardClicks(block, collection);
    initTextElements(block, collection);
    initAddText(block, collection);
  } else {
    initReorder(block, collection);
    initSections(block, collection);
    initListNotes(block, collection);
    if (_pendingSectionFocus) {
      const input = block.querySelector(`[data-section-id="${_pendingSectionFocus}"] .collection__section-title`);
      input?.focus();
      _pendingSectionFocus = null;
    }
  }
}

function initModeToggle(block, collectionId) {
  block.querySelectorAll('.asc-ui-segmented__option[data-mode]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      setMode(collectionId, btn.dataset.mode);
      await render(block, collectionId);
    });
  });
}

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
  const PADDING = 0.10;
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  if (!contentW || !contentH) return { panX: 0, panY: 0, zoom: 1 };
  const zoom = Math.min(
    (vw * (1 - 2 * PADDING)) / contentW,
    (vh * (1 - 2 * PADDING)) / contentH,
    1.0,
  );
  const panX = (vw - contentW * zoom) / 2 - minX * zoom;
  const panY = (vh - contentH * zoom) / 2 - minY * zoom;
  return { panX, panY, zoom };
}

function initBoard(block, collection) {
  const viewport = block.querySelector('.board__viewport');
  const canvas = block.querySelector('.board__canvas');
  if (!viewport || !canvas) return;

  _selectedItems.clear();

  const hasSavedViewport = localStorage.getItem(VIEWPORT_KEY(collection.id)) !== null;
  let { panX, panY, zoom } = getViewport(collection.id);

  if (!hasSavedViewport) {
    const allCards = [...canvas.querySelectorAll('.board__card, .board__text-element')];
    const fit = computeFitViewport(allCards, viewport);
    ({ panX, panY, zoom } = fit);
    setViewport(collection.id, fit);
  }
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

  let panning = false;
  let lastX = 0;
  let lastY = 0;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.board__card, .board__text-element')) return;
    if (e.target.closest('.board__notes-panel, .board__reset-view, .board__add-text')) return;

    if (e.button === 1) {
      // Middle-mouse = pan
      panning = true;
      lastX = e.clientX;
      lastY = e.clientY;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('board__viewport--panning');
      return;
    }

    // Plain drag on empty canvas = rubber-band selection
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
      const left = Math.min(startX, endX);
      const top = Math.min(startY, endY);
      selRect.style.left = `${left}px`;
      selRect.style.top = `${top}px`;
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

  viewport.addEventListener('pointermove', (e) => {
    if (!panning) return;
    panX += e.clientX - lastX;
    panY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    repositionOpenPanel();
  });

  viewport.addEventListener('pointerup', () => {
    if (!panning) return;
    panning = false;
    viewport.classList.remove('board__viewport--panning');
    setViewport(collection.id, { panX, panY, zoom });
  });

  viewport.addEventListener('pointercancel', () => {
    if (!panning) return;
    panning = false;
    viewport.classList.remove('board__viewport--panning');
  });

  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 3.0;

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+scroll or pinch-to-zoom
      const rect = viewport.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
      panX = cursorX - (cursorX - panX) * (newZoom / zoom);
      panY = cursorY - (cursorY - panY) * (newZoom / zoom);
      zoom = newZoom;
    } else {
      // Scroll / two-finger trackpad swipe = pan
      panX -= e.deltaX;
      panY -= e.deltaY;
    }
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    setViewport(collection.id, { panX, panY, zoom });
    repositionOpenPanel();
  }, { passive: false });

  block.querySelector('.board__reset-view')?.addEventListener('click', () => {
    const allCards = [...canvas.querySelectorAll('.board__card, .board__text-element')];
    const fit = computeFitViewport(allCards, viewport);
    ({ panX, panY, zoom } = fit);
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    setViewport(collection.id, fit);
    repositionOpenPanel();
  });

  block.querySelector('.board__clean-up')?.addEventListener('click', () => {
    const cards = [...canvas.querySelectorAll('.board__card')];
    if (!cards.length) return;

    const CARD_W = 160;
    const GAP = 24;
    const cols = Math.max(1, Math.ceil(Math.sqrt(cards.length)));
    const rowH = Math.max(...cards.map((c) => c.offsetHeight || 250)) + GAP;

    cards.forEach((c) => { c.style.transition = 'left 0.35s ease, top 0.35s ease'; });

    cards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = GAP + col * (CARD_W + GAP);
      const y = GAP + row * rowH;
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      const uuid = card.dataset.ascAsset;
      if (uuid) services.collections.updateItem(collection.id, uuid, { x, y });
    });

    setTimeout(() => {
      cards.forEach((c) => { c.style.transition = ''; });
      const allItems = [...canvas.querySelectorAll('.board__card, .board__text-element')];
      const fit = computeFitViewport(allItems, viewport);
      ({ panX, panY, zoom } = fit);
      canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      setViewport(collection.id, fit);
      repositionOpenPanel();
    }, 380);
  });
}

function initCardDrag(block, collection) {
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

    const { zoom } = getViewport(collection.id);

    const isInGroup = _selectedItems.has(card) && _selectedItems.size > 1;
    const dragGroup = isInGroup ? [..._selectedItems] : [card];

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
          if (el.dataset.textId) {
            saveTextItem(collection.id, el);
          } else if (el.dataset.ascAsset) {
            const x = Math.round(parseFloat(el.style.left));
            const y = Math.round(parseFloat(el.style.top));
            services.collections.updateItem(collection.id, el.dataset.ascAsset, { x, y });
          }
        });
      }
    }

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
  });
}

function positionPanel(panel, card, viewport) {
  const cardRect = card.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const panelWidth = panel.offsetWidth || 220;
  const leftCandidate = cardRect.right - viewportRect.left + 8;
  const left = leftCandidate + panelWidth > viewportRect.width
    ? cardRect.left - viewportRect.left - panelWidth - 8
    : leftCandidate;
  panel.style.left = `${Math.max(4, left)}px`;
  panel.style.top = `${Math.max(4, cardRect.top - viewportRect.top)}px`;
}

function repositionOpenPanel() {
  if (!_openPanelState) return;
  const { panel, card, viewport } = _openPanelState;
  if (!document.contains(panel)) { _openPanelState = null; return; }
  positionPanel(panel, card, viewport);
}

function openNotesPanel(block, collection, card) {
  block.querySelector('.board__notes-panel')?.remove();
  _openPanelState = null;

  const assetId = card.dataset.ascAsset;
  const currentNotes = card.querySelector('.board__card-notes-preview')?.textContent || '';

  const panel = document.createElement('div');
  panel.className = 'board__notes-panel';
  panel.innerHTML = `
    <textarea class="board__notes-textarea"
              placeholder="Add a note about this asset…"
              rows="4">${escHtml(currentNotes)}</textarea>
    <div class="board__notes-actions">
      <button type="button" class="board__notes-done btn btn--primary btn--sm">Done</button>
    </div>`;

  const viewport = block.querySelector('.board__viewport');
  viewport.appendChild(panel);
  positionPanel(panel, card, viewport);
  _openPanelState = { panel, card, viewport };

  const textarea = panel.querySelector('.board__notes-textarea');
  textarea.focus();
  textarea.select();

  let removeOutsideClick = () => {};

  function saveAndClose() {
    const notes = textarea.value.trim();
    services.collections.updateItem(collection.id, assetId, { notes });
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
  const preview = card.querySelector('.board__card-notes-preview');
  const notesBtn = card.querySelector('.board__notes-btn');
  const badge = card.querySelector('.asc-ui-asset-card__badge');

  if (notes) {
    if (!preview) {
      const p = document.createElement('p');
      p.className = 'board__card-notes-preview';
      if (notesBtn) notesBtn.before(p);
    }
    const p2 = card.querySelector('.board__card-notes-preview');
    if (p2) p2.textContent = notes;
    if (notesBtn) notesBtn.textContent = 'Edit note';
    if (badge && !badge.querySelector('.board__notes-indicator')) {
      badge.innerHTML = '<span class="board__notes-indicator" title="Has notes">&#128221;</span>';
    }
  } else {
    preview?.remove();
    if (notesBtn) notesBtn.textContent = '+ Note';
    if (badge) badge.innerHTML = '';
  }
}

function initBoardClicks(block, collection) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('click', (e) => {
    if (!e.target.closest('.board__card, .board__notes-panel, .board__reset-view, .board__add-text, .board__text-element')) {
      if (_rubberBandJustSelected) { _rubberBandJustSelected = false; return; }
      deselectAll();
    }

    const removeBtn = e.target.closest('.board__card-remove');
    if (removeBtn) {
      services.collections.removeAsset(collection.id, removeBtn.dataset.ascAsset);
      return;
    }

    const notesBtn = e.target.closest('.board__notes-btn');
    if (notesBtn) {
      const card = notesBtn.closest('.board__card');
      if (card) openNotesPanel(block, collection, card);
      return;
    }

    const card = e.target.closest('.board__card');
    if (card) {
      if (!_cardDragMoved) {
        if (e.shiftKey) {
          toggleItem(card);
        } else if (_selectedItems.size > 1 && _selectedItems.has(card)) {
          // Click within a multi-selection → open asset details
          document.body.dispatchEvent(new CustomEvent('asc:asset:details:open', {
            bubbles: true,
            detail: { data: { ascAsset: card.dataset.ascAsset } },
          }));
        } else {
          deselectAll();
          selectItem(card);
        }
      }
      _cardDragMoved = false;
    }
  });
}

function initTextElement(el, collection) {
  const content = el.querySelector('.board__text-content');
  const { textId } = el.dataset;

  // ResizeObserver — save when user drags resize handle
  const ro = new ResizeObserver(() => saveTextItem(collection.id, el));
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

  // Blur content → exit edit and save
  content.addEventListener('blur', () => {
    content.contentEditable = 'false';
    delete el.dataset.editing;
    saveTextItem(collection.id, el);
  });

  // Escape key exits edit
  content.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); content.blur(); }
  });

  // Remove button
  el.querySelector('.board__text-remove')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const items = getBoardTextItems(collection.id).filter((t) => t.id !== textId);
    setBoardTextItems(collection.id, items);
    deselectItem(el);
    ro.disconnect();
    el.remove();
  });

  // Drag to move (only when not editing)
  el.addEventListener('pointerdown', (ev) => {
    if (el.dataset.editing) return;
    if (ev.target.closest('.board__text-remove')) return;
    // Bail if pointer is on the native CSS resize handle (bottom-right 16×16px)
    const elRect = el.getBoundingClientRect();
    if (ev.clientX > elRect.right - 16 && ev.clientY > elRect.bottom - 16) return;
    ev.stopPropagation();

    const startX = ev.clientX;
    const startY = ev.clientY;
    let moved = false;

    const { zoom } = getViewport(collection.id);

    // Group drag: if this element is in selection, move all selected items
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
          if (item.dataset.textId) saveTextItem(collection.id, item);
          if (item.dataset.ascAsset) {
            const x = Math.round(parseFloat(item.style.left));
            const y = Math.round(parseFloat(item.style.top));
            services.collections.updateItem(collection.id, item.dataset.ascAsset, { x, y });
          }
        });
      } else if (!uev.target.closest('.board__text-remove')) {
        // click (no drag) → select
        if (uev.shiftKey) toggleItem(el);
        else { deselectAll(); selectItem(el); }
      }
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });
}

function initTextElements(block, collection) {
  const canvas = block.querySelector('.board__canvas');
  if (!canvas) return;
  canvas.querySelectorAll('.board__text-element').forEach((el) => {
    initTextElement(el, collection);
  });
}

function initAddText(block, collection) {
  block.querySelector('.board__add-text')?.addEventListener('click', () => {
    const viewport = block.querySelector('.board__viewport');
    const canvas = block.querySelector('.board__canvas');
    if (!viewport || !canvas) return;

    const { panX, panY, zoom } = getViewport(collection.id);
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

    const items = getBoardTextItems(collection.id);
    items.push(newItem);
    setBoardTextItems(collection.id, items);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = boardTextElement(newItem);
    const textEl = wrapper.firstElementChild;
    canvas.appendChild(textEl);
    initTextElement(textEl, collection);

    textEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  });
}

// ── Actions menu ─────────────────────────────────────────────────────────────

function closeMenu(block) {
  block.querySelector('.collection__menu')?.setAttribute('hidden', '');
  block.querySelector('.collection__menu-trigger')?.setAttribute('aria-expanded', 'false');
}

function initMenu(block) {
  const trigger = block.querySelector('.collection__menu-trigger');
  const menu = block.querySelector('.collection__menu');
  if (!trigger || !menu) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !menu.hasAttribute('hidden');
    if (isOpen) {
      closeMenu(block);
    } else {
      menu.removeAttribute('hidden');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  menu.addEventListener('click', () => closeMenu(block));
}

// ── Rename ────────────────────────────────────────────────────────────────────

function initRename(block, collection) {
  block.querySelector('.collection__rename-btn')?.addEventListener('click', () => {
    const nameEl = block.querySelector('.collection__name');
    const current = nameEl.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'collection__name-input';
    input.value = current;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
      const val = input.value.trim();
      if (val && val !== current) {
        services.collections.rename(collection.id, val);
      }
      input.replaceWith(nameEl);
      nameEl.textContent = val || current;
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { input.replaceWith(nameEl); }
    });
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

function initDelete(block, collection) {
  block.querySelector('.collection__delete-btn')?.addEventListener('click', () => {
    if (!window.confirm(`Delete "${collection.name}"? This cannot be undone.`)) return;
    services.collections.delete(collection.id);
    const managePath = configurations.collections?.managePath || '/collections/';
    window.location.href = managePath;
  });
}

// ── Sections ─────────────────────────────────────────────────────────────────

function initSections(block, collection) {
  // Add section button
  block.querySelector('.collection__add-section')?.addEventListener('click', async () => {
    const section = await services.collections.addSection(collection.id, { title: '', body: '' });
    if (section) _pendingSectionFocus = section.id;
    // CHANGED event from addSection triggers re-render → initInteractions picks up _pendingSectionFocus
  });

  // Section title blur → save (useCapture because blur doesn't bubble)
  block.addEventListener('blur', (e) => {
    const input = e.target.closest?.('.collection__section-title');
    if (!input) return;
    const widget = input.closest('[data-section-id]');
    if (!widget) return;
    services.collections.updateSection(collection.id, widget.dataset.sectionId, { title: input.value });
  }, true);

  // Section body blur → save
  block.addEventListener('blur', (e) => {
    const textarea = e.target.closest?.('.collection__section-body');
    if (!textarea) return;
    const widget = textarea.closest('[data-section-id]');
    if (!widget) return;
    services.collections.updateSection(collection.id, widget.dataset.sectionId, { body: textarea.value });
  }, true);

  // Section delete
  block.querySelectorAll('.collection__section-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      services.collections.removeSection(collection.id, btn.dataset.sectionId);
    });
  });
}

function initListNotes(block, collection) {
  if (block.dataset.listNotesInit) return;
  block.dataset.listNotesInit = '1';

  block.addEventListener('click', (e) => {
    const target = e.target.closest('.collection__asset-note, .collection__asset-add-note');
    if (!target) return;

    const assetId = target.dataset.ascAsset;
    const currentValue = target.classList.contains('collection__asset-note')
      ? target.textContent
      : '';

    const textarea = document.createElement('textarea');
    textarea.className = 'collection__asset-note-edit';
    textarea.value = currentValue;
    textarea.rows = 2;
    textarea.placeholder = 'Add a note about this asset…';
    target.replaceWith(textarea);
    textarea.focus();

    function save() {
      const val = textarea.value.trim();
      services.collections.updateItem(collection.id, assetId, { notes: val });
      let replacement;
      if (val) {
        replacement = document.createElement('div');
        replacement.className = 'collection__asset-note';
        replacement.dataset.ascAsset = assetId;
        replacement.textContent = val;
      } else {
        replacement = document.createElement('button');
        replacement.type = 'button';
        replacement.className = 'collection__asset-add-note';
        replacement.dataset.ascAsset = assetId;
        replacement.textContent = '+ add note';
      }
      textarea.replaceWith(replacement);
    }

    textarea.addEventListener('blur', save);
    textarea.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { textarea.value = currentValue; save(); }
    });
  });
}

// ── Share ─────────────────────────────────────────────────────────────────────

function saveShareHistory(entry) {
  const history = storage.get(SHARE_HISTORY_KEY) || [];
  history.unshift({ id: crypto.randomUUID(), ...entry, createdAt: new Date().toISOString() });
  storage.set(SHARE_HISTORY_KEY, history.slice(0, MAX_SHARE_HISTORY));
}

function renderShareHistory() {
  const history = storage.get(SHARE_HISTORY_KEY) || [];
  if (!history.length) return '';

  const items = history.map((entry) => {
    const date = new Date(entry.createdAt);
    const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `
      <li class="collection__share-history-item">
        <span class="collection__share-history-title" title="${escAttr(entry.url)}">${escHtml(entry.title || 'Untitled')}</span>
        <span class="collection__share-history-date">${escHtml(label)}</span>
        <button type="button" class="btn btn--ghost btn--sm collection__share-history-copy"
                data-url="${escAttr(entry.url)}">Copy</button>
      </li>`;
  }).join('');

  return `
    <details class="collection__share-history">
      <summary>Past shares (${history.length})</summary>
      <ul class="collection__share-history-list">${items}</ul>
    </details>`;
}

function initShare(block, collection) {
  block.querySelector('.collection__share-btn')?.addEventListener('click', () => {
    openShareDialog(block, collection);
  });
}

async function openShareDialog(block, collection) {
  block.querySelector('.collection__share-dialog')?.remove();

  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow collection__share-dialog';
  dialog.setAttribute('aria-labelledby', 'share-dialog-title');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="share-dialog-title">Share Collection</h2>
        <p class="asc-dialog__description">
          Create a shareable link to this collection as a download sheet.
        </p>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>&#x2715;</button>
    </header>
    <div class="asc-dialog__body">
      <label class="collection__dialog-label">
        Sheet Title
        <input type="text" class="collection__share-title" value="${escHtml(collection.name)}" placeholder="Sheet title" />
      </label>
      <label class="collection__dialog-label">
        Description
        <textarea class="collection__share-description" rows="3" placeholder="Optional context or usage guidance for recipients&#8230;"></textarea>
      </label>
      <label class="collection__dialog-label">
        Expires in
        <div class="collection__share-expires-wrap">
          <input type="number" class="collection__share-expires" min="1" max="365" placeholder="No expiry" />
          <span class="collection__share-expires-unit">days</span>
        </div>
      </label>
      <div class="collection__share-url-wrap" hidden>
        <label class="collection__dialog-label">
          Share URL
          <input type="text" class="collection__share-url-output" readonly />
        </label>
        <button type="button" class="btn btn--secondary collection__share-copy" hidden>Copy</button>
      </div>
    </div>
    <footer class="asc-dialog__footer">
      <button type="button" class="btn btn--secondary" data-dialog-close>Cancel</button>
      <div class="asc-dialog__footer-end">
        <button type="button" class="btn btn--primary collection__share-generate">Generate Link</button>
      </div>
    </footer>`;

  const historyHtml = renderShareHistory();
  if (historyHtml) {
    dialog.querySelector('.asc-dialog__body').insertAdjacentHTML('beforeend', historyHtml);
  }

  block.appendChild(dialog);
  dialog.showModal();

  dialog.querySelectorAll('[data-dialog-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  dialog.querySelector('.collection__share-generate').addEventListener('click', async () => {
    const title = dialog.querySelector('.collection__share-title').value.trim();
    const description = dialog.querySelector('.collection__share-description').value.trim();
    const days = parseInt(dialog.querySelector('.collection__share-expires').value, 10);

    const encodedItems = (collection.items || []).map((item) => {
      if (item.type === 'section') return `~${item.title}|||${item.body}`;
      return item.notes ? `${item.id}|||${item.notes}` : item.id;
    });

    const payload = {
      title: title || collection.name,
      ...(description && { description }),
      // eslint-disable-next-line no-underscore-dangle
      ...(days > 0 && { expiresAt: new Date(Date.now() + days * 86_400_000).toISOString() }),
      items: encodedItems,
    };

    const compressed = await services.url.compressArray([JSON.stringify(payload)]);
    const url = `${window.location.origin}${SHEET_PATH}?sheet=${compressed}`;

    saveShareHistory({ title: payload.title, url, collectionId: collection.id });

    const wrap = dialog.querySelector('.collection__share-url-wrap');
    wrap.removeAttribute('hidden');
    wrap.querySelector('.collection__share-url-output').value = url;
    dialog.querySelector('.collection__share-copy')?.removeAttribute('hidden');

    const existingHistory = dialog.querySelector('.collection__share-history');
    const newHistoryHtml = renderShareHistory();
    if (existingHistory) {
      existingHistory.outerHTML = newHistoryHtml;
    } else if (newHistoryHtml) {
      dialog.querySelector('.asc-dialog__body').insertAdjacentHTML('beforeend', newHistoryHtml);
    }
  });

  dialog.querySelector('.collection__share-copy')?.addEventListener('click', () => {
    const output = dialog.querySelector('.collection__share-url-output');
    navigator.clipboard.writeText(output.value).then(() => {
      const btn = dialog.querySelector('.collection__share-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });

  dialog.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.collection__share-history-copy');
    if (!copyBtn) return;
    navigator.clipboard.writeText(copyBtn.dataset.url).then(() => {
      const orig = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = orig; }, 2000);
    });
  });
}

// ── Download ──────────────────────────────────────────────────────────────────

function initDownload(block, collection) {
  block.querySelector('.collection__download-btn')?.addEventListener('click', () => {
    openDownloadDialog(block, collection);
  });
}

async function openDownloadDialog(block, collection) {
  block.querySelector('.collection__download-dialog')?.remove();

  const assets = collection.assets || [];
  const renditionDefs = getVisibleRenditionDefs(assets);

  const dialog = document.createElement('dialog');
  dialog.className = 'asc-dialog asc-dialog--narrow collection__download-dialog';
  dialog.setAttribute('aria-labelledby', 'download-dialog-title');
  dialog.setAttribute('aria-describedby', 'download-dialog-description');
  dialog.innerHTML = `
    <header class="asc-dialog__header">
      <div class="asc-dialog__header-main">
        <h2 class="asc-dialog__title" id="download-dialog-title">Download Collection</h2>
        <p class="asc-dialog__description" id="download-dialog-description">
          ${assets.length} asset${assets.length !== 1 ? 's' : ''} — choose renditions, then start the download job.
        </p>
      </div>
      <button type="button" class="btn btn--ghost btn--icon asc-dialog__close" aria-label="Close" data-dialog-close>✕</button>
    </header>
    <div class="asc-dialog__body">
      <fieldset class="collection__download-renditions">
        <legend>Select renditions to download</legend>
        ${renditionDefs.length
    ? renditionDefs.map((def) => `
            <label class="collection__rendition-option">
              <input type="checkbox" name="rendition" value="${escAttr(def.id)}"
                     ${def.id === 'original' ? 'checked' : ''} />
              ${escHtml(def.label || def.id)}
            </label>`).join('')
    : '<p>No renditions configured. <a href="/config">Configure renditions</a>.</p>'}
      </fieldset>
      <p class="collection__download-note">
        Large collections may take a moment. Your download will start automatically.
      </p>
    </div>
    <footer class="asc-dialog__footer">
      <button type="button" class="btn btn--secondary" data-dialog-close>Cancel</button>
      <div class="asc-dialog__footer-end">
        <button type="button" class="collection__download-submit btn btn--primary"
                ${renditionDefs.length === 0 ? 'disabled' : ''}>
          Start Download
        </button>
      </div>
    </footer>`;

  block.appendChild(dialog);
  dialog.showModal();

  dialog.querySelectorAll('[data-dialog-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  dialog.querySelector('.collection__download-submit').addEventListener('click', async () => {
    const checked = [...dialog.querySelectorAll('input[name="rendition"]:checked')];
    const selectedRenditionIds = checked.map((cb) => cb.value);
    if (!selectedRenditionIds.length) {
      alert('Please select at least one rendition.');
      return;
    }

    const assetPaths = assets.map((a) => a.path).filter(Boolean);
    if (!assetPaths.length) {
      alert('Asset paths could not be resolved. Ensure assets have a JCR path.');
      return;
    }

    const submitBtn = dialog.querySelector('.collection__download-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    await services.downloads.create(assetPaths, selectedRenditionIds, {
      collectionId: collection.id,
      autoDownload: true,
    });

    submitBtn.textContent = 'Job submitted — download will start automatically';
    setTimeout(() => dialog.close(), 3000);
  });
}

// ── Reorder (drag-and-drop) ───────────────────────────────────────────────────

const ROW_SEL = '.collection__asset-row, .collection__section-widget';

function serializeRow(el) {
  if (el.dataset.ascAsset) return { type: 'asset', id: el.dataset.ascAsset };
  return {
    type: 'section',
    id: el.dataset.sectionId,
    title: el.querySelector('.collection__section-title')?.value || '',
    body: el.querySelector('.collection__section-body')?.value || '',
  };
}

function initReorder(block, collection) {
  const list = block.querySelector('.collection__asset-list');
  if (!list) return;

  let dragging = null;

  list.addEventListener('dragstart', (e) => {
    const row = e.target.closest(ROW_SEL);
    if (!row) return;
    dragging = row;
    if (row.classList.contains('collection__asset-row')) {
      row.classList.add('collection__asset-row--dragging');
    } else {
      row.classList.add('collection__section-widget--dragging');
    }
    e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragend', () => {
    if (dragging) {
      dragging.classList.remove('collection__asset-row--dragging', 'collection__section-widget--dragging');
    }
    list.querySelectorAll('.collection__asset-row--over, .collection__section-widget--over').forEach((el) => {
      el.classList.remove('collection__asset-row--over', 'collection__section-widget--over');
    });
    dragging = null;
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest(ROW_SEL);
    if (!target || target === dragging) return;
    list.querySelectorAll('.collection__asset-row--over, .collection__section-widget--over').forEach((el) => {
      el.classList.remove('collection__asset-row--over', 'collection__section-widget--over');
    });
    if (target.classList.contains('collection__asset-row')) {
      target.classList.add('collection__asset-row--over');
    } else {
      target.classList.add('collection__section-widget--over');
    }
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest(ROW_SEL);
    if (!target || !dragging || target === dragging) return;

    const rows = [...list.querySelectorAll(ROW_SEL)];
    const fromIdx = rows.indexOf(dragging);
    const toIdx = rows.indexOf(target);
    if (fromIdx < toIdx) target.after(dragging);
    else target.before(dragging);

    const newItems = [...list.querySelectorAll(ROW_SEL)].map(serializeRow);
    services.collections.reorder(collection.id, newItems);
  });
}

// ── Download job actions ──────────────────────────────────────────────────────

function initJobActions(block) {
  block.addEventListener('click', async (e) => {
    const resumeBtn = e.target.closest('.collection__job-resume');
    if (resumeBtn) {
      resumeBtn.disabled = true;
      resumeBtn.textContent = 'Checking…';
      await services.downloads.resume(resumeBtn.dataset.jobId);
      resumeBtn.disabled = false;
      resumeBtn.textContent = 'Check status';
    }

    const dlBtn = e.target.closest('.collection__job-download');
    if (dlBtn) {
      services.downloads.triggerDownload(dlBtn.dataset.jobId);
    }
  });
}

function refreshDownloadStatus(block) {
  const jobsSection = block.querySelector('.collection__jobs');
  if (!jobsSection) return;
  const collectionId = block.querySelector('[data-collection-id]')?.dataset?.collectionId;
  if (!collectionId) return;

  const pendingJobs = services.downloads.getAll().filter(
    (j) => j.collectionId === collectionId
      && (j.status === DownloadStatus.RUNNING || j.status === DownloadStatus.PENDING),
  );

  if (!pendingJobs.length) {
    jobsSection.remove();
    return;
  }
  jobsSection.outerHTML = renderJobsStatus(pendingJobs);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveCollectionId() {
  const id = new URLSearchParams(window.location.search).get('id') || '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    return id;
  }
  return services.collections.getActiveId();
}

function getVisibleRenditionDefs(assets) {
  if (!assets.length) return [];
  const seen = new Map();
  assets.forEach((asset) => {
    (asset.renditions || []).forEach((r) => {
      if (r.visible !== false && !seen.has(r.id)) {
        seen.set(r.id, { id: r.id, label: r.label || r.id });
      }
    });
  });
  return [...seen.values()];
}

function jobStatusLabel(job) {
  switch (job.status) {
    case DownloadStatus.PENDING: return 'Waiting to start…';
    case DownloadStatus.RUNNING: return 'Preparing your download…';
    case DownloadStatus.COMPLETE: return 'Ready to download';
    case DownloadStatus.FAILED: return `Failed: ${job.error || 'Unknown error'}`;
    default: return job.status;
  }
}
