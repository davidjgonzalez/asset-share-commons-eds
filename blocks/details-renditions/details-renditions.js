/** @owner user */
/**
 * details-renditions — lists an asset's renditions as rows in a UI Kit
 * .asc-ui-table with author-configurable columns.
 *
 * Authoring (da.live table):
 *
 *   | details-renditions |                |
 *   | renditions  | original, web        |  ← optional: which renditions (by name)
 *   |             |                      |    and order. Omit = all, "original"
 *   |             |                      |    first then A→Z.
 *   | Name        | name                 |  ← column: Title | value
 *   | File size   | file-size            |
 *   | W x H       | dimensions           |
 *   |             | download, share      |  ← column whose value is action
 *   |             |                      |    keyword(s) → renders icon buttons
 *
 * Column values resolve against the CURRENT rendition; the owning asset is
 * reachable via `asset.…`. A value may be a bare path (`name`, `file-size`) or
 * contain {{ }} tokens for mixed text (`{{ width }}×{{ height }}`).
 *
 *   name / label / url / format / file-size / file-type / dimensions   rendition
 *   asset.properties.title         asset property
 *   asset.renditions['web'].url    a specific rendition off the asset
 *   asset.file-size                bare term → asset.getProperty('file-size')
 *
 * Path syntax: dot (`a.b`), bracket (`a['b']`, `a[b]`), and nesting combine.
 *
 * Actions (a column whose value is one or more of these keywords):
 *   download   download link for the rendition
 *   share      dispatches asc:rendition:share
 */
import Asset from '../../scripts/asc/models/asset.js';
import services from '../../scripts/asc/services/services.js';

const KNOWN_ACTIONS = new Set(['download', 'share']);

const DEFAULT_COLUMNS = [
  { title: 'Rendition', value: 'label' },
  { title: 'Format', value: 'format' },
  { title: 'Size', value: 'file-size' },
  { title: '', value: 'download' },
];

export default async function decorate(block) {
  let renditionIds = [];
  let description = '';
  const columns = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const key = cells[0]?.textContent.trim() || '';
    const val = cells[1]?.textContent.trim() || '';
    const lower = key.toLowerCase();
    if (lower === 'renditions') {
      renditionIds = parseList(cells[1]);
    } else if (lower === 'description') {
      description = val;
    } else if (key || val) {
      columns.push({ title: key, value: val });
    }
  });
  const cols = columns.length ? columns : DEFAULT_COLUMNS;

  const asset = await Asset.create(block);
  if (!asset) {
    block.innerHTML = '';
    return;
  }

  const renditions = resolveRenditions(asset, renditionIds);
  if (!renditions.length) {
    block.innerHTML = `
      <div class="asc-ui-empty-state">
        <p class="asc-ui-empty-state__title">No renditions available</p>
        <p class="asc-ui-empty-state__hint">This asset has no downloadable renditions.</p>
      </div>`;
    return;
  }

  // Pre-classify each column: an "action" column lists known action keywords.
  const colActions = cols.map((col) => parseActions(col.value));

  const rows = renditions.map((rendition) => {
    const ctx = renditionContext(asset, rendition);
    const cells = cols.map((col, i) => (colActions[i]
      ? actionCell(asset, rendition, colActions[i])
      : valueCell(col, ctx, asset)));
    return `<tr>${cells.join('')}</tr>`;
  }).join('');

  const descriptionHtml = description ? `
    <div class="details-renditions__header">
      <p class="details-renditions__description">${esc(description)}</p>
    </div>` : '';

  block.innerHTML = `
    ${descriptionHtml}
    <div class="asc-ui-table-wrap">
      <table class="asc-ui-table">
        <thead>
          <tr>${cols.map((col, i) => `<th${colActions[i] ? ' class="details-renditions__action"' : ''}>${esc(col.title)}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function valueCell(col, ctx, asset) {
  return `<td>${esc(resolveValue(col.value, ctx, asset))}</td>`;
}

function actionCell(asset, rendition, actions) {
  const buttons = actions.map((a) => renderAction(asset, rendition, a)).filter(Boolean).join('');
  return `<td class="details-renditions__action"><div class="details-renditions__actions">${buttons}</div></td>`;
}

function renderAction(asset, rendition, action) {
  const ref = `data-asc-asset="${asset.uuid}" data-asc-rendition="${rendition.id}"`;
  switch (action) {
    case 'download':
      return `<a class="btn btn--ghost btn--icon btn--sm" href="${esc(rendition.url)}"
           download="${esc(buildFilename(asset, rendition))}" title="Download" aria-label="Download"
           data-asc-action="rendition:download@click" ${ref}>${ICONS.download}</a>`;
    case 'share':
      return `<button class="btn btn--ghost btn--icon btn--sm" type="button" title="Share" aria-label="Share"
           data-asc-action="rendition:share@click" ${ref}>${ICONS.share}</button>`;
    default:
      return '';
  }
}

