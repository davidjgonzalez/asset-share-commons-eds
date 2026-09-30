/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import { Events as CollectionEvents } from '../../scripts/asc/core/services/collections/collections.js';
import { parseConfig } from './config.js';
import { selectedItems } from './state.js';
import { placeNewItems, repackMeasuredItems, itemKey } from './layout.js';
import { viewportHtml, expiredHtml } from './render.js';
import {
  loadFromCollection, loadFromSheet, loadFromAuthoredList, sheetParamFromUrl,
} from './data.js';
import { initPanZoom, initZoomResolutionUpgrade } from './pan-zoom.js';
import { initSearch } from './search.js';
import { initRubberBand } from './rubber-band.js';
import { initItemDrag } from './item-drag.js';
import { initBoardClicks, initViewClicks } from './clicks.js';
import { initTextElements, initAddText } from './text-elements.js';
import { initAlignGrid } from './align-grid.js';
import { initRenditionActions } from './rendition-actions.js';
import { initMinimap } from './minimap.js';

// ─── Board orchestrator ───────────────────────────────────────────────────────

const BOARD_BOTTOM_MARGIN = 64;
const BOARD_MIN_HEIGHT = 420;

// Fill down to the bottom of the browser viewport instead of guessing a fixed vh —
// how much page content sits above the board (title, toolbar, etc.) varies per page,
// so a fixed vh percentage either overshoots (cut off below the fold) or undershoots
// (a gap before the viewport's bottom edge) depending on the page. config.height
// (authored `height` row, e.g. "90vh") opts a specific page out of that calculation
// in favor of an explicit size — the author's job to make sure it doesn't overlap
// whatever sits above the board on that page.
// Returns whether the height actually changed — callers use this to avoid re-triggering a
// fit correction over a sizeViewport() call that was itself the *cause* of the body resize
// notification that invoked them (see the ResizeObserver in decorate()): without this check,
// setting the viewport's own height changes document.body's size, which re-notifies that
// same observer, which measures again, finds nothing new, but had already re-run the fit
// correction (hide/fit/fade) once before discovering that — a needless extra flash on every
// load. Rounded to whole pixels so sub-pixel getBoundingClientRect() jitter between calls
// can't register as a "change" on its own.
function sizeViewport(block, config) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return false;
  const previous = viewport.style.height;
  if (config?.height) {
    viewport.style.height = config.height;
    return viewport.style.height !== previous;
  }
  const available = window.innerHeight - viewport.getBoundingClientRect().top - BOARD_BOTTOM_MARGIN;
  const next = `${Math.round(Math.max(available, BOARD_MIN_HEIGHT))}px`;
  viewport.style.height = next;
  return next !== previous;
}

/**
 * Same "hide → resize/fit → fade in" treatment as the very first load (see initBoard) —
 * reused for a re-fit triggered while the board is already visible (see the ResizeObserver
 * in decorate()), so a layout shift settling shortly after load reads as a clean fade
 * rather than the items visibly panning to a new spot under the user.
 */
async function settleFit(canvas, panZoom) {
  canvas.classList.add('board__canvas--hidden');
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  panZoom.fitView(false, false);
  canvas.classList.remove('board__canvas--hidden');
}

// EDS loads a block's CSS (board.css) in parallel with running its JS decorate() (see
// loadBlock() in scripts/aem.js) — there's no guarantee board.css has applied yet when
// initBoard runs. Without it, cards aren't positioned absolute yet and read back the
// wrong size/position, so the very first fit-view calc is measured against bogus
// geometry; a moment later a corrective re-fit snaps/animates to the real layout, which
// reads as the whole board "resizing". `.board__canvas { position: absolute }` is
// board.css's own doing, so polling for it is a reliable "board.css is applied" signal —
// capped so a failed/slow CSS load can't hide the board forever.
const BOARD_CSS_WAIT_CAP_MS = 2000;

function waitForBoardCss(canvas) {
  return new Promise((resolve) => {
    const deadline = performance.now() + BOARD_CSS_WAIT_CAP_MS;
    function check() {
      if (getComputedStyle(canvas).position === 'absolute' || performance.now() >= deadline) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    }
    check();
  });
}

async function initBoard(block, config, collectionId, { forceFit = false } = {}) {
  selectedItems.clear();

  const canvas = block.querySelector('.board__canvas');
  // Hidden until the board's real layout (post-CSS) has been measured and fit — avoids
  // rendering (and then visibly correcting) a fit computed against unstyled geometry.
  // Opacity (not visibility) so the reveal below can be a quick fade instead of a hard cut.
  canvas.classList.add('board__canvas--hidden');
  await waitForBoardCss(canvas);

  sizeViewport(block, config);

  const panZoom = initPanZoom(block, collectionId, () => {
    minimap?.updateIndicator();
    scheduleZoomResolutionUpgrade();
  });
  const minimap = initMinimap(block, panZoom);
  const scheduleZoomResolutionUpgrade = initZoomResolutionUpgrade(canvas, panZoom);
  // Covers the restored-saved-viewport path, which sets an initial zoom directly without
  // going through onChange (see initPanZoom above) — the fitView(false) path below also
  // triggers this itself, so this call is a no-op harmless repeat in that case.
  scheduleZoomResolutionUpgrade();

  block.querySelector('.board__zoom-out')?.addEventListener('click', () => panZoom.zoomBy(1 / 1.2));
  block.querySelector('.board__zoom-in')?.addEventListener('click', () => panZoom.zoomBy(1.2));
  block.querySelector('.board__zoom-fit')?.addEventListener('click', () => panZoom.fitView());

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

  // forceFit covers opening the page: a board should always greet you with everything in
  // view rather than wherever a previous visit last left the pan/zoom. A saved viewport is
  // still honored for in-session re-renders (e.g. adding an asset from search triggers
  // CollectionEvents.CHANGED without a page reload) as long as its content signature still
  // matches — see initPanZoom above.
  if (forceFit || !panZoom.hasValidSavedViewport) {
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    panZoom.fitView(false, false);
  }

  canvas.classList.remove('board__canvas--hidden');
  return panZoom;
}

