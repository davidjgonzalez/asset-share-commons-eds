/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import { escHtml } from '../../scripts/asc/html.js';
import { state } from './state.js';

const PANEL_SIDE_ORDER = ['bottom', 'right', 'top', 'left'];
const PANEL_TAIL_SIZE = 12;

/**
 * Position the notes panel relative to the item's card, not the notes button. Sides are
 * tried in order of preference — bottom, right, top, left — and the first one the panel
 * actually fits in wins; if none fit, whichever has the most free space is used instead.
 * The panel is then centered along that side and a CSS tail (::after, driven by
 * data-side + --tail-pos) points back at the card's center, clamped to stay on the panel.
 */
function positionPanel(panel, card, viewport) {
  const cardRect = card.getBoundingClientRect();
  const vRect = viewport.getBoundingClientRect();
  const pw = panel.offsetWidth || 220;
  const ph = panel.offsetHeight || 160;
  const gap = 10;
  const margin = 4;

  const cardLeft = cardRect.left - vRect.left;
  const cardTop = cardRect.top - vRect.top;
  const cardRight = cardRect.right - vRect.left;
  const cardBottom = cardRect.bottom - vRect.top;
  const cardCenterX = cardLeft + cardRect.width / 2;
  const cardCenterY = cardTop + cardRect.height / 2;

  const space = {
    bottom: vRect.height - cardBottom,
    right: vRect.width - cardRight,
    top: cardTop,
    left: cardLeft,
  };
  const needed = {
    top: ph + gap, bottom: ph + gap, left: pw + gap, right: pw + gap,
  };

  const side = PANEL_SIDE_ORDER.find((s) => space[s] >= needed[s])
    ?? PANEL_SIDE_ORDER.slice().sort((a, b) => space[b] - space[a])[0];

  let left;
  let top;
  if (side === 'top' || side === 'bottom') {
    left = cardCenterX - pw / 2;
    top = side === 'top' ? cardTop - ph - gap : cardBottom + gap;
  } else {
    top = cardCenterY - ph / 2;
    left = side === 'left' ? cardLeft - pw - gap : cardRight + gap;
  }

  const clampedLeft = Math.max(margin, Math.min(left, vRect.width - pw - margin));
  const clampedTop = Math.max(margin, Math.min(top, vRect.height - ph - margin));

  panel.style.left = `${clampedLeft}px`;
  panel.style.top = `${clampedTop}px`;
  panel.dataset.side = side;

  const tailPos = side === 'top' || side === 'bottom'
    ? Math.max(PANEL_TAIL_SIZE, Math.min(cardCenterX - clampedLeft, pw - PANEL_TAIL_SIZE))
    : Math.max(PANEL_TAIL_SIZE, Math.min(cardCenterY - clampedTop, ph - PANEL_TAIL_SIZE));
  panel.style.setProperty('--tail-pos', `${tailPos}px`);
}

export function repositionOpenPanel() {
  if (!state.openPanel) return;
  const { panel, card, viewport } = state.openPanel;
  if (!document.contains(panel)) { state.openPanel = null; return; }
  positionPanel(panel, card, viewport);
}

function openNotePanel(block, card, className, innerHtml, mode) {
  block.querySelector('.board__notes-panel')?.remove();
  state.openPanel = null;
  const panel = document.createElement('div');
  panel.className = className;
  panel.innerHTML = innerHtml;
  const viewport = block.querySelector('.board__viewport');
  viewport.appendChild(panel);
  positionPanel(panel, card, viewport);
  state.openPanel = {
    panel, card, viewport, mode,
  };
  return { panel, viewport };
}

function openNotePreview(block, card) {
  const notes = card.dataset.ascNotes || '';
  if (!notes) return;

  const { panel } = openNotePanel(
    block, card,
    'asc-panel board__notes-panel board__notes-panel--preview',
    `<p class="board__notes-preview-text">${escHtml(notes)}</p>`,
    'preview',
  );

  panel.addEventListener('mouseenter', () => clearTimeout(state.noteHoverTimer));
  panel.addEventListener('mouseleave', () => {
    const state = state.openPanel;
    if (state?.mode === 'preview') {
      state.noteHoverTimer = setTimeout(() => {
        if (state.openPanel === state) {
          state.panel.remove();
          state.openPanel = null;
        }
      }, 150);
    }
  });
}

export function openNoteEdit(block, collectionId, card) {
  const assetId = card.dataset.ascAsset;
  const currentNotes = card.dataset.ascNotes || '';

  const { panel } = openNotePanel(
    block, card,
    'asc-panel board__notes-panel',
    `<div class="asc-ui-field">
      <textarea class="board__notes-textarea"
                placeholder="Add a note about this asset…"
                rows="4">${escHtml(currentNotes)}</textarea>
    </div>
    <div class="board__notes-actions">
      <button type="button" class="board__notes-done btn btn--secondary btn--sm">Done</button>
    </div>`,
    'edit',
  );

  const textarea = panel.querySelector('.board__notes-textarea');
  textarea.focus();

  let removeOutsideClick = () => {};

  function saveAndClose() {
    const notes = textarea.value.trim();
    services.collections.updateItem(collectionId, assetId, { notes });
    updateItemNotes(card, notes);
    removeOutsideClick();
    panel.remove();
    state.openPanel = null;
  }

  panel.querySelector('.board__notes-done').addEventListener('click', saveAndClose);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { textarea.value = currentNotes; saveAndClose(); }
  });

  setTimeout(() => {
    function onOutsideClick(e) {
      if (!panel.contains(e.target) && !card.contains(e.target)) {
        saveAndClose();
      }
    }
    document.addEventListener('click', onOutsideClick);
    removeOutsideClick = () => document.removeEventListener('click', onOutsideClick);
  }, 0);
}

function updateItemNotes(card, notes) {
  card.classList.toggle('board__item--has-note', !!notes);
  card.dataset.ascNotes = notes || '';
}

// ─── Notes hover preview (shared by interactive and view-only boards) ─────────

// Hovering anywhere on an item with a note shows the preview — the notes button itself
// is only for opening the add/edit panel (click), not for triggering the hover preview.
export function initNotesHover(block) {
  const viewport = block.querySelector('.board__viewport');
  if (!viewport) return;

  viewport.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.board__item');
    if (!card) return;
    clearTimeout(state.noteHoverTimer);
    if (!card.classList.contains('board__item--has-note')) return;
    if (state.openPanel?.mode === 'edit') return;
    if (state.openPanel?.card === card) return;
    openNotePreview(block, card);
  });

  viewport.addEventListener('mouseout', (e) => {
    const card = e.target.closest('.board__item');
    if (!card) return;
    if (e.relatedTarget?.closest('.board__item') === card) return;
    if (e.relatedTarget?.closest('.board__notes-panel')) return;
    const state = state.openPanel;
    if (state?.mode === 'preview') {
      state.noteHoverTimer = setTimeout(() => {
        if (state.openPanel === state) {
          state.panel.remove();
          state.openPanel = null;
        }
      }, 150);
    }
  });
}
