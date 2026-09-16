/** @owner user */
// Shared by image.js / video.js: small format/size/dimensions pills shown next
// to the existing rendition-label chip over the main preview, so people can
// tell what they're looking at without leaving the viewer.

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

// Resolvers for the authorable `info` field (see details-preview.js) — keys match
// the same field names used elsewhere for rendition data (details-renditions.js).
const FIELD_RESOLVERS = {
  'file-type': (r) => r.fileType || mimeToLabel(r.mimeType),
  format: (r) => mimeToLabel(r.mimeType),
  'file-size': (r) => (r.fileSize ? formatBytes(r.fileSize) : ''),
  dimensions: (r) => ((r.width && r.height) ? `${r.width} × ${r.height}` : ''),
  width: (r) => (r.width ? `${r.width}px` : ''),
  height: (r) => (r.height ? `${r.height}px` : ''),
  usecase: (r) => r.usecase || '',
};

export const DEFAULT_RENDITION_FIELDS = ['file-type', 'file-size', 'dimensions'];

// Parses the authorable `info` config row (details-preview.js) — a comma list
// of the field keys above; omitted/blank falls back to the default three.
export function parseFields(raw) {
  if (!raw) return DEFAULT_RENDITION_FIELDS;
  const fields = String(raw).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return fields.length ? fields : DEFAULT_RENDITION_FIELDS;
}

export function renditionTagsHtml(rendition, fields = DEFAULT_RENDITION_FIELDS) {
  if (!rendition) return '';
  return fields
    .map((field) => FIELD_RESOLVERS[field]?.(rendition) || '')
    .filter(Boolean)
    .map((item) => `<span class="asc-ui-chip asc-ui-chip--muted">${esc(item)}</span>`)
    .join('');
}
