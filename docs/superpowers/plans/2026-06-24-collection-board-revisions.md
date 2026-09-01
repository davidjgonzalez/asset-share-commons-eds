# Collection Board Mode — Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise the existing board mode with UI Kit alignment, zoom-to-fit on load, notes panel that tracks the board, multi-select with group drag, text elements, and full-card drag affordance.

**Architecture:** The board is already implemented as a `.board__canvas` (`transform: translate/scale`) inside a `.board__viewport`. Tasks layer on top of that infrastructure: Task 1 aligns the card markup with the UI Kit; Task 2 adds fit-to-viewport on load; Task 3 makes the notes panel reposition on pan/zoom; Task 4 adds rubber-band multi-select and group drag; Task 5 adds text elements stored per-board in localStorage and participating in multi-select.

**Tech Stack:** Vanilla JS ES modules, CSS custom properties, AEM EDS (no build step), airbnb-base ESLint, stylelint-config-standard.

## Global Constraints

- All files under `scripts/asc/` begin with `// ASC Core — do not edit.` — **never touch them**.
- Only user-owned files modified here: `blocks/collection/collection.js`, `blocks/collection/collection.css`.
- **CSS:** 4-space indent; CSS nesting inside `.block.collection { }`; all colors via `var(--color-*)`, no hardcoded values; mobile-first media queries use `width <=` syntax.
- **JS:** 2-space indent; no comments unless WHY is non-obvious; airbnb-base lint.
- **UI Kit rule:** Use `asc-ui-*` / `.btn` primitives; block-scope CSS adds only layout overrides (position, size). Never override kit visual styles inside a block.
- Verify lint after each task: `npx eslint blocks/collection/collection.js && npx stylelint blocks/collection/collection.css`.

---

### Task 1: UI Kit alignment — board cards, mode toggle, notes button, notes indicator, drag affordance

**Files:**
- Modify: `blocks/collection/collection.js` — `boardCard()`, `updateCardNotes()`, `html()`, `initModeToggle()`, `initBoardClicks()`
- Modify: `blocks/collection/collection.css` — board card section, mode toggle section

**Interfaces:**
- Produces: board card DOM uses `asc-ui-asset-card` root class; remove button is `.board__card-remove`; notes button class is `.board__notes-btn` (was `.board__card-notes-btn`); notes badge is `.board__notes-indicator`; mode toggle uses `asc-ui-segmented`. All later tasks reference these new selectors.

- [ ] **Step 1: Replace `boardCard()` with UI Kit markup**

Locate `boardCard(item, index)` in `blocks/collection/collection.js` (around line 172) and replace the entire function body:

```js
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
```

Key changes vs old markup:
- Root element is `article.asc-ui-asset-card.board__card`
- Remove button uses `asc-ui-icon-btn board__card-remove` inside `__overlay` div
- `draggable="false"` on `<img>` prevents browser native image drag interfering with pointer events
- Notes indicator `board__notes-indicator` in `__badge` slot
- Notes button is `btn btn--ghost btn--sm board__notes-btn` (renamed from `.board__card-notes-btn`)

- [ ] **Step 2: Update `updateCardNotes()` for new selectors**

Replace the entire `updateCardNotes` function (around line 479):

```js
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
```

- [ ] **Step 3: Update `initBoardClicks()` selector for notes button**

In `initBoardClicks` (around line 500), change:
```js
const notesBtn = e.target.closest('.board__card-notes-btn');
```
To:
```js
const notesBtn = e.target.closest('.board__notes-btn');
```

- [ ] **Step 4: Update `initCardDrag()` exclusion selector**

In `initCardDrag` (around line 380), change the exclusion line to:
```js
if (e.target.closest('.board__card-remove, .board__notes-btn')) return;
```

- [ ] **Step 5: Replace mode toggle in `html()` with `asc-ui-segmented`**

In `html()` (around line 130), replace:
```js
      <div class="collection__mode-toggle" role="group" aria-label="Display mode">
        <button type="button"
                class="collection__mode-btn${mode === 'list' ? ' collection__mode-btn--active' : ''}"
                data-mode="list" aria-pressed="${mode === 'list'}">&#9776; List</button>
        <button type="button"
                class="collection__mode-btn${mode === 'board' ? ' collection__mode-btn--active' : ''}"
                data-mode="board" aria-pressed="${mode === 'board'}">&#8862; Board</button>
      </div>
```
With:
```js
      <div class="asc-ui-segmented asc-ui-segmented--sm collection__mode-toggle" role="group" aria-label="Display mode">
        <button type="button"
                class="asc-ui-segmented__option${mode === 'list' ? ' is-active' : ''}"
                data-mode="list" aria-pressed="${mode === 'list'}">&#9776; List</button>
        <button type="button"
                class="asc-ui-segmented__option${mode === 'board' ? ' is-active' : ''}"
                data-mode="board" aria-pressed="${mode === 'board'}">&#8862; Board</button>
      </div>
```

