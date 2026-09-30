/** @owner user */
import { state, selectedItems, deselectAll, selectItem } from './state.js';

export function initRubberBand(block, panZoom) {
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
      if (selectedItems.size > 0) state.rubberBandJustSelected = true;
    };

    document.addEventListener('pointermove', rbMove);
    document.addEventListener('pointerup', rbUp);
  });
}
