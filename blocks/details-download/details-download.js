/** @owner user */
import { readBlockConfig } from '../../scripts/aem.js';
import Asset from '../../scripts/asc/models/asset.js';
import services from '../../scripts/asc/services/services.js';

const DEFAULTS = {
  description: '',
  renditions: [], // empty = all visible renditions in definition order
};

export default async function decorate(block) {
  const raw = readBlockConfig(block);
  const config = {
    description: raw.description || DEFAULTS.description,
    // Accept comma- or newline-separated rendition IDs, or an array from readBlockConfig
    renditions: parseList(raw.renditions),
  };

  const asset = await Asset.create(block);
  if (!asset) {
    block.innerHTML = '';
    return;
  }

  const renditions = resolveRenditions(asset, config.renditions);

  if (!renditions.length) {
    block.innerHTML = `<p class="details-download__empty">No downloads available.</p>`;
    return;
  }

  const header = config.description ? `
    <div class="details-download__header">
      <p class="details-download__description">${config.description}</p>
    </div>` : '';

  block.innerHTML = `
    ${header}
    <ul class="details-download__grid">
      ${renditions.map((rendition) => renditionCard(asset, rendition)).join('')}
    </ul>`;
}

/**
 * Resolve which renditions to show, in order.
 * - If config.renditions is non-empty: resolve each ID against the asset, in that order.
 * - Otherwise: all renditions where visible !== false.
 */
function resolveRenditions(asset, ids) {
  if (ids.length) {
    return ids
      .map((id) => services.renditions.getRendition(asset, id))
      .filter(Boolean);
  }
  return asset.renditions.filter((r) => r.visible !== false);
}

function renditionCard(asset, rendition) {
  const isImage = rendition.mimeType?.startsWith('image/');
  const isVideo = rendition.mimeType?.startsWith('video/');

  // Preview: use rendition URL for images/video (browser can render them),
  // fall back to the asset thumbnail for everything else (PDF, ZIP, etc.)
  const previewUrl = (isImage || isVideo) ? rendition.url : services.renditions.getThumbnailUrl(asset);
  const filename = buildFilename(asset, rendition);
  const fileTypeLabel = mimeToLabel(rendition.mimeType);

  const metaParts = [
    fileTypeLabel,
    rendition.fileSize ? formatBytes(rendition.fileSize) : null,
    (rendition.width && rendition.height) ? `${rendition.width} × ${rendition.height}` : null,
  ].filter(Boolean);

  return `
    <li class="details-download__card">
      <div class="details-download__preview">
        <img src="${previewUrl}" alt="${rendition.label}" loading="lazy" />
      </div>
      <div class="details-download__info">
        <div class="details-download__rendition-label">${rendition.label}</div>
        ${metaParts.length ? `<div class="details-download__meta">${metaParts.join(' · ')}</div>` : ''}
      </div>
      <a class="btn btn--primary btn--sm details-download__btn"
         href="${rendition.url}"
         download="${filename}"
         data-asc-action="rendition:download@click"
         data-asc-asset="${asset.uuid}"
         data-asc-rendition="${rendition.id}">
        Download
      </a>
    </li>`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean);
  return String(value).split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);
}

function buildFilename(asset, rendition) {
  const base = asset.filename
    ? asset.filename.replace(/\.[^.]+$/, '') // strip original extension
    : asset.title;
  const ext = mimeToExt(rendition.mimeType) || asset.fileExtension || '';
  return ext ? `${base}.${ext}` : base;
}

function mimeToExt(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/tiff': 'tif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
  };
  return map[mimeType] || mimeType?.split('/')[1] || '';
}

function mimeToLabel(mimeType) {
  const map = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WebP',
    'image/tiff': 'TIFF',
    'image/svg+xml': 'SVG',
    'video/mp4': 'MP4',
    'video/quicktime': 'MOV',
    'video/x-msvideo': 'AVI',
    'application/pdf': 'PDF',
    'application/zip': 'ZIP',
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
