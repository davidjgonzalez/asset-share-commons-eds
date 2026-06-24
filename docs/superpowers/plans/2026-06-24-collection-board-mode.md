# Collection Board Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Board" display mode to the collection block — an infinite canvas with drag-to-reposition cards, per-asset notes, and a `?sheet=` URL encoding that carries notes and expiry to the sheet block.

**Architecture:** The board renders inside a `.board__viewport` / `.board__canvas` DOM tree; CSS `transform` handles pan and zoom. Mode state persists per-collection in localStorage. Notes are stored on `AssetItem` via a new `updateItem()` service method that saves silently without triggering a re-render. Share URLs switch from `?items=&title=` to a single compressed JSON payload (`?sheet=`).

**Tech Stack:** Vanilla JS ES modules, CSS nesting, pointer events API, `localStorage`, existing `services.url.compressArray/decompressToArray`, existing `services.collections`, `services.renditions`.

## Global Constraints

- JS: 2-space indent, ES6+ modules, airbnb-base ESLint. No comments except non-obvious WHY.
- CSS: 4-space indent, stylelint-config-standard, CSS nesting, mobile-first. All values via CSS variables.
- No backward compat for `?items=`, `?assets=`, or `?title=` sheet URL params — they are dropped.
- No new npm dependencies.
- Run `npm run lint` after each task and fix all errors before committing.

## Files Modified

| File | Role |
|---|---|
| `scripts/asc/services/collections/collections.js` | Add `updateItem()` method |
| `blocks/collection/collection.js` | Mode toggle, board canvas, card drag, notes panel, updated share dialog |
| `blocks/collection/collection.css` | Board, card, notes panel, mode toggle, expires input styles |
| `blocks/sheet/sheet.js` | `?sheet=` parsing, expiry check, description, per-asset notes |
| `blocks/sheet/sheet.css` | Description, asset note, expired-state styles |

---

### Task 1: Service — `updateItem()` method

**Files:**
- Modify: `scripts/asc/services/collections/collections.js`

**Interfaces:**
- Consumes: existing `_getData()`, `_saveCollection()` from the same class (see `updateSection()` at line ~535 for the identical pattern)
- Produces: `services.collections.updateItem(collectionId, itemId, { x?, y?, notes? })` — called in Tasks 3 and 4

- [ ] **Step 1: Add the method to the class.** Open `scripts/asc/services/collections/collections.js`. After the `updateSection()` method (~line 546), insert:

```js
/**
 * Partially updates x, y, and/or notes on an asset item.
 * Does NOT dispatch CHANGED — callers update the DOM in real time.
 * @param {string} collectionId
 * @param {string} itemId - asset UUID
 * @param {{ x?: number, y?: number, notes?: string }} updates
 */
updateItem(collectionId, itemId, updates) {
  const data = this._getData();
  const collection = data.items[collectionId];
  if (!collection) return;
  const item = (collection.items || []).find(
    (i) => i.type === 'asset' && i.id === itemId,
  );
  if (!item) return;
  if (updates.x !== undefined) item.x = updates.x;
  if (updates.y !== undefined) item.y = updates.y;
  if (updates.notes !== undefined) item.notes = updates.notes;
  this._saveCollection(collection);
}
```

- [ ] **Step 2: Run lint.**

```bash
npm run lint:js -- scripts/asc/services/collections/collections.js
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Commit.**

```bash
git add scripts/asc/services/collections/collections.js
git commit -m "feat(collections): add updateItem() for x/y/notes partial updates"
```

---

### Task 2: Mode toggle + board canvas (pan, zoom, viewport persistence)

Adds the segmented mode toggle control, the board canvas DOM, and all pan/zoom/reset behavior. No asset cards yet — the canvas is empty and pannable. Verifiable by switching modes and panning/zooming the dot-grid background.

**Files:**
- Modify: `blocks/collection/collection.js`
- Modify: `blocks/collection/collection.css`

**Interfaces:**
- Produces: `getMode(id)`, `setMode(id, mode)`, `getViewport(id)`, `setViewport(id, state)` — used in Tasks 3 and 4
- Produces: `initBoard(block, collection)` — called by `initInteractions` in board mode

- [ ] **Step 1: Add module-level constants and state helpers.** Below the `_pendingSectionFocus` declaration at the top of `blocks/collection/collection.js`, add:

```js
// ─── Mode & viewport state ─────────────────────────────────────────────────────

