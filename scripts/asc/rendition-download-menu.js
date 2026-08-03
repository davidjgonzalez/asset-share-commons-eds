/**
 * rendition-download-menu — a floating "pick a rendition" menu, shared by
 * search-results's quick-download and quick-copy-url card buttons. Each
 * trigger supplies its own `onSelect` handler and an optional `title` (shown
 * as a light-grey header row above the rendition list, e.g. "Downloads" or
 * "Copy URL for {asset}") so the same picker UI serves both actions.
 *
 * Built entirely from UI Kit primitives (.asc-ui-dropdown__panel + .asc-ui-menu),
 * but positioned via JS and portaled to <body> (or the enclosing <dialog>, so it
 * still renders above the modal's native top layer) instead of the kit's default
 * CSS-relative anchoring — both call sites sit inside overflow-clipped ancestors
 * (the asset-teaser card's `overflow: hidden`, the details dialog's scrollable
 * body), which would otherwise clip a `position: absolute` panel.
 *
 * File sizes are resolved lazily (HEAD request) only when missing from the
 * asset's own JCR metadata, and deduped by URL — the two blocks intentionally
 * don't share an in-memory cache; hitting the same rendition URL twice resolves
 * the second time from the browser's own HTTP cache.
 */
import services from './core/services/services.js';
import { escHtml, escAttr } from './html.js';