// ─── Main decorate ────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const config = parseConfig(block);
  const params = new URLSearchParams(window.location.search);

  block.innerHTML = '';

  // Window resizes AND layout shifts from async content above the board (e.g. the
  // collection-controls toolbar expanding once its data loads) can change how much
  // space is left — re-measure whenever the page's layout changes, not just on resize.
  // Re-running the fit alongside it (when nobody has manually panned/zoomed) matters
  // because the very first fit is often computed before that async content above has
  // settled — without this, the board keeps a fit sized against a taller-than-actual
  // viewport and its lower items spill past the real, later-shrunk bottom edge.
  //
  // For a short window after each (re-)reveal, that correction uses settleFit's hide/
  // fit/fade instead of an animated pan — a settling layout shift happening that soon
  // after load reads as the board's contents visibly resizing/panning on their own,
  // which is the very thing initBoard's initial hide-and-fit already avoids for the
  // first paint. Once the window elapses, a resize is assumed to be the visitor actually
  // dragging the browser window, so it tracks live via an animated pan instead of
  // hiding/flashing on every frame while they drag.
  const RESIZE_SETTLE_GRACE_MS = 1500;
  let resizeRaf;
  let currentPanZoom = null;
  let settled = false;
  let settleTimer;
  function scheduleSettle() {
    settled = false;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { settled = true; }, RESIZE_SETTLE_GRACE_MS);
  }
  // After the just-placed cards' real heights are known, fix any overlap the estimates
  // missed and, if the visitor hasn't moved the view themselves, re-fit it to the result.
  function refitAfterRepack(placed, persistId) {
    repackMeasuredItems(block, placed, persistId).then((moved) => {
      if (moved && currentPanZoom && !currentPanZoom.isManuallyPositioned()) currentPanZoom.fitView(false);
    });
  }
  // The viewport's own width/height also count as a layout change. A board in a later
  // section is decorated while EDS still has that section hidden (display: none), so its
  // first fit measures a 0x0 viewport and bails out; when the section is revealed, or the
  // board's container is narrower than the page, nothing above changed the *height*
  // sizeViewport() tracks (a fixed `height` row never changes at all), so without this the
  // board would stay stuck at its unfitted pan/zoom until the visitor pressed "Fit to view".
  let lastViewportSize = '';
  const viewportSize = () => {
    const viewport = block.querySelector('.board__viewport');
    return viewport ? `${viewport.clientWidth}x${viewport.clientHeight}` : '';
  };
  const layoutObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      const heightChanged = sizeViewport(block, config);
      const size = viewportSize();
      const resized = size !== lastViewportSize;
      lastViewportSize = size;
      if (!(heightChanged || resized) || !currentPanZoom || currentPanZoom.isManuallyPositioned()) return;
      if (settled) {
        currentPanZoom.fitView(false);
      } else {
        const canvas = block.querySelector('.board__canvas');
        if (canvas) settleFit(canvas, currentPanZoom);
      }
    });
  });
  layoutObserver.observe(document.body);
  layoutObserver.observe(block);

  if (config.source === 'collection' && config.mode !== 'sheet-url') {
    const id = params.get('id');
    if (!id) {
      block.innerHTML = '<p class="board__error">No collection id in URL.</p>';
      return;
    }

    async function renderCollection(forceFit) {
      const result = await loadFromCollection(id);
      if (!result) {
        block.innerHTML = '<p class="board__error">Collection not found.</p>';
        return;
      }
      const { assetItems, textItems } = result;
      // Persist first-time placements so a card stays put once it has a spot, instead of
      // being re-packed around whatever the visitor drags next (updateItem is silent).
      const placed = placeNewItems(assetItems, textItems);
      if (config.mode === 'interactive') {
        placed.forEach((i) => services.collections.updateItem(id, itemKey(i), { x: i.x, y: i.y }));
      }
      block.innerHTML = viewportHtml(assetItems, textItems, config);
      currentPanZoom = await initBoard(block, config, id, { forceFit });
      scheduleSettle();
      refitAfterRepack(placed, config.mode === 'interactive' ? id : null);
    }

    await renderCollection(true);

    document.addEventListener(CollectionEvents.CHANGED, async (e) => {
      if (e.detail?.id && e.detail.id !== id) return;
      // A rename only touches the collection's title — the board never displays
      // it, so a full re-render here would just discard live, unpersisted view
      // state (search-narrowed pan/zoom, current selection) for no visible gain.
      if (e.detail?.action === 'renamed') return;
      await renderCollection(false);
    });
  } else if (config.source === 'authored') {
    const { assetItems, textItems } = await loadFromAuthoredList(config.items);
    const boardConfig = { ...config, mode: 'view' };
    const placed = placeNewItems(assetItems, textItems);
    block.innerHTML = viewportHtml(assetItems, textItems, boardConfig);
    currentPanZoom = await initBoard(block, boardConfig, null, { forceFit: true });
    scheduleSettle();
    refitAfterRepack(placed, null);
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
    const placed = placeNewItems(assetItems, textItems);
    block.innerHTML = viewportHtml(assetItems, textItems, boardConfig);

    currentPanZoom = await initBoard(block, boardConfig, null, { forceFit: true });
    scheduleSettle();
    refitAfterRepack(placed, null);
  }
}
