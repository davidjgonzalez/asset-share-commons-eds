/** @owner user */
/**
 * details-renditions — lists an asset's renditions as rows in a UI Kit
 * .asc-ui-table with author-configurable columns.
 *
 * Authoring (da.live table):
 *
 *   | details-renditions |                |
 *   | renditions  | original, web        |  ← optional: which renditions (by name)
 *   |             |                      |    and order. Omit, or use "all", to show
 *   |             |                      |    every visible rendition from configurations.js
 *   |             |                      |    (include/exclude filters applied), "original"
 *   |             |                      |    first then A→Z.
 *   | display     | cards                |  ← optional: "cards" for card grid,
 *   |             |                      |    default is table.
 *   | Name        | name                 |  ← column: Title | value (table mode)
 *   | File size   | file-size            |
 *   | W x H       | dimensions           |
 *   |             | download, share      |  ← column whose value is action
 *   |             |                      |    keyword(s) → renders icon buttons
 *
 * Column values resolve against the CURRENT rendition; the owning asset is
 * reachable via `asset.…`. A value may be a bare path (`name`, `file-size`) or
 * contain {{ }} tokens for mixed text (`{{ width }}×{{ height }}`).
 *
 * Rendition fields (use as bare column values):
 *   id / name        rendition key (e.g. "original", "web")
 *   label            display name from the rendition definition
 *   description      optional description from the definition
 *   url              download URL
 *   mimeType         raw MIME type string (e.g. "image/jpeg")
 *   format           short format label derived from MIME type (e.g. "JPEG")
 *   file-type        fileType from the definition if set, else same as format
 *   file-size        human-readable size (e.g. "2.4 MB")
 *   width            pixel width (number)
 *   height           pixel height (number)
 *   dimensions       "width × height" string
 *   filename         suggested download filename (base + ext)
 *   type             rendition type: "static" | "url" | "dm-openapi"
 *   path             JCR node path (static renditions only)
 *   usecase          usecase string from the definition (if authored)
 *
 * Asset fields (prefix with `asset.`):
 *   asset.properties.title         asset property via getProperty()
 *   asset.renditions['web'].url    a specific rendition off the asset
 *   asset.file-size                bare term → asset.getProperty('file-size')
 *
 * Path syntax: dot (`a.b`), bracket (`a['b']`, `a[b]`), and nesting combine.
 *
 * Actions (a column whose value is one or more of these keywords):
 *   download   download link for the rendition
 *   share      dispatches asc:rendition:share
 *   copy-url   copies the rendition URL to the clipboard
 *   preview    thumbnail image of the rendition; column title may be left empty.
 *              Image renditions use their own URL; non-image renditions fall back
 *              to the asset thumbnail.
 */
import Asset from '../../scripts/asc/models/asset.js';
import services from '../../scripts/asc/services/services.js';
import { delegateEvent } from '../../scripts/asc/utils/events.js';
import { snapAspectRatio } from '../../scripts/asc/utils/images.js';

const KNOWN_ACTIONS = new Set(['download', 'share', 'copy-url']);
const PREVIEW_KEYWORD = 'preview';

// Allowed inline tags for the instructions field — block-level wrappers are
// unwrapped (their text content is kept); disallowed inline tags are stripped.
const INLINE_TAGS = new Set(['strong', 'em', 'b', 'i', 'u', 's', 'code', 'br', 'span']);

function sanitizeInline(cell) {
  const el = cell.cloneNode(true);
  el.querySelectorAll('*').forEach((node) => {
    if (!INLINE_TAGS.has(node.tagName.toLowerCase())) {
      node.replaceWith(...node.childNodes);
    }
  });
  return el.innerHTML.trim();
}

const DEFAULT_COLUMNS = [
  { title: 'Rendition', value: 'label' },
  { title: 'Format', value: 'format' },
  { title: 'Size', value: 'file-size' },
  { title: '', value: 'download' },
];

