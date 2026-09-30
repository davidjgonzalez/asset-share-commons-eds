/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import { computeFitViewport } from './layout.js';
import { saveTextItem } from './storage.js';
import { repositionOpenPanel } from './notes.js';

export function initAlignGrid(block, collectionId, panZoom) {
  const canvas = block.querySelector('.board__canvas');
  const viewport = block.querySelector('.board__viewport');

  block.querySelector('.board__align-grid')?.addEventListener('click', () => {
    const allItems = [...canvas.querySelectorAll('.board__item, .board__text-element')];
    if (!allItems.length) return;

    const SNAP = 24;
    const MIN_GAP = 16;

    const layout = allItems.map((el) => ({
      el,
      x: Math.round((parseFloat(el.style.left) || 0) / SNAP) * SNAP,
      y: Math.round((parseFloat(el.style.top) || 0) / SNAP) * SNAP,
      w: el.offsetWidth || 240,
      h: el.offsetHeight || 180,
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
      const allCards = [...canvas.querySelectorAll('.board__item, .board__text-element')];
      panZoom.applyFit(computeFitViewport(allCards, viewport));
      repositionOpenPanel();
    }, 230);
  });
}