const MODE_KEY = (id) => `asc:collectionMode:${id}`;
const VIEWPORT_KEY = (id) => `asc:boardViewport:${id}`;

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
```

- [ ] **Step 2: Update `render()` to read mode and pass it down.** Replace the existing `render` function:

```js
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
```

- [ ] **Step 3: Replace `html()` — add mode parameter, split toolbar, add board/list branching.** Replace the entire function:

```js
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
      <div class="collection__mode-toggle" role="group" aria-label="Display mode">
        <button type="button"
                class="collection__mode-btn${mode === 'list' ? ' collection__mode-btn--active' : ''}"
                data-mode="list" aria-pressed="${mode === 'list'}">&#9776; List</button>
        <button type="button"
                class="collection__mode-btn${mode === 'board' ? ' collection__mode-btn--active' : ''}"
                data-mode="board" aria-pressed="${mode === 'board'}">&#8862; Board</button>
      </div>
      <div class="collection__toolbar-end">
        <button type="button" class="collection__share-btn btn btn--secondary">Share</button>
        <button type="button" class="collection__download-btn btn btn--primary"
                ${assetCount === 0 ? 'disabled' : ''}>Download</button>
      </div>
    </div>

    ${pendingJobs.length ? renderJobsStatus(pendingJobs) : ''}

    ${mode === 'board' ? boardHtml(items) : listHtml(items)}
    </section>`;
}
```

- [ ] **Step 4: Extract existing list markup into `listHtml()` and add `boardHtml()` with a card placeholder.** After `html()`:

```js
function listHtml(items) {
  return `
    <div class="collection__asset-list">
      ${items.length
    ? items.map((item) => (item.type === 'section' ? sectionWidget(item) : assetRow(item))).join('')
    : '<p class="collection__empty">No assets in this collection yet.</p>'}
      <button type="button" class="collection__add-section btn btn--ghost">+ Add section</button>
    </div>`;
}

function boardHtml(items) {
  const assetItems = items.filter((i) => i.type === 'asset' && i.asset);
  return `
    <div class="board__viewport">
      <div class="board__canvas">
        ${assetItems.map((item, index) => boardCard(item, index)).join('')}
      </div>
      <button type="button" class="board__reset-view btn btn--ghost btn--sm">Reset view</button>
    </div>`;
}

// Placeholder — replaced in Task 3
function boardCard() { return ''; }
```

- [ ] **Step 5: Update `initInteractions()` — add mode parameter and branch.** Replace the existing function:

```js
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
  } else {
    initReorder(block, collection);
    initSections(block, collection);
    if (_pendingSectionFocus) {
      const input = block.querySelector(`[data-section-id="${_pendingSectionFocus}"] .collection__section-title`);
      input?.focus();
      _pendingSectionFocus = null;
    }
  }
}
```

- [ ] **Step 6: Add `initModeToggle()`.** After `initInteractions`:

```js
function initModeToggle(block, collectionId) {
  block.querySelectorAll('.collection__mode-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      setMode(collectionId, btn.dataset.mode);
      await render(block, collectionId);
    });
  });
}
```

- [ ] **Step 7: Add `initBoard()`.** After `initModeToggle`:

```js
function initBoard(block, collection) {
  const viewport = block.querySelector('.board__viewport');
  const canvas = block.querySelector('.board__canvas');
  if (!viewport || !canvas) return;

  let { panX, panY, zoom } = getViewport(collection.id);
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

  let panning = false;
  let lastX = 0;
  let lastY = 0;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.board__card')) return;
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
  });

  viewport.addEventListener('pointerup', () => {
    if (!panning) return;
    panning = false;
    viewport.classList.remove('board__viewport--panning');
    setViewport(collection.id, { panX, panY, zoom });
  });

  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 3.0;

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    panX = cursorX - (cursorX - panX) * (newZoom / zoom);
    panY = cursorY - (cursorY - panY) * (newZoom / zoom);
    zoom = newZoom;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    setViewport(collection.id, { panX, panY, zoom });
  }, { passive: false });

  block.querySelector('.board__reset-view')?.addEventListener('click', () => {
    panX = 0; panY = 0; zoom = 1;
    canvas.style.transform = 'translate(0px, 0px) scale(1)';
    setViewport(collection.id, { panX: 0, panY: 0, zoom: 1 });
  });
}
```