export default async function decorate(block) {
  let renditionIds = [];
  let description = '';
  let instructions = '';
  let display = 'table';
  const columns = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const key = cells[0]?.textContent.trim() || '';
    const val = cells[1]?.textContent.trim() || '';
    const lower = key.toLowerCase();
    if (lower === 'renditions') {
      renditionIds = parseList(cells[1]);
    } else if (lower === 'display') {
      display = val.toLowerCase() || 'table';
    } else if (lower === 'description') {
      description = val;
    } else if (lower === 'instructions') {
      instructions = cells[1] ? sanitizeInline(cells[1]) : '';
    } else if (cells.length === 1 && key) {
      // Single-cell row: da.live may collapse an empty first cell, so treat
      // the lone cell as the value with no title (e.g. | | download, share |).
      columns.push({ title: '', value: key });
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

  const headerHtml = (instructions || description) ? `
    <div class="details-renditions__header">
      ${instructions ? `<p class="details-renditions__instructions">${instructions}</p>` : ''}
      ${description ? `<p class="details-renditions__description">${esc(description)}</p>` : ''}
    </div>` : '';

  if (display === 'cards') {
    block.classList.add('details-renditions--cards');
    block.style.setProperty('--renditions-card-ar', asset.renditionsBoundingAspectRatio);
    const cards = renditions.map((rendition) => renditionCard(asset, rendition)).join('');
    block.innerHTML = `${headerHtml}<div class="details-renditions__cards">${cards}</div>`;

    block.querySelectorAll('.details-renditions__card-preview').forEach((preview) => {
      const img = preview.querySelector('img');
      if (img) snapAspectRatio(img, preview);
    });

    wireRenditionInteractions(block, asset, renditions);
    wireCopyUrl(block);
    return;
  }

  // ── Table display (default) ───────────────────────────────────────────────

  // Pre-classify each column.
  const colActions = cols.map((col) => parseActions(col.value));
  const colPreviews = cols.map((col) => col.value.trim().toLowerCase() === PREVIEW_KEYWORD);

  const rows = renditions.map((rendition) => {
    const ctx = renditionContext(asset, rendition);
    const cells = cols.map((col, i) => {
      if (colActions[i]) return actionCell(asset, rendition, colActions[i]);
      if (colPreviews[i]) return previewCell(asset, rendition);
      return valueCell(col, ctx, asset);
    });
    return `<tr data-asc-rendition="${esc(rendition.id)}">${cells.join('')}</tr>`;
  }).join('');

  block.innerHTML = `
    ${headerHtml}
    <div class="asc-ui-table-wrap">
      <table class="asc-ui-table">
        <thead>
          <tr>${cols.map((col, i) => {
    let cls = '';
    if (colActions[i]) cls = ' class="details-renditions__action"';
    else if (colPreviews[i]) cls = ' class="details-renditions__preview"';
    return `<th${cls}>${esc(col.title)}</th>`;
  }).join('')}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  wireRenditionInteractions(block, asset, renditions);
  wireCopyUrl(block);
}

function valueCell(col, ctx, asset) {
  return `<td>${esc(resolveValue(col.value, ctx, asset))}</td>`;
}

function actionCell(asset, rendition, actions) {
  const buttons = actions.map((a) => renderAction(asset, rendition, a)).filter(Boolean).join('');
  return `<td class="details-renditions__action"><div class="details-renditions__actions">${buttons}</div></td>`;
}

function renditionPreviewSrc(asset, rendition) {
  if (rendition?.mimeType?.startsWith('image/') && rendition.url) return rendition.url;
  return services.renditions.getThumbnailUrl(asset) || '';
}

function previewCell(asset, rendition) {
  const src = renditionPreviewSrc(asset, rendition);
  if (!src) return '<td class="details-renditions__preview"></td>';
  return `<td class="details-renditions__preview"><img class="details-renditions__thumb" src="${esc(src)}" alt="" width="48" height="48" loading="lazy"></td>`;
}

function renditionCard(asset, rendition) {
  const ctx = renditionContext(asset, rendition);
  const thumbSrc = renditionPreviewSrc(asset, rendition);
  const thumbHtml = thumbSrc
    ? `<img class="details-renditions__card-thumb" src="${esc(thumbSrc)}" alt="" loading="lazy">`
    : '';
  const metaItems = [ctx['file-type'], ctx['file-size'], ctx.dimensions].filter(Boolean);
  const meta = metaItems.map((item, i) => `<span>${esc(item)}${i < metaItems.length - 1 ? ' ·&nbsp;' : ''}</span>`).join('');
  const ref = `data-asc-asset="${asset.uuid}" data-asc-rendition="${rendition.id}"`;
  return `
    <article class="asc-ui-card" data-asc-rendition="${esc(rendition.id)}">
      ${thumbHtml ? `<div class="details-renditions__card-preview">${thumbHtml}</div>` : ''}
      <div class="asc-ui-card__body">
        <p class="asc-ui-card__title">${esc(rendition.label)}</p>
        ${meta ? `<p class="asc-ui-copy details-renditions__card-meta">${meta}</p>` : ''}
      </div>
      <div class="asc-ui-card__footer">
        <a class="btn btn--ghost btn--icon btn--sm" ${downloadAttrs(asset, rendition)}
           title="Download" aria-label="Download"
           data-asc-action="rendition:download@click" ${ref}>${ICONS.download}</a>
        <button class="btn btn--ghost btn--icon btn--sm" type="button" title="Copy URL" aria-label="Copy URL"
           data-asc-action="rendition:copy-url@click" data-url="${esc(rendition.url)}" ${ref}>${ICONS.copyUrl}</button>
      </div>
    </article>`;
}

function renderAction(asset, rendition, action) {
  const ref = `data-asc-asset="${asset.uuid}" data-asc-rendition="${rendition.id}"`;
  switch (action) {
    case 'download':
      return `<a class="btn btn--ghost btn--icon btn--sm" ${downloadAttrs(asset, rendition)}
           title="Download" aria-label="Download"
           data-asc-action="rendition:download@click" ${ref}>${ICONS.download}</a>`;
    case 'share':
      return `<button class="btn btn--ghost btn--icon btn--sm" type="button" title="Share" aria-label="Share"
           data-asc-action="rendition:share@click" ${ref}>${ICONS.share}</button>`;
    case 'copy-url':
      return `<button class="btn btn--ghost btn--icon btn--sm" type="button" title="Copy URL" aria-label="Copy URL"
           data-asc-action="rendition:copy-url@click" data-url="${esc(rendition.url)}" ${ref}>${ICONS.copyUrl}</button>`;
    default:
      return '';
  }
}

function wireRenditionInteractions(block, asset, renditions) {
  const byId = new Map(renditions.map((r) => [r.id, r]));

  const dispatch = (eventName, rendition) => {
    document.body.dispatchEvent(new CustomEvent(eventName, {
      bubbles: false,
      detail: rendition ? { rendition, asset } : { rendition: null, asset },
    }));
  };

  // Hover → preview (temporary)
  delegateEvent(block, '[data-asc-rendition]', 'mouseover', (e) => {
    const id = e.target.closest('[data-asc-rendition]')?.dataset?.ascRendition;
    const rendition = id && byId.get(id);
    if (rendition) dispatch('asc:rendition:preview', rendition);
  });

  block.addEventListener('mouseleave', () => dispatch('asc:rendition:preview', null), { passive: true });

  // Initial active state — original rendition, or first in list
  const initial = renditions.find((r) => r.id === 'original') || renditions[0];
  if (initial) {
    block.querySelector(`[data-asc-rendition="${initial.id}"]`)?.classList.add('is-active');
    dispatch('asc:rendition:activate', initial);
  }

  // Click → activate (sticky)
  delegateEvent(block, '[data-asc-rendition]', 'click', (e) => {
    // Don't activate when clicking an action button inside the item
    if (e.target.closest('a[href], button')) return;
    const id = e.target.closest('[data-asc-rendition]')?.dataset?.ascRendition;
    const rendition = id && byId.get(id);
    if (!rendition) return;

    block.querySelectorAll('[data-asc-rendition]').forEach((el) => el.classList.remove('is-active'));
    e.target.closest('[data-asc-rendition]').classList.add('is-active');
    dispatch('asc:rendition:activate', rendition);
  });

  // Intercept every download click so we control the filename.
  // Native <a href download> is unreliable: cross-origin ignores the download attr,
  // and same-origin AEM responses can override it with Content-Disposition.
  // Blob download always wins. For CDN/DM URLs omit credentials so the request
  // stays a simple CORS request compatible with Access-Control-Allow-Origin: *.
  delegateEvent(block, 'a[data-asc-action~="rendition:download@click"]', 'click', async (e) => {
    const renditionId = e.target.closest('[data-asc-rendition]')?.dataset?.ascRendition;
    const rendition = renditionId && byId.get(renditionId);
    if (!rendition) return;

    e.preventDefault();

    if (rendition.downloadUrl) {
      window.location.href = rendition.downloadUrl;
      return;
    }

    const filename = buildFilename(asset, rendition);
    try {
      const isAemUrl = rendition.url.startsWith(services.aem.getHost());
      const headers = isAemUrl ? await services.aem.getHeaders() : {};
      const res = await fetch(rendition.url, {
        credentials: 'omit',
        headers,
      });
      if (!res.ok) throw new Error(res.status);
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: blobUrl, download: filename });
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ASC] rendition blob download failed, falling back to open:', err);
      window.open(rendition.url, '_blank');
    }
  }, { stopPropagation: false });
}

function wireCopyUrl(block) {
  delegateEvent(block, '[data-asc-action*="rendition:copy-url"]', 'click', (e) => {
    const btn = e.target.closest('[data-asc-action*="rendition:copy-url"]');
    const url = btn?.dataset?.url;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      btn.innerHTML = ICONS.check;
      setTimeout(() => { btn.innerHTML = ICONS.copyUrl; }, 2000);
    });
  });
}

/**
 * Which renditions to show, in order.
 * - Explicit names → that order.
 * - Empty list → visible definition-resolved renditions (default sort).
 * - "all" keyword → every physical JCR static rendition, minus excluded/invisible ones,
 *   original first. Bypasses definition deduplication so all nodes are listed.
 */
function resolveRenditions(asset, ids) {
  const sortFn = (a, b) => {
    const an = String(a.label || a.name || a.id || '').toLowerCase();
    const bn = String(b.label || b.name || b.id || '').toLowerCase();
    if (an === 'original') return -1;
    if (bn === 'original') return 1;
    return an.localeCompare(bn);
  };

  if (ids.length === 1 && ids[0].toLowerCase() === 'all') {
    // Suppress nodes whose URL matches a definition-invisible rendition (e.g. thumbnail).
    const invisibleUrls = new Set(
      asset.renditions.filter((r) => r.visible === false).map((r) => r.url),
    );
    return services.renditions.resolveAllNodes(asset)
      .filter((r) => !invisibleUrls.has(r.url))
      .sort(sortFn);
  }

  if (ids.length) {
    return ids
      .map((id) => services.renditions.getRendition(asset, id)
        || asset.renditions.find((r) => r.id === id || r.name === id))
      .filter(Boolean);
  }

  return asset.renditions
    .filter((r) => r.visible !== false)
    .sort(sortFn);
}

// ─── Template resolution ──────────────────────────────────────────────────────

/** Build the per-rendition resolution context: rendition fields + display aliases. */
function renditionContext(asset, rendition) {
  const base = typeof rendition.toObject === 'function' ? rendition.toObject() : { ...rendition };
  const fmtLabel = mimeToLabel(base.mimeType);
  return {
    ...base,
    format: fmtLabel,
    'file-type': base.fileType || fmtLabel,
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
    return rest.length ? walk(asset.getProperty(rest[0]).data, rest.slice(1)) : null;
  }
  if (head === 'renditions') {
    if (!rest.length) return null;
    const rend = services.renditions.getRendition(asset, rest[0])
      || asset.renditions.find((r) => r.id === rest[0] || r.name === rest[0]);
    return walk(rend, rest.slice(1));
  }
  return walk(asset.getProperty(head).data, rest);
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

function downloadAttrs(asset, rendition) {
  if (rendition.downloadUrl) {
    return `href="${esc(rendition.downloadUrl)}"`;
  }
  return `href="${esc(rendition.url)}" download="${esc(buildFilename(asset, rendition))}"`;
}

function buildFilename(asset, rendition) {
  if (rendition.filename) return rendition.filename;
  const base = asset.filename ? asset.filename.replace(/\.[^.]+$/, '') : asset.title;
  const ext = mimeToExt(rendition.mimeType) || asset.fileExtension || '';
  // Strip any file extension from the rendition id — JCR node names include
  // extensions (e.g. "fpo.png") but the ext is already derived from mimeType.
  const idBase = (rendition.id || '').replace(/\.[a-zA-Z0-9]+$/, '');
  const suffix = idBase && idBase !== 'original' ? `-${idBase}` : '';
  return ext ? `${base}${suffix}.${ext}` : `${base}${suffix}`;
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
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.ceil(bytes / (1024 * 1024))} MB`;
  return `${(Math.ceil((bytes / (1024 * 1024 * 1024)) * 10) / 10).toFixed(1)} GB`;
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
  copyUrl: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
};