- [ ] **Step 6: Update `initModeToggle()` selector**

In `initModeToggle` (around line 299), change:
```js
block.querySelectorAll('.collection__mode-btn').forEach((btn) => {
```
To:
```js
block.querySelectorAll('.asc-ui-segmented__option[data-mode]').forEach((btn) => {
```

- [ ] **Step 7: Replace board card CSS and mode toggle CSS**

In `blocks/collection/collection.css`:

**Replace the entire `/* ── Mode toggle */` section** (the `.collection__mode-toggle`, `.collection__mode-btn`, `.collection__mode-btn--active`, `.collection__toolbar-end` rules — but KEEP `.collection__toolbar-end`). The mode toggle visual styling now comes from `asc-ui-segmented` in `ui-kit.css`. The block only needs:

```css
    /* ── Mode toggle — visual styles from asc-ui-segmented in ui-kit.css ─── */

    .collection__toolbar-end {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
    }
```

**Replace the entire `/* ── Board cards */` section** (the `.board__card`, `.board__card-remove`, `.board__card-thumb`, `.board__card-body`, `.board__card-title`, `.board__card-notes-preview`, `.board__card-notes-btn` rules) with:

```css
    /* ── Board cards — visual base from asc-ui-asset-card in ui-kit.css ─── */

    .board__card.asc-ui-asset-card {
        position: absolute;
        width: 160px;
        cursor: default;

        &.board__card--selected {
            outline: 2px solid var(--color-primary);
            outline-offset: 2px;
            box-shadow: var(--shadow-md);
        }

        &.board__card--dragging {
            opacity: 0.85;
            box-shadow: var(--shadow-lg);
            cursor: grabbing;
            z-index: 100;
        }

        .asc-ui-asset-card__overlay {
            opacity: 0;
            transition: opacity var(--transition-fast);
        }

        &:hover .asc-ui-asset-card__overlay,
        &.board__card--selected .asc-ui-asset-card__overlay {
            opacity: 1;
        }
    }

    .board__card-notes-preview {
        margin: 0;
        font-size: var(--body-font-size-2xs);
        font-style: italic;
        color: var(--color-muted-fg);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .board__notes-btn {
        width: 100%;
        justify-content: flex-start;
        opacity: 0;
        transition: opacity var(--transition-fast);

        .board__card:hover & {
            opacity: 1;
        }
    }

    .board__notes-indicator {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: var(--border-radius-sm);
        background: color-mix(in srgb, var(--color-primary) 15%, var(--color-card));
        border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
        font-size: 0.7rem;
    }
```

- [ ] **Step 8: Run lint**

```bash
npx eslint blocks/collection/collection.js
npx stylelint blocks/collection/collection.css
```

Expected: no errors in changed files. Fix any errors before committing.

- [ ] **Step 9: Visual verification with `aem up`**

Open a collection in board mode and verify:
- Cards use the UI Kit card style (border-radius, shadow, kit thumb proportions)
- Notes indicator (📝) appears in top-left badge slot when card has notes; absent otherwise
- Remove (✕) button appears as a circular icon button on card hover, top-right
- "Edit note" / "+ Note" button appears on card hover, inside card body
- Mode toggle looks like a pill segmented control (rounded background container, filled active option)
- Drag card from image area → drags correctly (no browser image drag interference)

- [ ] **Step 10: Commit**

```bash
git add blocks/collection/collection.js blocks/collection/collection.css
git commit -m "feat(collection): board UI Kit alignment — asc-ui-asset-card, asc-ui-segmented, notes indicator"
```

---

### Task 2: Zoom-to-fit on initial board load

**Files:**
- Modify: `blocks/collection/collection.js` — new `computeFitViewport()`, updated `initBoard()`, updated `boardHtml()`

**Interfaces:**
- Produces: `computeFitViewport(cards, viewport)` → `{ panX, panY, zoom }` — pure function computing fit with 10% padding; applied in `initBoard` when no saved viewport; "Fit view" button (renamed from "Reset view") also applies fit.