- [ ] **Step 8: Update `collection.css` — toolbar layout and board canvas rules.**

In the existing `.collection__toolbar` rule, change `justify-content: flex-end` to `justify-content: space-between`.

Then add these new rules inside `.block.collection { ... }` before the `@media` blocks:

```css
/* ── Mode toggle ─────────────────────────────────────────────────────── */

.collection__toolbar-end {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
}

.collection__mode-toggle {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    overflow: hidden;
}

.collection__mode-btn {
    padding: var(--spacing-xs) var(--spacing-sm);
    border: none;
    font-size: var(--body-font-size-s);
    font-family: inherit;
    background: var(--color-card);
    color: var(--color-muted-fg);
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast);

    &:hover:not(.collection__mode-btn--active) {
        background: var(--color-muted);
    }

    &.collection__mode-btn--active {
        background: var(--color-primary);
        color: var(--color-primary-fg);
    }
}

/* ── Board viewport & canvas ─────────────────────────────────────────── */

.board__viewport {
    position: relative;
    width: 100%;
    height: 70vh;
    min-height: 500px;
    overflow: hidden;
    background:
        radial-gradient(circle, var(--color-border) 1px, transparent 1px)
        0 0 / 24px 24px;
    border: 1px solid var(--color-border);
    border-radius: var(--collection-radius);
    cursor: grab;
    touch-action: none;
    user-select: none;

    &.board__viewport--panning {
        cursor: grabbing;
    }
}

.board__canvas {
    position: absolute;
    inset: 0;
    width: 0;
    height: 0;
    transform-origin: 0 0;
}

.board__reset-view {
    position: absolute;
    bottom: var(--spacing-sm);
    right: var(--spacing-sm);
    z-index: 10;
    background: var(--color-card);
    border-color: var(--color-border);
}
```

- [ ] **Step 9: Run lint.**

```bash
npm run lint
```

Expected: 0 errors on modified files.

- [ ] **Step 10: Manual smoke test.**
  - Open a collection; verify ≡ List and ⊞ Board buttons appear in the toolbar, left-aligned
  - Click ⊞ Board — dot-grid viewport renders (empty)
  - Click+drag on background — viewport pans
  - Scroll — zooms, centered on cursor position
  - Click Reset view — viewport snaps back to origin
  - Reload in Board mode — panX/panY/zoom are restored
  - Click ≡ List — list returns, reorder and sections work normally

- [ ] **Step 11: Commit.**

```bash
git add blocks/collection/collection.js blocks/collection/collection.css
git commit -m "feat(collection): mode toggle + board canvas with pan/zoom"
```

---

### Task 3: Board asset cards — render, drag to reposition, click to open, remove

After this task assets appear as draggable cards on the canvas. Position is saved per-asset.

**Files:**
- Modify: `blocks/collection/collection.js`
- Modify: `blocks/collection/collection.css`

**Interfaces:**
- Consumes: `getViewport(collectionId)` from Task 2, `services.collections.updateItem()` from Task 1
- Produces: module-level `_cardDragMoved` flag — read by the notes click handler in Task 4

- [ ] **Step 1: Add module-level drag-state flag.** Below `_pendingSectionFocus`, add:

```js
let _cardDragMoved = false;
```

- [ ] **Step 2: Replace the `boardCard()` placeholder.** Delete the stub from Task 2 and replace with:

```js
function boardCard(item, index) {
  const { asset, notes } = item;
  const x = item.x !== undefined ? item.x : 80 + (index % 10) * 180;
  const y = item.y !== undefined ? item.y : 80 + Math.floor(index / 10) * 160;
  const thumbnailUrl = services.renditions.getThumbnailUrl(asset);
  return `
    <div class="board__card"
         style="left: ${x}px; top: ${y}px"
         data-asc-asset="${escAttr(asset.uuid)}">
      <button type="button"
              class="board__card-remove"
              data-asc-asset="${escAttr(asset.uuid)}"
              aria-label="Remove ${escHtml(asset.title)} from collection">&#x2715;</button>
      <div class="board__card-thumb">
        <img src="${thumbnailUrl}" alt="${escHtml(asset.title)}" loading="lazy" />
      </div>
      <div class="board__card-body">
        <p class="board__card-title">${escHtml(asset.title)}</p>
        ${notes ? `<p class="board__card-notes-preview">${escHtml(notes)}</p>` : ''}
        <button type="button"
                class="board__card-notes-btn"
                data-asc-asset="${escAttr(asset.uuid)}">${notes ? '&#128221;' : '+ note'}</button>
      </div>
    </div>`;
}
```

