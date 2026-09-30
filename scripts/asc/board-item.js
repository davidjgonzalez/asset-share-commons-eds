/**
 * board-item — default renderer for an asset item on the board/collection canvas.
 *
 * Swap in your own by setting `configurations.board.itemRenderer` to a function with
 * this same signature — items don't have to look like the default card at all. It must
 * return a single root element as an HTML string, carrying the attributes/classes the
 * board's interaction code depends on:
 *
 *   - `data-asc-asset="<uuid>"` on the root element — required for drag, click-to-open,
 *     rubber-band selection, and the minimap.
 *   - `style="left: Xpx; top: Ypx"` on the root element — required initial position;
 *     `item.x`/`item.y` when set, otherwise fall back to a default grid position.
 *   - `.board__item` class on the root element — required for drag/selection/search to
 *     find it (in addition to whatever your own root class is).
 *   - Remove button: `<button class="board__item-remove" data-asc-asset="<uuid>">` —
 *     only when `config.mode === 'interactive'`.
 *   - Notes button: `<button class="board__notes-btn" data-asc-asset="<uuid>">` — only
 *     when `config.mode === 'interactive' && config.notes`; add `.board__item--has-note`
 *     to the root when `item.notes` is set, so the button's "has a note" style applies.
 *   - `data-asc-notes="<text>"` on the root whenever `config.notes` — required (in both
 *     interactive and view-only/read-only modes) for the hover-preview popover to read
 *     the note text from.
 *   - Optional `.asc-ui-corner-ribbon` element (e.g. `<span class="asc-ui-corner-ribbon">
 *     Notes</span>`) when the item has a note — the default renders one to flag it
 *     visually; purely decorative, so mark it `aria-hidden="true"`.
 *   - Optional `data-filter="<lowercase search text>"` on the root — required only if
 *     you want the board's search box (`search-properties` config) to match this item.
 *   - `item.forbidden` — true when the asset lookup came back as a definite "no
 *     permission" (see AssetAccessError) rather than a generic not-found; `item.asset`
 *     is `null` in that case, only `item.id` is available. The default renderer shows a
 *     locked placeholder (see `lockedBoardItemHtml`) instead of attempting a real card.
 *
 * @param {{ id: string, asset: Asset|null, forbidden?: boolean, notes?: string, x?: number, y?: number }} item
 * @param {number} index  Position in the render list — used for the default grid layout
 *   when `item.x`/`item.y` are unset.
 * @param {object} config  The board block's parsed config (see blocks/board/board.js
 *   parseConfig): { mode, notes, searchProperties, ... }.
 * @returns {string} A single root element as an HTML string.
 */
import services from './core/services/services.js';
import { escHtml, escAttr } from './html.js';

const ICONS = {
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  copyUrl: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  copyImage: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  notes: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-3a4 4 0 0 1-2-3.46V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4z"/></svg>',
  lock: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
};

/**
 * A board item whose asset lookup came back as a definite "no permission" (see
 * AssetAccessError in the Core search providers) rather than a generic not-found — e.g.
 * the recipient of a shared collection/board lacks read access to this specific asset.
 * There's no Asset data to render a preview/title/actions from, only the id it was
 * asked to resolve, so this renders a locked placeholder instead of a real card.
 * Still carries `data-asc-asset` (required for drag/selection/minimap) so the owner can
 * still select and remove it from the collection; rendition/notes actions are omitted
 * since there's nothing for them to act on.
 */
function lockedBoardItemHtml(item, x, y, config) {
  const interactive = config.mode === 'interactive';
  return `
    <article class="asc-ui-asset-card asc-ui-asset-card--overlay-on-hover board__item board__item--locked"
             style="left: ${x}px; top: ${y}px"
             role="button"
             tabindex="0"
             aria-label="Asset unavailable — you don't have access to this item"
             data-asc-asset="${escAttr(item.id)}">
      <div class="asc-ui-asset-card__thumb">
        ${interactive ? `
        <div class="asc-ui-asset-card__overlay">
          <button type="button"
                  class="asc-ui-icon-btn board__item-remove"
                  data-asc-asset="${escAttr(item.id)}"
            aria-label="Remove unavailable item from collection">${ICONS.close}</button>
        </div>` : ''}
        <div class="asc-ui-filetype" title="You don't have access to this asset">
          <span class="asc-ui-filetype__glyph">${ICONS.lock}</span>
          <span class="asc-ui-filetype__ext">No access</span>
        </div>
      </div>
    </article>`;
}

function buildSearchStr(asset, config) {
  if (!config.searchProperties.length) return '';
  return config.searchProperties.map((prop) => asset.getProperty(prop).text).join(' ').toLowerCase().trim();
}

/**
 * Preview image for the board. Uses the display ladder
 * (services.renditions.getDisplaySrcset, configurations.js renditions.display): for
 * images that's web-optimized-delivery, which resizes proportionally (width only, no
 * crop), so the card keeps the asset's own shape. board.js re-points `img.sizes` as the
 * board's pan/zoom canvas scales up, so the browser fetches a larger tier once zoomed in
 * rather than upscaling a blurry one. Non-image assets (PDF, video, doc) get AEM's square
 * thumbnail renditions from the same ladder. Falls back to the single "web"/"original"
 * rendition for images when no display ladder resolves.
 */
