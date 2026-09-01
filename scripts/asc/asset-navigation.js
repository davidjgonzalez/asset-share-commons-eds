/** @owner user */
/**
 * asset-navigation — derives the "currently browsable list of assets" directly from the
 * DOM, for Prev/Next cycling in the asset details modal (blocks/details-modal/details-modal.js).
 *
 * Every asset card/tile already carries data-asc-asset="<uuid>" on its root element —
 * search result cards, board-mode cards, and collection board items — so the ordered list
 * can be read straight off whichever container is currently on the page, with no need for
 * search-results.js or board.js to separately track/expose their own list.
 */

const CONTAINER_SELECTOR = '[data-asc-results] [data-asc-asset], .board__canvas [data-asc-asset]';

/** @returns {string[]} de-duplicated asset ids, in DOM order */
export function getVisibleAssetIds() {
  const seen = new Set();
  const ids = [];
  document.querySelectorAll(CONTAINER_SELECTOR).forEach((el) => {
    const id = el.dataset.ascAsset;
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  });
  return ids;
}

/**
 * @param {string} currentId
 * @param {number} direction  -1 for previous, 1 for next
 * @returns {string|null} the neighboring asset id, or null if currentId isn't found or is at an edge
 */
export function getNeighborAssetId(currentId, direction) {
  const ids = getVisibleAssetIds();
  const i = ids.indexOf(currentId);
  if (i === -1) return null;
  const j = i + direction;
  return (j >= 0 && j < ids.length) ? ids[j] : null;
}