- [ ] **Step 3: Add `initCardDrag()`.** After `initBoard()`:

```js
function initCardDrag(block, collection) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.board__card');
    if (!card) return;
    if (e.target.closest('.board__card-remove, .board__card-notes-btn')) return;

    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseFloat(card.style.left) || 0;
    const startTop = parseFloat(card.style.top) || 0;
    _cardDragMoved = false;

    const { zoom } = getViewport(collection.id);
    card.setPointerCapture(e.pointerId);
    card.classList.add('board__card--dragging');

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) _cardDragMoved = true;
      if (!_cardDragMoved) return;
      card.style.left = `${startLeft + dx / zoom}px`;
      card.style.top = `${startTop + dy / zoom}px`;
    }

    function onUp() {
      card.classList.remove('board__card--dragging');
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      if (_cardDragMoved) {
        const x = Math.round(parseFloat(card.style.left));
        const y = Math.round(parseFloat(card.style.top));
        services.collections.updateItem(collection.id, card.dataset.ascAsset, { x, y });
      }
    }

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
  });
}
```

- [ ] **Step 4: Add `initBoardClicks()`.** After `initCardDrag()`:

```js
function initBoardClicks(block, collection) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.board__card-remove');
    if (removeBtn) {
      services.collections.removeAsset(collection.id, removeBtn.dataset.ascAsset);
      return;
    }

    const notesBtn = e.target.closest('.board__card-notes-btn');
    if (notesBtn) {
      const card = notesBtn.closest('.board__card');
      if (card) openNotesPanel(block, collection, card);
      return;
    }

    const card = e.target.closest('.board__card');
    if (card) {
      if (!_cardDragMoved) {
        // Open asset details — same mechanism as data-asc-action="asset:details:open@click"
        // Verify the event name against AGENTS.md → Event Reference before shipping
        const assetId = card.dataset.ascAsset;
        const asset = window.asc?.cache?.assets?.get(assetId);
        document.body.dispatchEvent(new CustomEvent('asc:asset:details:open', {
          bubbles: true,
          detail: { id: assetId, asset },
        }));
      }
      _cardDragMoved = false;
    }
  });
}
```

Note: `openNotesPanel` is a forward reference — it will be defined in Task 4. The click handler for notes will not fire until that function exists, but the event wiring is safe to add now.

- [ ] **Step 5: Update `initInteractions()` board branch.** Replace the `if (mode === 'board')` block:

```js
if (mode === 'board') {
  initBoard(block, collection);
  initCardDrag(block, collection);
  initBoardClicks(block, collection);
} else {
  initReorder(block, collection);
  initSections(block, collection);
  if (_pendingSectionFocus) {
    const input = block.querySelector(`[data-section-id="${_pendingSectionFocus}"] .collection__section-title`);
    input?.focus();
    _pendingSectionFocus = null;
  }
}
```

- [ ] **Step 6: Add board card CSS.** Inside `.block.collection { ... }`, after `.board__reset-view`:

```css
/* ── Board cards ─────────────────────────────────────────────────────── */

.board__card {
    position: absolute;
    width: 160px;
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-sm);
    user-select: none;
    transition: box-shadow var(--transition-fast);

    &:hover {
        box-shadow: var(--shadow-md);
    }

    &.board__card--dragging {
        opacity: 0.85;
        box-shadow: var(--shadow-lg);
        cursor: grabbing;
        z-index: 100;
    }
}

.board__card-remove {
    position: absolute;
    top: var(--spacing-2xs);
    right: var(--spacing-2xs);
    display: none;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--color-destructive);
    color: #fff;
    font-size: 10px;
    line-height: 1;
    cursor: pointer;
    z-index: 1;

    .board__card:hover & {
        display: flex;
        align-items: center;
        justify-content: center;
    }
}

.board__card-thumb {
    width: 160px;
    height: 120px;
    border-radius: var(--border-radius-md) var(--border-radius-md) 0 0;
    overflow: hidden;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
}

.board__card-body {
    padding: var(--spacing-xs) var(--spacing-sm) var(--spacing-sm);
}

.board__card-title {
    margin: 0 0 var(--spacing-2xs);
    font-size: var(--body-font-size-xs);
    font-weight: 500;
    color: var(--color-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.board__card-notes-preview {
    margin: 0 0 var(--spacing-2xs);
    font-size: 11px;
    font-style: italic;
    color: var(--color-muted-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.board__card-notes-btn {
    display: block;
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    color: transparent;
    cursor: pointer;
    font-family: inherit;

    .board__card:hover & {
        color: var(--color-muted-fg);
    }
}
```

