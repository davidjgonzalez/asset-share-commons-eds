/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import {
  state, deselectAll, selectItem, toggleItem,
} from './state.js';
import { openDetails } from './config.js';
import { openNoteEdit, initNotesHover } from './notes.js';

export function initBoardClicks(block, collectionId, config) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('click', (e) => {
    if (e.target.closest('.board__rendition-action')) return;
    if (!e.target.closest('.board__item, .board__notes-panel, .board__toolbar, .board__controls, .board__text-element')) {
      if (state.rubberBandJustSelected) { state.rubberBandJustSelected = false; return; }
      deselectAll();
    }

    const removeBtn = e.target.closest('.board__item-remove');
    if (removeBtn) {
      services.collections.removeAsset(removeBtn.dataset.ascAsset, collectionId);
      return;
    }

    const notesBtn = e.target.closest('.board__notes-btn');
    if (notesBtn) {
      const card = notesBtn.closest('.board__item');
      if (card) {
        clearTimeout(state.noteHoverTimer);
        if (state.openPanel?.mode === 'preview') {
          state.openPanel.panel.remove();
          state.openPanel = null;
        }
        openNoteEdit(block, collectionId, card);
      }
      return;
    }

    const card = e.target.closest('.board__item');
    if (card) {
      if (!state.itemDragMoved) {
        if (e.shiftKey) {
          toggleItem(card);
        } else if (card.classList.contains('board__item--locked')) {
          // No asset data to show a details modal for — just select it, same as
          // any item with no data-asc-asset at all.
          deselectAll();
          selectItem(card);
        } else if (card.dataset.ascAsset) {
          openDetails(card.dataset.ascAsset, null, config);
        } else {
          deselectAll();
          selectItem(card);
        }
      }
      state.itemDragMoved = false;
    }
  });

  initNotesHover(block);
}

export function initViewClicks(block, config) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('click', (e) => {
    if (e.target.closest('.board__rendition-action')) return;
    const card = e.target.closest('.board__item');
    if (!card?.dataset.ascAsset || card.classList.contains('board__item--locked')) return;
    openDetails(card.dataset.ascAsset, null, config);
  });

  initNotesHover(block);
}
