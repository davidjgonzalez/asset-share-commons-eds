/** @owner user */
// Interaction state shared between the board's modules. One board is active per page, so
// this is module-level rather than per-block.
export const state = {
  itemDragMoved: false,
  rubberBandJustSelected: false,
  openPanel: null,
  noteHoverTimer: null,
  dragZ: 0,
};

export const selectedItems = new Set();

export function selectItem(el) {
  el.classList.add('board__item--selected');
  selectedItems.add(el);
}

export function deselectItem(el) {
  el.classList.remove('board__item--selected');
  selectedItems.delete(el);
}

export function deselectAll() {
  selectedItems.forEach((el) => el.classList.remove('board__item--selected'));
  selectedItems.clear();
}

export function toggleItem(el) {
  if (selectedItems.has(el)) deselectItem(el);
  else selectItem(el);
}
