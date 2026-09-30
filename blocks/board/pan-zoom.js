/** @owner user */
import { getViewport, setViewport, contentSignature } from './storage.js';
import { computeFitViewport } from './layout.js';
import { repositionOpenPanel } from './notes.js';

export function initPanZoom(block, persistId, onChange) {
  const viewport = block.querySelector('.board__viewport');
  const canvas = block.querySelector('.board__canvas');
  if (!viewport || !canvas) {
    return {
      getState: () => ({ panX: 0, panY: 0, zoom: 1 }),
      applyFit() {},
      fitView() {},
      centerOn() {},
      zoomBy() {},
      zoomTo() {},
      hasValidSavedViewport: false,
      isManuallyPositioned: () => false,
    };
  }

  const currentItems = () => [...canvas.querySelectorAll('.board__item, .board__text-element')];

  const savedRaw = persistId ? getViewport(persistId) : null;
  const hasValidSavedViewport = !!savedRaw
    && (savedRaw.sig == null || savedRaw.sig === contentSignature(currentItems()));
  // Default to the fit-view computation rather than a hardcoded {0,0,1} — without a saved
  // viewport to restore, the board's first paint should already look "fit to view" instead of
  // flashing at zoom 1/pan 0 for a frame before initBoard's forceFit corrects it.
  let { panX, panY, zoom } = hasValidSavedViewport
    ? savedRaw
    : computeFitViewport(currentItems(), viewport);

  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 3.0;

  // A restored saved viewport only counts as "manual" if it was saved by a real pan/wheel/
  // centerOn — those are stored without a `sig` (see endPan/wheel/centerOn below) and are
  // always trusted regardless of content changes. A restored *fit* (from the "Fit view"
  // button, Align to grid, or a forced initial fit) is tagged with a `sig` and is just a
  // computed result, not a deliberate override — treating it as "manual" would permanently
  // block the layout-shift-triggered re-fit in decorate()'s ResizeObserver below for any
  // board that has ever been fit before, which is the opposite of what that re-fit is for.
  let manuallyPositioned = hasValidSavedViewport && savedRaw.sig == null;

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
    manuallyPositioned = true;
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
    manuallyPositioned = true;
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
  let fitTransitionTimer;
  // `animate` is false only for the initial forced fit on load (see initBoard) — there's
  // nothing on screen yet to visibly "correct", so animating it would just read as the
  // board resizing itself for no reason; the canvas fades in afterward instead (see the
  // --hidden/opacity handling in initBoard).
  function applyFit(fit, persist = true, animate = true) {
    ({ panX, panY, zoom } = fit);
    // Animate the correction instead of snapping — computeFitViewport() is often re-run after
    // first paint (async content above the board settling, other sections/fonts loading) and an
    // instant transform jump there reads as the board "resizing" out of nowhere.
    if (animate) canvas.classList.add('board__canvas--fitting');
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    clearTimeout(fitTransitionTimer);
    if (animate) fitTransitionTimer = setTimeout(() => canvas.classList.remove('board__canvas--fitting'), 300);
    if (persist && persistId) setViewport(persistId, { ...fit, sig: contentSignature(currentItems()) });
    repositionOpenPanel();
    onChange?.();
  }

  function fitView(persist = true, animate = true) {
    const allCards = [...canvas.querySelectorAll('.board__item, .board__text-element')];
    applyFit(computeFitViewport(allCards, viewport), persist, animate);
  }

  function centerOn(x, y) {
    manuallyPositioned = true;
    panX = viewport.clientWidth / 2 - x * zoom;
    panY = viewport.clientHeight / 2 - y * zoom;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    if (persistId) setViewport(persistId, { panX, panY, zoom });
    repositionOpenPanel();
    onChange?.();
  }

  // Same clamped scale-toward-a-point math as the ctrl/cmd+wheel handler above, but anchored
  // on the viewport center rather than the cursor — for button-driven zoom (minimap +/− controls
  // and the "reset to 100%" zoom-level readout) where there's no cursor position to anchor to.
  function setZoomCentered(target) {
    manuallyPositioned = true;
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, target));
    panX = centerX - (centerX - panX) * (newZoom / zoom);
    panY = centerY - (centerY - panY) * (newZoom / zoom);
    zoom = newZoom;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    if (persistId) setViewport(persistId, { panX, panY, zoom });
    repositionOpenPanel();
    onChange?.();
  }

  const zoomBy = (factor) => setZoomCentered(zoom * factor);
  const zoomTo = (target) => setZoomCentered(target);

  return {
    getState: () => ({ panX, panY, zoom }),
    applyFit,
    fitView,
    centerOn,
    zoomBy,
    zoomTo,
    hasValidSavedViewport,
    isManuallyPositioned: () => manuallyPositioned,
  };
}

// Board items carry an `img srcset` sized against their resting (zoom 1) CSS width — see
// board-item.js. The pan/zoom canvas above scales items up to 3x via a CSS `transform`,
// which the browser's native srcset selection never sees (transforms happen at paint time,
// after the layout width srcset selection is based on), so a zoomed-in card would otherwise
// just upscale whatever low-res candidate it already picked. Re-pointing `sizes` at the
// zoomed-out CSS width whenever `zoom` changes is the sanctioned way to tell the browser
// "this image now occupies more effective pixels" without hand-rolling srcset parsing —
// it re-runs the normal selection algorithm, so DPR and quality/width tiers keep working.
// Debounced and skipped when zoom hasn't actually changed, since pan-only onChange calls
// (and rapid wheel-zoom ticks) would otherwise force a synchronous layout read (offsetWidth)
// per visible image on every event.
const ZOOM_RESOLUTION_DEBOUNCE = 150;

export function initZoomResolutionUpgrade(canvas, panZoom) {
  let timer = null;
  let lastZoom = null;
  return function scheduleZoomResolutionUpgrade() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { zoom } = panZoom.getState();
      if (zoom === lastZoom) return;
      lastZoom = zoom;
      canvas.querySelectorAll('.board__item img[srcset]').forEach((img) => {
        img.sizes = `${Math.max(1, Math.round(img.offsetWidth * zoom))}px`;
      });
    }, ZOOM_RESOLUTION_DEBOUNCE);
  };
}