/**
 * Which renditions to show, in order.
 * - Explicit names → that order.
 * - Otherwise all visible: "original" first, then alphabetical by name.
 */
function resolveRenditions(asset, ids) {
  if (ids.length) {
    return ids
      .map((id) => services.renditions.getRendition(asset, id)
        || asset.renditions.find((r) => r.id === id || r.name === id))
      .filter(Boolean);
  }
  return asset.renditions
    .filter((r) => r.visible !== false)
    .sort((a, b) => {
      const an = String(a.name || a.id || '').toLowerCase();
      const bn = String(b.name || b.id || '').toLowerCase();
      if (an === bn) return 0;
      if (an === 'original') return -1;
      if (bn === 'original') return 1;
      return an.localeCompare(bn);
    });
}

// ─── Template resolution ──────────────────────────────────────────────────────

/** Build the per-rendition resolution context: rendition fields + display aliases. */
function renditionContext(asset, rendition) {
  const base = typeof rendition.toObject === 'function' ? rendition.toObject() : { ...rendition };
  return {
    ...base,
    format: mimeToLabel(base.mimeType),
    'file-type': mimeToLabel(base.mimeType),
    'file-size': base.fileSize ? formatBytes(base.fileSize) : '',
    dimensions: (base.width && base.height) ? `${base.width} × ${base.height}` : '',
    filename: buildFilename(asset, rendition),
  };
}

/** Resolve a column value: bare path, or {{ }} token template for mixed text. */
function resolveValue(value, ctx, asset) {
  const v = String(value).trim();
  if (v.includes('{{')) {
    return v.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => stringify(resolvePath(expr.trim(), ctx, asset)));
  }
  return stringify(resolvePath(v, ctx, asset));
}

/** Resolve a path expression. `asset.…` switches to the asset; else off the rendition ctx. */
function resolvePath(expr, ctx, asset) {
  const segments = parsePath(expr);
  if (!segments.length) return null;
  if (segments[0] === 'asset') return resolveAssetPath(segments.slice(1), asset);
  return walk(ctx, segments);
}

/**
 * Resolve a path against the asset. Well-known sub-objects: `properties`,
 * `renditions`. Anything else is treated as a property: `file-size` →
 * getProperty('file-size').
 */
function resolveAssetPath(segments, asset) {
  if (!segments.length) return null;
  const [head, ...rest] = segments;
  if (head === 'properties') {
    return rest.length ? walk(asset.getProperty(rest[0]), rest.slice(1)) : null;
  }
  if (head === 'renditions') {
    if (!rest.length) return null;
    const rend = services.renditions.getRendition(asset, rest[0])
      || asset.renditions.find((r) => r.id === rest[0] || r.name === rest[0]);
    return walk(rend, rest.slice(1));
  }
  return walk(asset.getProperty(head), rest);
}

/** Walk remaining segments into a value (object/array navigation). */
function walk(value, segments) {
  let cur = value;
  for (let i = 0; i < segments.length; i += 1) {
    if (cur == null) return null;
    cur = cur[segments[i]];
  }
  return cur;
}

/** Parse `a.b['c'][d].e` into ['a','b','c','d','e']. */
function parsePath(expr) {
  const segments = [];
  const re = /\[\s*'([^']*)'\s*\]|\[\s*"([^"]*)"\s*\]|\[\s*([^\]]+?)\s*\]|\.?([^.[\]]+)/g;
  let m = re.exec(expr);
  while (m !== null) {
    const seg = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
    if (seg) segments.push(seg);
    m = re.exec(expr);
  }
  return segments;
}

/** Coerce a resolved value to a display string ({width,height} and arrays formatted). */
function stringify(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    if (value.width != null && value.height != null) return `${value.width} × ${value.height}`;
    return '';
  }
  return String(value);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseActions(value) {
  const tokens = String(value).split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  return (tokens.length && tokens.every((t) => KNOWN_ACTIONS.has(t))) ? tokens : null;
}

function parseList(cell) {
  if (!cell) return [];
  const ps = [...cell.querySelectorAll('p')];
  const text = ps.length ? ps.map((p) => p.textContent).join(' ') : cell.textContent;
  return String(text).split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
}

function buildFilename(asset, rendition) {
  const base = asset.filename ? asset.filename.replace(/\.[^.]+$/, '') : asset.title;
  const ext = mimeToExt(rendition.mimeType) || asset.fileExtension || '';
  return ext ? `${base}.${ext}` : base;
}

function mimeToExt(mimeType) {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/tiff': 'tif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'video/x-msvideo': 'avi', 'application/pdf': 'pdf', 'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
  };
  return map[mimeType] || mimeType?.split('/')[1] || '';
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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ICONS = {
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  share: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
};