let panelEl = null;
let openTrigger = null;
let renditionsById = null;
let selectHandler = null;
const prefetchedUrls = new Set();

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.ceil(bytes / (1024 * 1024))} MB`;
  return `${(Math.ceil((bytes / (1024 * 1024 * 1024)) * 10) / 10).toFixed(1)} GB`;
}

const MIME_TO_FORMAT = {
  'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/gif': 'GIF', 'image/webp': 'WEBP',
  'image/tiff': 'TIFF', 'image/svg+xml': 'SVG', 'video/mp4': 'MP4', 'video/quicktime': 'MOV',
  'video/x-msvideo': 'AVI', 'application/pdf': 'PDF', 'application/zip': 'ZIP',
};

/** Human-readable file format (e.g. "JPG"), from mimeType or the rendition's filename extension. */
function formatType(rendition) {
  if (rendition.mimeType) {
    const mapped = MIME_TO_FORMAT[rendition.mimeType];
    if (mapped) return mapped;
  }
  const ext = rendition.filename?.split('.').pop();
  return ext ? ext.toUpperCase() : '';
}

/** Combine file size and format into a single meta string, e.g. "151 KB · JPG". */
function formatMeta(rendition) {
  return [formatBytes(rendition.fileSize), formatType(rendition)].filter(Boolean).join(' · ');
}

// Curated, site-owner-defined renditions only (configurations.renditions.definitions)
// — mirrors the action-download dialog's rendition checklist. Deliberately narrower
// than services.renditions.getRenditions(), which also surfaces auto-detected
// technical variants (e.g. every smart-crop preset) that aren't meant as end-user
// download choices.
function downloadableRenditions(asset) {
  return services.renditions.definitions
    .filter((def) => def.visible !== false)
    .map((def) => services.renditions.getRendition(asset, def.id))
    .filter((r) => r?.url);
}

export function closeRenditionMenu() {
  if (!panelEl || panelEl.hidden) return;
  panelEl.hidden = true;
  openTrigger?.setAttribute('aria-expanded', 'false');
  openTrigger = null;
  renditionsById = null;
  selectHandler = null;
}

function ensurePanel() {
  if (panelEl) return panelEl;

  panelEl = document.createElement('div');
  panelEl.className = 'asc-ui-dropdown__panel';
  panelEl.style.position = 'fixed';
  panelEl.hidden = true;
  document.body.append(panelEl);

  panelEl.addEventListener('click', (event) => {
    const item = event.target.closest('.asc-ui-menu__item');
    const rendition = item && renditionsById?.get(item.dataset.renditionId);
    if (!rendition) return;
    event.preventDefault();
    selectHandler?.(rendition);
    closeRenditionMenu();
  });

  document.addEventListener('click', (event) => {
    if (panelEl.hidden || panelEl.contains(event.target) || openTrigger?.contains(event.target)) return;
    closeRenditionMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeRenditionMenu();
  });
  window.addEventListener('scroll', () => closeRenditionMenu(), { capture: true, passive: true });
  window.addEventListener('resize', () => closeRenditionMenu());

  return panelEl;
}

function positionPanel(trigger) {
  const margin = 8;
  const rect = trigger.getBoundingClientRect();

  let left = rect.left;
  let top = rect.bottom + 6;
  const { offsetWidth: w, offsetHeight: h } = panelEl;

  if (left + w > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - w - margin);
  if (top + h > window.innerHeight - margin) top = Math.max(margin, rect.top - h - 6);

  panelEl.style.left = `${left}px`;
  panelEl.style.top = `${top}px`;
}

/**
 * Warm missing file sizes for an asset's renditions via HEAD, so the menu (and
 * any other block reading the same URLs) doesn't have to wait for them later.
 * Safe to call speculatively (e.g. on hover) — a no-op for renditions whose size
 * is already known or already in flight.
 * @param {Asset} asset
 */
export function prefetchRenditionSizes(asset) {
  downloadableRenditions(asset)
    .filter((r) => !r.fileSize && !prefetchedUrls.has(r.url))
    .forEach((rendition) => {
      prefetchedUrls.add(rendition.url);
      fetchAndApplySize(rendition);
    });
}

async function fetchAndApplySize(rendition) {
  try {
    const isAemUrl = rendition.url.startsWith(services.aem.getHost());
    const headers = isAemUrl ? await services.aem.getHeaders() : {};
    const res = await fetch(rendition.url, { method: 'HEAD', credentials: isAemUrl ? 'include' : 'omit', headers });
    if (!res.ok) return;
    const contentLength = res.headers.get('content-length');
    if (!contentLength) return;

    rendition.fileSize = parseInt(contentLength, 10);
    if (!panelEl || panelEl.hidden || renditionsById?.get(rendition.id) !== rendition) return;
    panelEl.querySelector(`[data-rendition-id="${escAttr(rendition.id)}"] .asc-ui-menu__item-meta`)
      ?.replaceChildren(document.createTextNode(formatMeta(rendition)));
  } catch {
    // Network error — leave the size blank rather than blocking the menu.
  }
}

/**
 * Toggle a floating menu of `asset`'s downloadable renditions, anchored to `trigger`.
 * Clicking a menu item calls `onSelect(rendition)` and closes the menu.
 * @param {HTMLElement} trigger
 * @param {Asset} asset
 * @param {(rendition: object) => void} onSelect
 * @param {{ title?: string }} [options] - optional light-grey header row above the list
 */
export function toggleRenditionMenu(trigger, asset, onSelect, { title } = {}) {
  const el = ensurePanel();

  if (!el.hidden && openTrigger === trigger) {
    closeRenditionMenu();
    return;
  }

  const renditions = downloadableRenditions(asset);
  if (!renditions.length) return;

  // Re-parent into the enclosing <dialog> when present — native <dialog> promotes
  // to the browser's top layer, so a body-level sibling would render behind it.
  const host = trigger.closest('dialog') || document.body;
  if (el.parentElement !== host) host.append(el);

  el.innerHTML = `${title ? `<div class="asc-ui-menu__header">${escHtml(title)}</div>` : ''}
    <ul class="asc-ui-menu">${renditions.map((r) => `
    <li><button type="button" class="asc-ui-menu__item" data-rendition-id="${escAttr(r.id)}">
      <span class="asc-ui-menu__item-label">${escHtml(r.label || r.id)}</span>
      <span class="asc-ui-menu__item-meta">${escHtml(formatMeta(r))}</span>
    </button></li>`).join('')}</ul>`;

  openTrigger = trigger;
  renditionsById = new Map(renditions.map((r) => [r.id, r]));
  selectHandler = onSelect;

  el.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  positionPanel(trigger);

  prefetchRenditionSizes(asset);
}