function resolvePreviewImage(asset) {
  const width = Number(asset.getProperty('width').data) || null;
  const height = Number(asset.getProperty('height').data) || null;

  const srcset = services.renditions.getDisplaySrcset(asset);
  if (srcset.length) {
    return {
      url: services.renditions.getDisplayUrl(asset),
      srcset: srcset.map((r) => `${r.url} ${r.size.width}w`).join(', '),
      width,
      height,
    };
  }
  if (asset.mimeType?.startsWith('image/')) {
    const rendition = asset.getRendition('web') || asset.getRendition('original');
    if (rendition?.url) {
      return {
        url: rendition.url,
        srcset: null,
        width: width || rendition.width || null,
        height: height || rendition.height || null,
      };
    }
  }
  return { url: services.renditions.getDisplayUrl(asset), srcset: null, width, height };
}

/** Width of a board card in canvas px (kept in sync with .board__item in board.css). */
export const BOARD_CARD_WIDTH = 240;

// Aspect ratio (w:h) to reserve for a preview with no dimension metadata, so the card
// has a definite height before its image loads: 4:3 for images, square for the
// thumbnail renditions AEM generates for everything else.
function previewDimensions(asset, preview) {
  if (preview.width && preview.height) return { width: preview.width, height: preview.height, known: true };
  return asset.mimeType?.startsWith('image/')
    ? { width: 4, height: 3, known: false }
    : { width: 1, height: 1, known: false };
}

/**
 * Rendered height, in canvas px, of an asset item's card. Callers laying out
 * items that don't have a saved position yet use this to keep them from overlapping,
 * since items don't share an aspect ratio (a portrait card is much taller than a
 * landscape one).
 */
export function boardItemHeight(item) {
  if (item.forbidden || !item.asset) return Math.round(BOARD_CARD_WIDTH * 0.75);
  const { width, height } = previewDimensions(item.asset, resolvePreviewImage(item.asset));
  return Math.round((BOARD_CARD_WIDTH * height) / width);
}

export default function boardItemHtml(item, index, config) {
  // Items with no saved position are placed by the board (see placeNewItems in board.js),
  // which sets x/y before rendering. This fallback only covers a caller that doesn't.
  const x = item.x !== undefined ? item.x : 80 + (index % 8) * 260;
  const y = item.y !== undefined ? item.y : 80 + Math.floor(index / 8) * 220;

  if (item.forbidden) {
    return lockedBoardItemHtml(item, x, y, config);
  }

  const { asset, notes: itemNotes } = item;
  const preview = resolvePreviewImage(asset);
  const dims = previewDimensions(asset, preview);
  const searchStr = buildSearchStr(asset, config);
  const interactive = config.mode === 'interactive';
  const showNotes = config.notes;

  // A board item is just a preview: no title/meta body, no footer — the thumb shows the
  // image at its own native aspect ratio (asc-ui-asset-card--natural), never cropped.
  return `
    <article class="asc-ui-asset-card asc-ui-asset-card--natural asc-ui-asset-card--overlay-on-hover board__item${showNotes && itemNotes ? ' board__item--has-note' : ''}"
             style="left: ${x}px; top: ${y}px"
             role="button"
             tabindex="0"
             aria-label="${escAttr(asset.title)}"
             data-asc-asset="${escAttr(asset.uuid)}"
             ${searchStr ? `data-filter="${escAttr(searchStr)}"` : ''}
             ${showNotes ? `data-asc-notes="${escAttr(itemNotes || '')}"` : ''}>
      <div class="asc-ui-asset-card__thumb">
        ${interactive ? `
        <div class="asc-ui-asset-card__overlay">
          <button type="button"
                  class="asc-ui-icon-btn board__item-remove"
                  data-asc-asset="${escAttr(asset.uuid)}"
            aria-label="Remove ${escHtml(asset.title)} from collection">${ICONS.close}</button>
        </div>` : ''}
        <div class="asc-ui-asset-card__overlay asc-ui-asset-card__overlay--bottom board__rendition-actions">
          <button type="button" class="asc-ui-icon-btn board__rendition-action"
            data-board-action="download" data-asc-asset="${escAttr(asset.uuid)}"
            aria-haspopup="true" aria-expanded="false" aria-label="Download rendition" title="Download">${ICONS.download}</button>
          <button type="button" class="asc-ui-icon-btn board__rendition-action"
            data-board-action="copy-url" data-asc-asset="${escAttr(asset.uuid)}"
            aria-haspopup="true" aria-expanded="false" aria-label="Copy rendition URL" title="Copy URL">${ICONS.copyUrl}</button>
          <button type="button" class="asc-ui-icon-btn board__rendition-action"
            data-board-action="copy-image" data-asc-asset="${escAttr(asset.uuid)}"
            aria-haspopup="true" aria-expanded="false" aria-label="Copy image" title="Copy Image">${ICONS.copyImage}</button>
        </div>
        ${interactive && showNotes ? `
        <div class="asc-ui-asset-card__overlay asc-ui-asset-card__overlay--bottom board__notes-overlay">
          <button type="button"
                  class="asc-ui-icon-btn board__notes-btn"
                  data-asc-asset="${escAttr(asset.uuid)}"
                  aria-label="Add or edit note"
            title="Add or edit note">${ICONS.notes}</button>
        </div>` : ''}
        ${!interactive && showNotes && itemNotes ? `
        <div class="asc-ui-asset-card__overlay asc-ui-asset-card__overlay--bottom board__notes-overlay" aria-hidden="true">
          <span class="asc-ui-icon-btn board__notes-btn">${ICONS.notes}</span>
        </div>` : ''}
        <img src="${escAttr(preview.url)}"${preview.srcset ? ` srcset="${escAttr(preview.srcset)}" sizes="240px"` : ''} width="${dims.width}" height="${dims.height}"${dims.known ? '' : ' data-asc-dims-estimated loading="eager"'} alt="${escHtml(asset.description || asset.title || asset.name || '')}"${dims.known ? ' loading="lazy"' : ''} draggable="false">
      </div>
    </article>`;
}