- [ ] **Step 1: Add `computeFitViewport()` function**

Add this function just above `initBoard` in `blocks/collection/collection.js`:

```js
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
```

- [ ] **Step 2: Apply fit on initial load in `initBoard()`**

In `initBoard`, replace the current viewport state initialization:

```js
let { panX, panY, zoom } = getViewport(collection.id);
canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
```

With:

```js
const hasSavedViewport = localStorage.getItem(VIEWPORT_KEY(collection.id)) !== null;
let { panX, panY, zoom } = getViewport(collection.id);

if (!hasSavedViewport) {
  const allCards = [...canvas.querySelectorAll('.board__card, .board__text-element')];
  const fit = computeFitViewport(allCards, viewport);
  ({ panX, panY, zoom } = fit);
  setViewport(collection.id, fit);
}
canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
```

- [ ] **Step 3: Update "Fit view" button handler in `initBoard()`**

Find the reset-view click handler (around line 366) and replace:

```js
block.querySelector('.board__reset-view')?.addEventListener('click', () => {
  panX = 0; panY = 0; zoom = 1;
  canvas.style.transform = 'translate(0px, 0px) scale(1)';
  setViewport(collection.id, { panX: 0, panY: 0, zoom: 1 });
});
```

With:

```js
block.querySelector('.board__reset-view')?.addEventListener('click', () => {
  const allCards = [...canvas.querySelectorAll('.board__card, .board__text-element')];
  const fit = computeFitViewport(allCards, viewport);
  ({ panX, panY, zoom } = fit);
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  setViewport(collection.id, fit);
});
```

- [ ] **Step 4: Rename button label in `boardHtml()`**

In `boardHtml()`, change:
```js
<button type="button" class="board__reset-view btn btn--ghost btn--sm">Reset view</button>
```
To:
```js
<button type="button" class="board__reset-view btn btn--ghost btn--sm">Fit view</button>
```

- [ ] **Step 5: Verify**
- First time opening a collection in board mode (no saved viewport): cards fit in view with ~10% margin
- Pan or zoom, then refresh: viewport restores to saved state
- Click "Fit view": zooms to fit all cards

- [ ] **Step 6: Lint and commit**
```bash
npx eslint blocks/collection/collection.js
git add blocks/collection/collection.js
git commit -m "feat(collection): board zoom-to-fit on initial load; Fit view button"
```

---

### Task 3: Notes panel repositions on board pan/zoom

**Files:**
- Modify: `blocks/collection/collection.js` — module-level `_openPanelState`, new `positionPanel()`, `repositionOpenPanel()`, updated `openNotesPanel()`, updated `initBoard()` pan/zoom handlers

**Interfaces:**
- Produces: `_openPanelState` (module-level `{ panel, card, viewport } | null`); `positionPanel(panel, card, viewport)` → void; `repositionOpenPanel()` → void; pan `pointermove` and zoom `wheel` handlers call `repositionOpenPanel()` after each transform update.

- [ ] **Step 1: Add module-level panel state**

After `let _openPanelState = null;` (add after `let _cardDragMoved = false;` if not already present):

```js
let _openPanelState = null;
```

- [ ] **Step 2: Add `positionPanel()` and `repositionOpenPanel()`**

Add both functions immediately before `openNotesPanel`:

```js
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
```

- [ ] **Step 3: Update `openNotesPanel()` to set `_openPanelState` and use `positionPanel()`**

Replace `openNotesPanel` entirely:

```js
function openNotesPanel(block, collection, card) {
  block.querySelector('.board__notes-panel')?.remove();
  _openPanelState = null;

  const assetId = card.dataset.ascAsset;
  const currentNotes = card.querySelector('.board__card-notes-preview')?.textContent || '';
  const viewport = block.querySelector('.board__viewport');

  const panel = document.createElement('div');
  panel.className = 'board__notes-panel';
  panel.innerHTML = `
    <textarea class="board__notes-textarea"
              placeholder="Add a note about this asset…"
              rows="4">${escHtml(currentNotes)}</textarea>
    <div class="board__notes-actions">
      <button type="button" class="btn btn--primary btn--sm board__notes-done">Done</button>
    </div>`;

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
      if (!panel.contains(e.target) && !card.contains(e.target)) saveAndClose();
    }
    document.addEventListener('click', onOutsideClick);
    removeOutsideClick = () => document.removeEventListener('click', onOutsideClick);
  }, 0);
}
```

