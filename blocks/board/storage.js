/** @owner user */
// Board persistence: text elements and the saved pan/zoom viewport (localStorage).

const BOARD_TEXT_KEY = (id) => `asc:boardText:${id}`;
const VIEWPORT_KEY = (id) => `asc:boardViewport:${id}`;

export function getBoardTextItems(id) {
  try {
    return JSON.parse(localStorage.getItem(BOARD_TEXT_KEY(id))) || [];
  } catch {
    return [];
  }
}

export function setBoardTextItems(id, items) {
  localStorage.setItem(BOARD_TEXT_KEY(id), JSON.stringify(items));
}

export function saveTextItem(id, el) {
  const { textId } = el.dataset;
  if (!textId) return;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (!w || !h) return;
  const items = getBoardTextItems(id);
  const item = items.find((t) => t.id === textId);
  if (!item) return;
  item.x = Math.round(parseFloat(el.style.left) || 0);
  item.y = Math.round(parseFloat(el.style.top) || 0);
  item.w = w;
  item.h = h;
  item.content = el.querySelector('.board__text-content')?.innerText?.trim() || '';
  setBoardTextItems(id, items);
}

export function getViewport(id) {
  try {
    return JSON.parse(localStorage.getItem(VIEWPORT_KEY(id)));
  } catch {
    return null;
  }
}

export function setViewport(id, state) {
  localStorage.setItem(VIEWPORT_KEY(id), JSON.stringify(state));
}

/**
 * Stable signature for "which items are currently on the board" (membership only, not
 * position) — lets a persisted *automatic* fit be trusted on a later load only if the
 * board's contents haven't changed since, and safely discarded (recomputed fresh) if they
 * have. A *manual* pan/zoom/centerOn is saved without a signature and is always trusted
 * regardless of content changes — the user chose that view deliberately.
 */
export function contentSignature(items) {
  return items
    .map((el) => el.dataset.ascAsset || el.dataset.textId || '')
    .sort()
    .join(',');
}
