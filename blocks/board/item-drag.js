/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import { state, selectedItems } from './state.js';
import { repositionOpenPanel } from './notes.js';

export function initItemDrag(block, collectionId, panZoom) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.board__item');
    if (!card) return;
    if (e.target.closest('.board__item-remove, .board__notes-btn, .board__rendition-action')) return;

    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    state.itemDragMoved = false;

    const { zoom } = panZoom.getState();

    const isInGroup = selectedItems.has(card) && selectedItems.size > 1;
    const dragGroup = isInGroup ? [...selectedItems] : [card];

    state.dragZ += 1;
    dragGroup.forEach((c) => { c.style.zIndex = state.dragZ; });

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
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) state.itemDragMoved = true;
      if (!state.itemDragMoved) return;
      startPositions.forEach(({ el, left, top }) => {
        el.style.left = `${left + dx / zoom}px`;
        el.style.top = `${top + dy / zoom}px`;
      });
      if (state.openPanel && dragGroup.includes(state.openPanel.card)) repositionOpenPanel();
    }

    function onUp() {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onUp);
      dragGroup.forEach((c) => c.classList.remove('board__item--dragging'));
      if (state.itemDragMoved) {
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