- [ ] **Step 4: Call `repositionOpenPanel()` in pan and zoom handlers**

In `initBoard`, in the `pointermove` (pan) handler, add `repositionOpenPanel();` after the transform update:

```js
viewport.addEventListener('pointermove', (e) => {
  if (!panning) return;
  panX += e.clientX - lastX;
  panY += e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  repositionOpenPanel();
});
```

In the `wheel` (zoom) handler, add `repositionOpenPanel();` after the transform update:

```js
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
  repositionOpenPanel();
}, { passive: false });
```

- [ ] **Step 5: Verify**
- Open notes on a card → panel appears adjacent to card
- Pan board → panel moves with the card, stays adjacent; panel text does NOT scale
- Zoom in/out → panel repositions to stay next to card; panel size stays constant
- Press Escape or Done → panel removes cleanly

- [ ] **Step 6: Lint and commit**
```bash
npx eslint blocks/collection/collection.js
git add blocks/collection/collection.js
git commit -m "feat(collection): notes panel tracks card during board pan/zoom"
```

---

### Task 4: Multi-select — rubber-band selection and group drag

**Files:**
- Modify: `blocks/collection/collection.js` — module-level `_selectedItems`; new `selectItem()`, `deselectItem()`, `deselectAll()`, `toggleItem()`; updated `initBoard()` (combined pointerdown handler), updated `initCardDrag()`, updated `initBoardClicks()`
- Modify: `blocks/collection/collection.css` — `.board__selection-rect`

**Interfaces:**
- Produces: `_selectedItems` (module-level `Set` of DOM elements); `selectItem(el)`, `deselectItem(el)`, `deselectAll()`, `toggleItem(el)` — used by Task 5 text element init. `.board__card--selected` class applied on selected cards. Rubber band: Ctrl/Cmd+drag on background; Shift+click: toggle card in selection.

- [ ] **Step 1: Add module-level selection state**

After `let _openPanelState = null;`, add:

```js
let _selectedItems = new Set();
```

- [ ] **Step 2: Add selection helpers**

Add these four functions before `computeFitViewport`:

```js
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
```

- [ ] **Step 3: Reset selection in `initBoard()` and replace the viewport pointerdown handler**

At the top of `initBoard`, add:
```js
_selectedItems.clear();
```

Then **replace** the existing `viewport.addEventListener('pointerdown', ...)` pan handler (the one that checks `if (e.target.closest('.board__card')) return;`) with this combined handler that handles both rubber-band and pan:

```js
viewport.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.board__card, .board__text-element')) return;
  if (e.target.closest('.board__notes-panel, .board__reset-view, .board__add-text')) return;

  if (e.ctrlKey || e.metaKey) {
    // Rubber-band selection
    e.preventDefault();
    const viewportRect = viewport.getBoundingClientRect();
    const startX = e.clientX - viewportRect.left;
    const startY = e.clientY - viewportRect.top;

    const selRect = document.createElement('div');
    selRect.className = 'board__selection-rect';
    viewport.appendChild(selRect);
    viewport.setPointerCapture(e.pointerId);

    function onMove(ev) {
      const curX = ev.clientX - viewportRect.left;
      const curY = ev.clientY - viewportRect.top;
      const left = Math.min(startX, curX);
      const top = Math.min(startY, curY);
      const width = Math.abs(curX - startX);
      const height = Math.abs(curY - startY);
      selRect.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
    }

    function onUp() {
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerup', onUp);
      const rectBounds = selRect.getBoundingClientRect();
      selRect.remove();
      deselectAll();
      canvas.querySelectorAll('.board__card, .board__text-element').forEach((item) => {
        const b = item.getBoundingClientRect();
        const overlaps = !(b.right < rectBounds.left || b.left > rectBounds.right
          || b.bottom < rectBounds.top || b.top > rectBounds.bottom);
        if (overlaps) selectItem(item);
      });
    }

    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', onUp);
    return;
  }

  // Pan (existing logic)
  panning = true;
  lastX = e.clientX;
  lastY = e.clientY;
  viewport.setPointerCapture(e.pointerId);
  viewport.classList.add('board__viewport--panning');
});
```

- [ ] **Step 4: Update `initBoardClicks()` for click-to-select and background-click-to-deselect**

In `initBoardClicks`, replace the card click block:

```js
// Add at the top of the click handler — deselect when clicking empty board
if (!e.target.closest('.board__card, .board__notes-panel, .board__reset-view, .board__add-text, .board__text-element')) {
  deselectAll();
}

// ...existing removeBtn and notesBtn checks stay unchanged...

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
```

