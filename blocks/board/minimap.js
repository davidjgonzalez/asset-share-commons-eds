/** @owner user */
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
export function initMinimap(block, panZoom) {
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