- [ ] **Step 7: Run lint.**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 8: Manual smoke test.**
  - Open collection in Board mode — asset cards appear in a 10-column cascade
  - Drag a card — it moves; on release, reload and confirm position is restored
  - Click a card (< 5px movement) — asset details modal opens
  - Hover a card — ✕ appears; clicking it removes the asset and the card disappears
  - Cards without notes show faint "+ note" on hover in the card footer

- [ ] **Step 9: Commit.**

```bash
git add blocks/collection/collection.js blocks/collection/collection.css
git commit -m "feat(collection): board card render, drag-to-reposition, remove"
```

---

### Task 4: Notes — floating panel on board, inline edit in list mode

After this task, users can annotate assets in both modes. Notes persist via `updateItem()`.

**Files:**
- Modify: `blocks/collection/collection.js`
- Modify: `blocks/collection/collection.css`

**Interfaces:**
- Consumes: `services.collections.updateItem()` from Task 1; `_cardDragMoved` from Task 3
- Produces: `item.notes` visible in `assetRow()` HTML — read by Task 5 share encoding

- [ ] **Step 1: Update `assetRow()` to display notes.** Replace the entire function:

```js
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
```

- [ ] **Step 2: Add `initListNotes()`.** After `initSections()`:

```js
function initListNotes(block, collection) {
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
```

- [ ] **Step 3: Update `initInteractions()` list branch to call `initListNotes`.** Inside the `else` block:

```js
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
```

- [ ] **Step 4: Add `openNotesPanel()` and `updateCardNotes()`.** After `initBoardClicks()`:

```js
function openNotesPanel(block, collection, card) {
  block.querySelector('.board__notes-panel')?.remove();

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

  const cardRect = card.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const panelWidth = 220;
  const leftCandidate = cardRect.right - viewportRect.left + 8;
  const left = leftCandidate + panelWidth > viewportRect.width
    ? cardRect.left - viewportRect.left - panelWidth - 8
    : leftCandidate;
  panel.style.left = `${Math.max(4, left)}px`;
  panel.style.top = `${Math.max(4, cardRect.top - viewportRect.top)}px`;

  const textarea = panel.querySelector('.board__notes-textarea');
  textarea.focus();
  textarea.select();

  function saveAndClose() {
    const notes = textarea.value.trim();
    services.collections.updateItem(collection.id, assetId, { notes });
    updateCardNotes(card, notes);
    panel.remove();
  }

  panel.querySelector('.board__notes-done').addEventListener('click', saveAndClose);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { textarea.value = currentNotes; saveAndClose(); }
  });

  setTimeout(() => {
    function onOutsideClick(e) {
      if (!panel.contains(e.target) && !card.contains(e.target)) {
        saveAndClose();
        document.removeEventListener('click', onOutsideClick);
      }
    }
    document.addEventListener('click', onOutsideClick);
  }, 0);
}

function updateCardNotes(card, notes) {
  let preview = card.querySelector('.board__card-notes-preview');
  const notesBtn = card.querySelector('.board__card-notes-btn');
  if (notes) {
    if (!preview) {
      preview = document.createElement('p');
      preview.className = 'board__card-notes-preview';
      card.querySelector('.board__card-body').insertBefore(preview, notesBtn);
    }
    preview.textContent = notes;
    if (notesBtn) notesBtn.textContent = '📝';
  } else {
    preview?.remove();
    if (notesBtn) notesBtn.textContent = '+ note';
  }
}
```

- [ ] **Step 5: Add CSS for notes.** Inside `.block.collection { ... }`, after `.board__reset-view`:

```css
/* ── Board notes panel ───────────────────────────────────────────────── */

.board__notes-panel {
    position: absolute;
    width: 220px;
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-lg);
    padding: var(--spacing-sm);
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
}

.board__notes-textarea {
    width: 100%;
    resize: vertical;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-xs);
    font-size: var(--body-font-size-s);
    font-family: inherit;
    background: var(--color-input);
    color: var(--color-fg);
    box-sizing: border-box;

    &:focus-visible {
        outline: none;
        border-color: var(--color-ring);
        box-shadow: var(--focus-ring);
    }
}

.board__notes-actions {
    display: flex;
    justify-content: flex-end;
}

/* ── List mode notes ─────────────────────────────────────────────────── */

.collection__asset-note {
    font-size: var(--body-font-size-xs);
    font-style: italic;
    color: var(--color-muted-fg);
    margin-block-start: var(--spacing-2xs);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
        color: var(--color-fg);
    }
}

.collection__asset-add-note {
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    font-size: var(--body-font-size-xs);
    color: transparent;
    cursor: pointer;
    font-family: inherit;
    margin-block-start: var(--spacing-2xs);

    .collection__asset-row:hover & {
        color: var(--color-muted-fg);
    }

    &:hover {
        /* stylelint-disable-next-line declaration-no-important */
        color: var(--color-primary) !important;
    }
}

.collection__asset-note-edit {
    display: block;
    width: 100%;
    margin-block-start: var(--spacing-2xs);
    padding: var(--spacing-2xs) var(--spacing-xs);
    border: 1px solid var(--color-ring);
    border-radius: var(--border-radius-sm);
    font-size: var(--body-font-size-xs);
    font-style: italic;
    font-family: inherit;
    background: var(--color-input);
    color: var(--color-fg);
    resize: vertical;
    box-sizing: border-box;

    &:focus-visible {
        outline: none;
        box-shadow: var(--focus-ring);
    }
}
```

- [ ] **Step 6: Run lint.**

```bash
npm run lint
```

- [ ] **Step 7: Manual smoke test.**
  - **List mode:** hover an asset row → faint "+ add note" appears; click → inline textarea opens; type a note; click elsewhere → italic note saved
  - Click the note text → edit reopens; clear it; click elsewhere → "+ add note" reappears
  - Press Escape while editing → reverts to original value
  - **Board mode:** switch to Board; hover a card → "+ note" visible in footer; click → floating panel appears next to card; type note; click Done → card body shows note text and 📝 icon
  - Click 📝 → panel reopens; press Escape → no change; click outside → saves and closes
  - Reload page → notes persist in both modes (stored via `updateItem`)

- [ ] **Step 8: Commit.**

```bash
git add blocks/collection/collection.js blocks/collection/collection.css
git commit -m "feat(collection): per-asset notes — board floating panel + list inline edit"
```

---

### Task 5: Share dialog — `?sheet=` URL format with description and expiry

Replaces the `?items=&title=` format with a single compressed JSON payload. Asset notes are encoded inline in the items array.

**Files:**
- Modify: `blocks/collection/collection.js`
- Modify: `blocks/collection/collection.css`

**Interfaces:**
- Consumes: `item.notes` (from Task 4), `collection.items` mixed array, `services.url.compressArray`
- Produces: `?sheet=<compressed>` URLs consumed by Task 6

- [ ] **Step 1: Replace `openShareDialog()` entirely.** The complete new function:

```js
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
```

- [ ] **Step 2: Add CSS for the expires input group.** Inside `.block.collection { ... }`, after `.collection__share-url-wrap`:

```css
.collection__share-expires-wrap {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin-block-start: var(--spacing-2xs);

    input[type="number"] {
        width: 80px;
        padding: var(--input-padding-y) var(--input-padding-x);
        border: 1px solid var(--color-border);
        border-radius: var(--input-border-radius);
        font-size: var(--body-font-size-s);
        font-weight: 400;
        text-transform: none;
        letter-spacing: normal;
        background: var(--color-input);
        color: var(--color-fg);
        font-family: inherit;
        transition: var(--input-transition);

        &:focus-visible {
            outline: none;
            border-color: var(--color-ring);
            box-shadow: var(--focus-ring);
        }
    }
}

.collection__share-expires-unit {
    font-size: var(--body-font-size-s);
    color: var(--color-fg);
}
```

- [ ] **Step 3: Run lint.**

```bash
npm run lint
```

- [ ] **Step 4: Manual smoke test.**
  - Open Share dialog — three fields visible: Title, Description, Expires in
  - Fill all three and Generate Link → URL contains `?sheet=` (not `?items=`)
  - Decode the URL param manually in the console:
    ```js
    await services.url.decompressToArray(new URLSearchParams(location.search).get('sheet'))
    // → ['{"title":"...","description":"...","expiresAt":"...","items":[...]}']
    ```
  - Leave Expires in blank → no `expiresAt` in decoded payload
  - Add a note to an asset first, then generate → item appears as `uuid|||note text` in items array
  - Share history shows new URLs; Copy buttons work