- [ ] **Step 5: Replace `initCardDrag()` with group-aware version**

Replace `initCardDrag` entirely:

```js
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
    const dragGroup = isInGroup ? [..._selectedItems].filter((el) => el.dataset.ascAsset) : [card];

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
          const x = Math.round(parseFloat(el.style.left));
          const y = Math.round(parseFloat(el.style.top));
          services.collections.updateItem(collection.id, el.dataset.ascAsset, { x, y });
        });
      }
    }

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
  });
}
```

Note: This version only group-moves other asset cards (`.dataset.ascAsset`). Text elements in a mixed selection are moved by their own drag handler in Task 5.

- [ ] **Step 6: Add `.board__selection-rect` CSS**

In `blocks/collection/collection.css`, inside `.block.collection { }`, add after the `.board__reset-view` rule:

```css
    .board__selection-rect {
        position: absolute;
        border: 1px solid var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        pointer-events: none;
        z-index: 50;
    }
```

- [ ] **Step 7: Verify multi-select**
- Click card → selected (blue outline), others deselected
- Shift+click another card → both selected
- Ctrl/Cmd+drag on empty board area → rubber band rect appears, cards in band selected on release
- Drag any selected card → all selected cards move together as group
- Click empty board area → all deselected

- [ ] **Step 8: Lint and commit**
```bash
npx eslint blocks/collection/collection.js
npx stylelint blocks/collection/collection.css
git add blocks/collection/collection.js blocks/collection/collection.css
git commit -m "feat(collection): board multi-select — rubber band, shift-click, group drag"
```

---

### Task 5: Board text elements — add, edit, move, resize, multi-select

**Files:**
- Modify: `blocks/collection/collection.js` — new constants and storage helpers, new `boardTextElement()`, updated `boardHtml()`, new `saveTextItem()`, `initTextElement()`, `initTextElements()`, `initAddText()`; updated `initInteractions()`
- Modify: `blocks/collection/collection.css` — `.board__text-element`, `.board__text-content`, `.board__text-remove`, `.board__add-text`

**Interfaces:**
- Consumes: `_selectedItems`, `selectItem`, `deselectItem`, `deselectAll`, `toggleItem` (from Task 4); `computeFitViewport`, `getViewport` (from earlier tasks)
- Produces: `BOARD_TEXT_KEY`, `getBoardTextItems(collectionId)`, `setBoardTextItems(collectionId, items)` module-level; `saveTextItem(collectionId, el)` module-level; `initTextElement(el, collection, canvas)`, `initTextElements(block, collection)`, `initAddText(block, collection)` functions; text elements are `.board__text-element` DOM nodes, included in rubber band selection.

- [ ] **Step 1: Add storage constants and helpers**

After `VIEWPORT_KEY`, add:

```js
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
```

- [ ] **Step 2: Add `saveTextItem()` module-level helper**

Add this function after `setBoardTextItems`:

```js
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
```

- [ ] **Step 3: Add `boardTextElement()` HTML template**

Add after `boardCard`:

```js
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
```

- [ ] **Step 4: Update `boardHtml()` to include text elements and "+ Text" button**

Replace `boardHtml`:

```js
function boardHtml(items, textItems) {
  const assetItems = items.filter((i) => i.type === 'asset' && i.asset);
  return `
    <div class="board__viewport">
      <div class="board__canvas">
        ${assetItems.map((item, index) => boardCard(item, index)).join('')}
        ${textItems.map((t) => boardTextElement(t)).join('')}
      </div>
      <button type="button" class="board__reset-view btn btn--ghost btn--sm">Fit view</button>
      <button type="button" class="board__add-text btn btn--ghost btn--sm">+ Text</button>
    </div>`;
}
```

Update the call site in `html()` — change:
```js
${mode === 'board' ? boardHtml(items) : listHtml(items)}
```
To:
```js
${mode === 'board' ? boardHtml(items, getBoardTextItems(collection.id)) : listHtml(items)}
```

- [ ] **Step 5: Add `initTextElement()` per-element init function**

Add this function after `initBoardClicks`:

