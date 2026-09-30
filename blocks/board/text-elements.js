/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import {
  getBoardTextItems, setBoardTextItems, saveTextItem,
} from './storage.js';
import {
  selectedItems, deselectAll, selectItem, deselectItem, toggleItem,
} from './state.js';
import { textElementHtml } from './render.js';

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

    const isInGroup = selectedItems.has(el) && selectedItems.size > 1;
    const dragGroup = isInGroup ? [...selectedItems] : [el];
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

export function initTextElements(block, storeId) {
  const canvas = block.querySelector('.board__canvas');
  if (!canvas) return;
  canvas.querySelectorAll('.board__text-element').forEach((el) => {
    initTextElement(el, storeId);
  });
}

export function initAddText(block, storeId, panZoom) {
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
