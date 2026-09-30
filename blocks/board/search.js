/** @owner user */
import { computeFitViewport } from './layout.js';

export function initSearch(block, panZoom) {
  const input = block.querySelector('.board__search');
  if (!input) return;
  const viewport = block.querySelector('.board__viewport');
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) {
      viewport.removeAttribute('data-board-searching');
      block.querySelectorAll('.board__item, .board__text-element').forEach((card) => card.classList.remove('board__item--match'));
      panZoom.fitView(false);
      return;
    }
    viewport.setAttribute('data-board-searching', '');
    const matches = [];
    block.querySelectorAll('.board__item, .board__text-element').forEach((card) => {
      const haystack = card.classList.contains('board__text-element')
        ? (card.querySelector('.board__text-content')?.textContent || '').toLowerCase()
        : [card.dataset.filter, card.dataset.ascNotes].filter(Boolean).join(' ').toLowerCase();
      const hit = haystack.includes(q);
      card.classList.toggle('board__item--match', hit);
      if (hit) matches.push(card);
    });
    // Never persist a search-narrowed fit — it's a temporary view, not the user's chosen viewport.
    if (matches.length) panZoom.applyFit(computeFitViewport(matches, viewport), false);
  });
}