```js
function initTextElement(el, collection, canvas) {
  const content = el.querySelector('.board__text-content');
  const { textId } = el.dataset;

  // ResizeObserver — save when user drags resize handle
  const ro = new ResizeObserver(() => saveTextItem(collection.id, el));
  ro.observe(el);

  // Double-click → enter edit mode
  el.addEventListener('dblclick', (ev) => {
    ev.stopPropagation();
    content.contentEditable = 'true';
    el.dataset.editing = 'true';
    content.focus();
    const range = document.createRange();
    range.selectNodeContents(content);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

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
    ev.stopPropagation();

    const startX = ev.clientX;
    const startY = ev.clientY;
    const startLeft = parseFloat(el.style.left) || 0;
    const startTop = parseFloat(el.style.top) || 0;
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
```

- [ ] **Step 6: Add `initTextElements()` and `initAddText()`**

Add `initTextElements` after `initTextElement`:

```js
function initTextElements(block, collection) {
  const canvas = block.querySelector('.board__canvas');
  if (!canvas) return;
  canvas.querySelectorAll('.board__text-element').forEach((el) => {
    initTextElement(el, collection, canvas);
  });
}
```

Add `initAddText` after `initTextElements`:

```js
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
    const el = wrapper.firstElementChild;
    canvas.appendChild(el);
    initTextElement(el, collection, canvas);

    // Auto-enter edit mode on the new element
    const content = el.querySelector('.board__text-content');
    content.contentEditable = 'true';
    el.dataset.editing = 'true';
    content.focus();
    const range = document.createRange();
    range.selectNodeContents(content);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
}
```

- [ ] **Step 7: Wire into `initInteractions()`**

In `initInteractions`, update the board branch:

```js
if (mode === 'board') {
  initBoard(block, collection);
  initCardDrag(block, collection);
  initBoardClicks(block, collection);
  initTextElements(block, collection);
  initAddText(block, collection);
}
```

- [ ] **Step 8: Add CSS for text elements**

In `blocks/collection/collection.css`, inside `.block.collection { }`, add after `.board__selection-rect`:

```css
    /* ── Add text button ──────────────────────────────────────────────── */

    .board__add-text {
        position: absolute;
        bottom: var(--spacing-sm);
        left: var(--spacing-sm);
        z-index: 10;
        background: var(--color-card);
        border-color: var(--color-border);
    }

    /* ── Board text elements ──────────────────────────────────────────── */

    .board__text-element {
        position: absolute;
        min-width: 100px;
        min-height: 40px;
        padding: var(--spacing-sm);
        box-sizing: border-box;
        background: color-mix(in srgb, var(--color-accent) 5%, var(--color-card));
        border: 1px dashed color-mix(in srgb, var(--color-border) 80%, var(--color-accent));
        border-radius: var(--border-radius-md);
        resize: both;
        overflow: auto;
        cursor: default;
        user-select: none;
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);

        &:hover {
            border-style: solid;
            border-color: var(--color-border);
        }

        &[data-editing] {
            border-style: solid;
            border-color: var(--color-ring);
            box-shadow: var(--focus-ring);
            cursor: text;
            user-select: text;
        }

        &.board__card--selected {
            outline: 2px solid var(--color-primary);
            outline-offset: 2px;
            border-color: var(--color-primary);
        }

        &.board__card--dragging {
            opacity: 0.85;
            cursor: grabbing;
            z-index: 100;
        }
    }

    .board__text-content {
        width: 100%;
        min-height: 1.5em;
        font-size: var(--body-font-size-s);
        color: var(--color-fg);
        line-height: 1.5;
        outline: none;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .board__text-remove {
        position: absolute;
        top: var(--spacing-2xs);
        right: var(--spacing-2xs);
        opacity: 0;
        transition: opacity var(--transition-fast);

        .board__text-element:hover & {
            opacity: 1;
        }
    }
```

- [ ] **Step 9: Verify text elements**
- Click "+ Text" button → new text element appears near center of board, auto-focused and selected
- Type to set content → content saved on click-outside or Escape
- Double-click existing text element → enters edit mode
- Click once (no drag) → selects element (blue outline), clicking away deselects
- Shift+click → toggles element in multi-selection
- Ctrl/Cmd+drag across board → rubber band selects cards AND text elements
- Drag text element in multi-selection → all selected items move together
- Drag resize handle (bottom-right corner) → element resizes
- Click ✕ on hover → element removed

- [ ] **Step 10: Lint and commit**
```bash
npx eslint blocks/collection/collection.js
npx stylelint blocks/collection/collection.css
git add blocks/collection/collection.js blocks/collection/collection.css
git commit -m "feat(collection): board text elements — add, edit, move, resize, multi-select"
```