- [ ] **Step 5: Commit.**

```bash
git add blocks/collection/collection.js blocks/collection/collection.css
git commit -m "feat(collection): share dialog — ?sheet= payload with description, expiry, notes"
```

---

### Task 6: Sheet block — `?sheet=` parsing, expiry check, description, per-asset notes

Replaces the old multi-param parsing with a single `?sheet=` decoder. Renders description, per-asset notes, and an expiry message.

**Files:**
- Modify: `blocks/sheet/sheet.js`
- Modify: `blocks/sheet/sheet.css`

**Interfaces:**
- Consumes: `?sheet=<compressed>` from Task 5; existing `services.url.decompressToArray`, `services.renditions`, `services.search`
- Produces: rendered sheet page

- [ ] **Step 1: Replace `decorate()`.** The complete updated function:

```js
export default async function decorate(block) {
  const params = new URLSearchParams(window.location.search);
  const {
    mixedItems, assetMap, renditionDefinitions, title, description, expiresAt,
  } = await getDataFromSearchParams(params);

  if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
    block.innerHTML = expiredHtml(expiresAt);
    return;
  }

  const assetCount = mixedItems.filter((i) => i.type === 'asset').length;
  block.innerHTML = html(mixedItems, assetMap, renditionDefinitions, title, description, assetCount);

  initRenditionSwitcher(block);
  initDragAndDrop(block);
}
```

- [ ] **Step 2: Add `expiredHtml()`.** Before `html()`:

```js
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
```

- [ ] **Step 3: Replace `html()`.** The complete updated function:

```js
function html(mixedItems, assetMap, renditionDefinitions, title, description, assetCount) {
  const rows = mixedItems.map((item) => {
    if (item.type === 'section') return sectionHeading(item);
    const asset = assetMap.get(item.id);
    return asset ? assetRow(asset, renditionDefinitions, item.notes) : '';
  }).join('');

  return `
    <a href="/" class="sheet__back">&#8592; Back to search</a>
    <h1 class="sheet__title">${escHtml(title) || 'Download Sheet'}</h1>
    ${description ? `<p class="sheet__description">${escHtml(description)}</p>` : ''}
    <p class="sheet__count">${assetCount} asset${assetCount === 1 ? '' : 's'}</p>
    <div class="sheet__asset-list">
      ${rows || '<p class="sheet__empty">No assets selected.</p>'}
    </div>
  `;
}
```

- [ ] **Step 4: Update `assetRow()` — add `notes` parameter.** Replace the entire function:

```js
function assetRow(asset, renditionDefinitions, notes) {
  const thumbnailUrl = services.renditions.getThumbnailUrl(asset);
  const fileType = asset.getProperty('file-type') || '';
  const fileSize = asset.getProperty('file-size') || '';
  const defaultRenditionId = renditionDefinitions[0]?.id || '';

  const pills = renditionDefinitions.map((def) => `
    <button class="btn btn--ghost btn--sm sheet__rendition-pill${def.id === defaultRenditionId ? ' sheet__rendition-pill--active' : ''}"
            data-rendition-id="${def.id}"
            aria-pressed="${def.id === defaultRenditionId}"
            type="button">
      ${escHtml(def.label || def.id)}
    </button>
  `).join('');

  const meta = [fileType, fileSize].filter(Boolean).join(' · ');

  return `
    <div class="sheet__asset-row"
         data-asc-asset="${asset.uuid}"
         data-asc-mime-type="${asset.mimeType || ''}"
         data-selected-rendition="${defaultRenditionId}"
         draggable="true">
      <div class="asc-ui-thumb sheet__asset-thumb">
        <img src="${thumbnailUrl}"
             alt="${escHtml(asset.title)}"
             loading="lazy"
             onerror="this.parentElement.classList.add('sheet__asset-thumb--error')" />
        <span class="sheet__asset-thumb-fallback" aria-hidden="true">${getFileIcon(fileType)}</span>
      </div>
      <div class="sheet__asset-info">
        <p class="asc-ui-asset-row__title">${escHtml(asset.title)}</p>
        ${meta ? `<p class="asc-ui-asset-row__meta">${escHtml(meta)}</p>` : ''}
        ${notes ? `<p class="sheet__asset-note">${escHtml(notes)}</p>` : ''}
      </div>
      <div class="sheet__asset-renditions" role="group" aria-label="Select rendition for ${escHtml(asset.title)}">
        ${pills || '<span class="sheet__no-renditions">&#8212;</span>'}
      </div>
      <div class="sheet__asset-actions">
        <a class="btn btn--primary btn--sm sheet__download-btn"
           href="#"
           download
           data-asc-asset="${asset.uuid}">
          Download
        </a>
      </div>
    </div>
  `;
}
```

