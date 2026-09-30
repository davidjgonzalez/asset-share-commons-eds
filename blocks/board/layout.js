/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import { BOARD_CARD_WIDTH, boardItemHeight } from '../../scripts/asc/board-item.js';

const PLACE_ORIGIN = 80;
const PLACE_GAP = 20;
const PLACE_COLUMNS = 8;

/**
 * Pack cards into columns, dropping each one at the bottom of whichever column is
 * currently shortest, where "bottom" accounts for every rect overlapping that column.
 * Items don't share an aspect ratio, so a fixed-size grid cell would let a portrait
 * card run into the one below it. `occupied` is extended with each placed card.
 * @param {{x:number,y:number,w:number,h:number}[]} occupied  rects already on the canvas
 * @param {number[]} heights  card heights to place, in order
 * @returns {{x:number,y:number}[]}
 */
function packIntoColumns(occupied, heights) {
  const colWidth = BOARD_CARD_WIDTH + PLACE_GAP;
  const columnBottom = (col) => {
    const left = PLACE_ORIGIN + col * colWidth;
    const right = left + BOARD_CARD_WIDTH;
    return occupied
      .filter((r) => r.x < right + PLACE_GAP && r.x + r.w + PLACE_GAP > left)
      .reduce((bottom, r) => Math.max(bottom, r.y + r.h + PLACE_GAP), PLACE_ORIGIN);
  };

  return heights.map((h) => {
    let best = 0;
    let bestBottom = Infinity;
    for (let col = 0; col < PLACE_COLUMNS; col += 1) {
      const bottom = columnBottom(col);
      if (bottom < bestBottom) {
        best = col;
        bestBottom = bottom;
      }
    }
    const pos = { x: PLACE_ORIGIN + best * colWidth, y: bestBottom };
    occupied.push({ ...pos, w: BOARD_CARD_WIDTH, h });
    return pos;
  });
}

/**
 * Give every asset item with no saved position an x/y that doesn't overlap anything
 * already on the canvas (positioned assets, text elements) or each other, using each
 * card's estimated height. Mutates the items and returns the ones it placed, so a
 * caller can persist them and later re-check them against real rendered heights.
 */
export function placeNewItems(assetItems, textItems) {
  const pending = assetItems.filter((i) => i.x === undefined || i.y === undefined);
  if (!pending.length) return [];

  const occupied = [
    ...assetItems
      .filter((i) => i.x !== undefined && i.y !== undefined)
      .map((i) => ({ x: i.x, y: i.y, w: BOARD_CARD_WIDTH, h: boardItemHeight(i) })),
    ...textItems.map((t) => ({ x: t.x, y: t.y, w: t.w || 200, h: t.h || 80 })),
  ];
  const heights = pending.map((i) => boardItemHeight(i));
  packIntoColumns(occupied, heights).forEach((pos, n) => {
    pending[n].x = pos.x;
    pending[n].y = pos.y;
  });
  return pending;
}

export const itemKey = (item) => item.asset?.uuid || item.id;

/**
 * Resolves once `el` has a rendered height (it is in a visible section), or after a
 * timeout so a board that never becomes visible can't leave this pending forever.
 */
function whenLaidOut(el, timeoutMs = 15000) {
  return new Promise((resolve) => {
    if (el.offsetHeight > 0) {
      resolve();
      return;
    }
    const done = () => {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new ResizeObserver(() => {
      if (el.offsetHeight > 0) done();
    });
    const timer = setTimeout(done, timeoutMs);
    observer.observe(el);
  });
}

/**
 * Some previews carry no dimension metadata (documents, PDFs), so placeNewItems can only
 * guess their height. Once those images have loaded, re-pack the just-placed cards using
 * their real rendered heights so a taller-than-expected card doesn't sit on top of the
 * one below it. Cards with known dimensions never move. Returns true if anything moved.
 * @param {HTMLElement} block
 * @param {object[]} placed  items returned by placeNewItems
 * @param {string|null} persistId  collection to save the corrected positions to, if any
 */
export async function repackMeasuredItems(block, placed, persistId) {
  const canvas = block.querySelector('.board__canvas');
  if (!canvas || !placed.length) return false;
  const cardFor = (item) => canvas.querySelector(`.board__item[data-asc-asset="${CSS.escape(itemKey(item))}"]`);

  // The board's section can still be hidden (display: none) while the page loads, and a
  // hidden card measures 0px tall, which would pack every card flat on top of the next.
  // Wait until the board actually has layout before measuring anything.
  await whenLaidOut(block);

  const pending = [...canvas.querySelectorAll('.board__item img[data-asc-dims-estimated]')]
    .filter((img) => !img.complete);
  if (!pending.length && !placed.some((i) => cardFor(i)?.querySelector('img[data-asc-dims-estimated]'))) return false;
  await Promise.all(pending.map((img) => new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, 8000);
  })));

  const placedCards = new Set(placed.map(cardFor).filter(Boolean));
  const occupied = [...canvas.querySelectorAll('.board__item, .board__text-element')]
    .filter((el) => !placedCards.has(el))
    .map((el) => ({
      x: parseFloat(el.style.left) || 0,
      y: parseFloat(el.style.top) || 0,
      w: el.offsetWidth,
      h: el.offsetHeight,
    }));
  const cards = placed.map(cardFor);
  // A card that still reads 0 (not laid out, or no longer in the DOM) keeps its estimate.
  const positions = packIntoColumns(
    occupied,
    cards.map((el, n) => el?.offsetHeight || boardItemHeight(placed[n])),
  );

  let moved = false;
  positions.forEach((pos, n) => {
    const el = cards[n];
    if (!el || (parseFloat(el.style.left) === pos.x && parseFloat(el.style.top) === pos.y)) return;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    placed[n].x = pos.x;
    placed[n].y = pos.y;
    if (persistId) services.collections.updateItem(persistId, itemKey(placed[n]), pos);
    moved = true;
  });
  return moved;
}

export function computeFitViewport(cards, viewport) {
  if (!cards.length) return { panX: 0, panY: 0, zoom: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  cards.forEach((card) => {
    const x = parseFloat(card.style.left) || 0;
    const y = parseFloat(card.style.top) || 0;
    const w = card.offsetWidth || 240;
    const h = card.offsetHeight || 180;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  const PAD = 72;
  const PAD_TOP = 112; // extra clearance under the floating toolbar so cards aren't tucked under it
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  if (!contentW || !contentH || !vw || !vh) return { panX: 0, panY: 0, zoom: 1 };
  const zoom = Math.min(
    (vw - 2 * PAD) / contentW,
    (vh - PAD_TOP - PAD) / contentH,
    1.0,
  );
  const panX = (vw - contentW * zoom) / 2 - minX * zoom;
  const panY = PAD_TOP - minY * zoom;
  return { panX, panY, zoom };
}
