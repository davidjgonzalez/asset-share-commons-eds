/** @owner user */
/**
 * details-rendition-metadata — displays metadata for the active rendition.
 *
 * Defaults to the "original" rendition on load. Updates when a rendition is
 * activated (click) or previewed (hover) via asc:rendition:activate /
 * asc:rendition:preview events dispatched by details-renditions.
 *
 * Authoring (da.live table):
 *
 *   | details-rendition-metadata |              |
 *   | Rendition                  | label        |
 *   | Format                     | file-type    |
 *   | File size                  | file-size    |
 *   | Dimensions                 | dimensions   |
 *   | Type                       | type         |
 *
 * Available rendition fields:
 *   label / id / name     rendition identifier and display name
 *   file-type             authored fileType, else MIME-derived label (e.g. "JPEG")
 *   format                MIME-derived label (always)
 *   file-size             human-readable size (e.g. "2.4 MB")
 *   width / height        pixel dimensions
 *   dimensions            "width × height" combined string
 *   url                   rendition URL
 *   type                  static | url | asset-delivery
 *   usecase               usecase tag from the definition
 *   description           description from the definition
 */

import Asset from '../../scripts/asc/models/asset.js';

const MULTI_VALUE_LIMIT = 10;

export default async function decorate(block) {
  const fields = [...block.children].reduce((acc, row) => {
    const cells = [...row.children];
    const label = cells[0]?.textContent.trim();
    const property = cells[1]?.textContent.trim();
    if (label && property) acc.push([label, property]);
    return acc;
  }, []);

  const asset = await Asset.create(block);
  if (!asset) {
    block.innerHTML = '';
    return;
  }

  const defaultRendition = asset.getRendition('original') || asset.renditions[0];
  let activeRendition = defaultRendition;

  const dl = document.createElement('dl');
  dl.className = 'asc-ui-metadata';
  block.innerHTML = '';
  block.appendChild(dl);

  const render = (rendition) => {
    if (!rendition) { dl.innerHTML = ''; return; }
    const ctx = buildContext(asset, rendition);
    dl.innerHTML = fields
      .map(([label, field]) => {
        const value = ctx[field] ?? '';
        if (value === '') return '';
        return `
          <div class="asc-ui-metadata__row">
            <dt class="asc-ui-metadata__term">${escHtml(label)}</dt>
            <dd class="asc-ui-metadata__value">${renderValue(value)}</dd>
          </div>`;
      })
      .filter(Boolean)
      .join('');
  };

  block.addEventListener('click', (e) => {
    const btn = e.target.closest('.asc-view-more-btn');
    if (!btn) return;
    const dd = btn.closest('.asc-ui-metadata__value');
    const extras = dd?.querySelector('.asc-ui-chip-extras');
    if (!extras) return;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    extras.classList.toggle('is-hidden', expanded);
    btn.setAttribute('aria-expanded', String(!expanded));
    btn.textContent = expanded ? `View more (${btn.dataset.extrasCount})` : 'View less';
  });

  render(activeRendition);

  document.body.addEventListener('asc:rendition:activate', (e) => {
    activeRendition = e.detail.rendition;
    render(activeRendition);
  });

  document.body.addEventListener('asc:rendition:preview', (e) => {
    render(e.detail.rendition ?? activeRendition);
  });
}

function renderValue(value) {
  if (Array.isArray(value)) {
    const chips = (items) => items.map((v) => `<span class="asc-ui-chip">${escHtml(String(v))}</span>`).join('');
    if (value.length > MULTI_VALUE_LIMIT) {
      const count = value.length - MULTI_VALUE_LIMIT;
      return `<span class="asc-ui-chip-list">${chips(value.slice(0, MULTI_VALUE_LIMIT))}<span class="asc-ui-chip-extras is-hidden">${chips(value.slice(MULTI_VALUE_LIMIT))}</span></span>`
        + `<button class="asc-view-more-btn" type="button" aria-expanded="false" data-extras-count="${count}">View more (${count})</button>`;
    }
    return `<span class="asc-ui-chip-list">${chips(value)}</span>`;
  }
  if (typeof value === 'object' && value !== null) {
    if (value.width != null && value.height != null) return escHtml(`${value.width} × ${value.height}`);
    return '';
  }
  return escHtml(String(value));
}

function buildContext(asset, rendition) {
  const base = typeof rendition.toObject === 'function' ? rendition.toObject() : { ...rendition };
  const fmtLabel = mimeToLabel(base.mimeType);
  return {
    ...base,
    format: fmtLabel,
    'file-type': base.fileType || fmtLabel,
    'file-size': base.fileSize ? formatBytes(base.fileSize) : '',
    dimensions: (base.width && base.height) ? `${base.width} × ${base.height}` : '',
  };
}

function mimeToLabel(mimeType) {
  const map = {
    'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/gif': 'GIF', 'image/webp': 'WebP',
    'image/tiff': 'TIFF', 'image/svg+xml': 'SVG', 'video/mp4': 'MP4', 'video/quicktime': 'MOV',
    'video/x-msvideo': 'AVI', 'application/pdf': 'PDF', 'application/zip': 'ZIP',
  };
  return map[mimeType] || mimeType?.split('/')[1]?.toUpperCase() || '';
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.ceil(bytes / (1024 * 1024))} MB`;
  return `${(Math.ceil((bytes / (1024 * 1024 * 1024)) * 10) / 10).toFixed(1)} GB`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
