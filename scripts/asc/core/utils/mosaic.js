// ASC Core — do not edit.
/**
 * Adaptive thumbnail-mosaic layout math shared by any block previewing a
 * variable-length list of assets as one card (collections, share-directory).
 * Bounded to 5 columns x 3 rows (15 visible thumbnails max) — see the
 * asc-ui-collection-card kit primitive (styles/ui-kit.css, docs/UI_KIT.md)
 * for the CSS/markup side.
 */

export const MAX_MOSAIC_THUMBS = 15;

const MOSAIC_HEIGHT_BY_ROWS = { 1: 260, 2: 220, 3: 200 };

/**
 * Splits n thumbnails into up to 3 rows of up to 5 columns each, choosing the
 * row count that keeps every row's mini-grid sized to exactly the thumbnails
 * it's given — never more — so a trailing partial row never leaves empty
 * cells; those thumbnails just render wider instead. n<=5 stays a single row
 * (biggest thumbnails); more assets add rows, not blank cells.
 */
export function mosaicRowCounts(n) {
  if (n <= 5) return [n];
  const rows = n <= 10 ? 2 : 3;
  const cols = Math.min(5, Math.ceil(n / rows));
  const counts = [];
  let remaining = n;
  for (let r = 0; r < rows; r += 1) {
    const rowCount = r === rows - 1 ? remaining : cols;
    counts.push(rowCount);
    remaining -= rowCount;
  }
  return counts;
}

/** Fewer rows → taller mosaic → bigger thumbnails. */
export function mosaicHeight(rowCount) {
  return MOSAIC_HEIGHT_BY_ROWS[rowCount] || 200;
}
