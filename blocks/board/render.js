/** @owner user */
import { escHtml, escAttr } from '../../scripts/asc/core/utils/html.js';
import defaultBoardItemHtml from './board-item.js';
import { placeNewItems } from './layout.js';

const configurations = (await import('../../scripts/asc/configurations.js')).default;

// Swap in a fully custom item renderer via configurations.board.itemRenderer — see
// blocks/board/board-item.js (the default implementation) for the markup contract.
const boardItemHtml = configurations.board?.itemRenderer || defaultBoardItemHtml;

export function expiredHtml(expiresAt) {
  const date = new Date(expiresAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return `
    <div class="board__expired">
      <p class="board__expired-title">This link has expired</p>
      <p class="board__expired-message">The link you followed expired on ${escHtml(date)}.</p>
    </div>`;
}

export function textElementHtml(t, interactive) {
  return `
    <div class="board__text-element${interactive ? '' : ' board__text-element--readonly'}"
         style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px"
         data-text-id="${escAttr(t.id)}">
      ${interactive ? `
      <button type="button"
              class="btn btn--ghost btn--icon btn--sm board__text-remove"
              data-text-id="${escAttr(t.id)}"
              aria-label="Remove text element">&#x2715;</button>` : ''}
      <div class="board__text-content" contenteditable="false">${escHtml(t.content)}</div>
    </div>`;
}

export function viewportHtml(assetItems, textItems, config) {
  const interactive = config.mode === 'interactive';
  // No-op for anything already placed; covers authored and shared (sheet) boards,
  // whose items never have saved positions.
  placeNewItems(assetItems, textItems);
  const cards = assetItems.map((item, i) => boardItemHtml(item, i, config)).join('');
  const texts = textItems.map((t) => textElementHtml(t, interactive)).join('');

  return `
    <div class="board__viewport">
      <div class="board__canvas">
        ${cards}
        ${texts}
      </div>
      <div class="board__controls">
        <div class="asc-ui-segmented board__toolbar" role="toolbar" aria-label="Board tools">
          <button type="button" class="asc-ui-segmented__option board__zoom-out" aria-label="Zoom out">&#x2212;</button>
          <button type="button" class="asc-ui-segmented__option board__zoom-fit">Fit to view</button>
          <button type="button" class="asc-ui-segmented__option board__zoom-in" aria-label="Zoom in">+</button>
          ${interactive ? `
          <span class="board__toolbar-divider" aria-hidden="true"></span>
          <button type="button" class="asc-ui-segmented__option board__align-grid">Align to grid</button>
          <span class="board__toolbar-divider" aria-hidden="true"></span>
          <button type="button" class="asc-ui-segmented__option board__add-text">Add Text</button>` : ''}
          ${config.searchProperties.length ? `
          <span class="board__toolbar-divider" aria-hidden="true"></span>
          <input type="search" class="board__search" placeholder="Search…" aria-label="Search assets">` : ''}
        </div>
      </div>
      <div class="board__minimap asc-panel asc-panel--no-pad" hidden aria-hidden="true">
        <div class="board__minimap-inner">
          <div class="board__minimap-viewport"></div>
        </div>
      </div>
    </div>`;
}