- [ ] **Step 5: Replace `getDataFromSearchParams()` — `?sheet=` only, no legacy formats.**

```js
async function getDataFromSearchParams(queryParameters) {
  const renditionsCompressed = queryParameters.get('renditions');
  const renditionIds = renditionsCompressed
    ? await services.url.decompressToArray(renditionsCompressed)
    : [];
  const renditionDefinitions = renditionIds
    .map((id) => services.renditions.getRenditionDefinition(id))
    .filter(Boolean);

  const sheetParam = queryParameters.get('sheet');
  if (!sheetParam) {
    return {
      mixedItems: [], assetMap: new Map(), renditionDefinitions,
      title: '', description: '', expiresAt: null,
    };
  }

  const [json] = await services.url.decompressToArray(sheetParam);
  const {
    title = '', description = '', expiresAt = null, items = [],
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
    if (sepIdx !== -1) {
      return { type: 'asset', id: entry.slice(0, sepIdx), notes: entry.slice(sepIdx + 3) };
    }
    return { type: 'asset', id: entry };
  });

  const assetIds = mixedItems.filter((i) => i.type === 'asset').map((i) => i.id);
  const fetchedAssets = await Promise.all(assetIds.map((id) => services.search.getAssetById(id)));
  const assetMap = new Map(fetchedAssets.filter(Boolean).map((a) => [a.uuid, a]));

  return {
    mixedItems, assetMap, renditionDefinitions, title, description, expiresAt,
  };
}
```

- [ ] **Step 6: Add CSS to `blocks/sheet/sheet.css`.** Inside `.block.sheet { ... }`, before the closing `}`:

```css
/* ── Collection description ──────────────────────────────────────────── */

.sheet__description {
    color: var(--color-muted-fg);
    font-size: var(--body-font-size-s);
    line-height: 1.6;
    margin-block: calc(-1 * var(--spacing-xs)) var(--spacing-lg, 24px);
}

/* ── Per-asset notes ─────────────────────────────────────────────────── */

.sheet__asset-note {
    margin-block: var(--spacing-2xs) 0;
    font-size: var(--body-font-size-xs);
    font-style: italic;
    color: var(--color-muted-fg);
    line-height: 1.4;
}

/* ── Expired link ────────────────────────────────────────────────────── */

.sheet__expired {
    text-align: center;
    padding: var(--spacing-3xl) var(--spacing-md);
}

.sheet__expired-title {
    font-size: var(--heading-font-size-l);
    font-weight: 700;
    margin: 0 0 var(--spacing-sm);
    color: var(--color-fg);
}

.sheet__expired-message {
    margin: 0;
    color: var(--color-muted-fg);
    font-size: var(--body-font-size-s);
}
```

- [ ] **Step 7: Run lint.**

```bash
npm run lint
```

Expected: 0 errors on modified files.

- [ ] **Step 8: Manual end-to-end test.**
  - Generate a share URL from the collection Share dialog (Task 5); open it in a new tab
  - Page renders: title, description paragraph, asset count, asset rows
  - Per-asset notes appear as italic text below the asset title/meta line
  - Section headings appear between assets in the correct order
  - Open a URL with `?sheet=` param missing → "No assets selected." renders, no JS errors
  - Generate a URL with "Expires in: 1" day, manually adjust `expiresAt` in the payload to yesterday, re-compress and open → "This link has expired" message with the date, no asset list
  - Rendition pills work; switching pills updates the download href
  - Drag an asset row to macOS Finder → file downloads (existing functionality preserved)

- [ ] **Step 9: Commit.**

```bash
git add blocks/sheet/sheet.js blocks/sheet/sheet.css
git commit -m "feat(sheet): ?sheet= payload — expiry check, description, per-asset notes"
```
