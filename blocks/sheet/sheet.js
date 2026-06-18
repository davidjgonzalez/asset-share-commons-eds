/** @owner user */
import services from '../../scripts/asc/services/services.js';

/**
 * Sheet block — a download/rendition selection page.
 *
 * Reads compressed asset IDs and rendition IDs from URL query parameters
 * (set by the collection-bar / stub block) and renders a per-asset download sheet.
 *
 * URL params:
 *   assets     — compressed array of asset UUIDs
 *   renditions — compressed array of rendition definition IDs
 *
 * Each asset row shows a thumbnail, metadata, per-asset rendition switcher pills,
 * and a download button. The active rendition pill determines the download URL and
 * the asset dragged when the row is dragged to Finder / Photoshop / etc.
 */
export default async function decorate(block) {
  const params = new URLSearchParams(window.location.search);
  const { assets, renditionDefinitions } = await getDataFromSearchParams(params);
  const title = params.get('title') ? decodeURIComponent(params.get('title')) : '';
  const description = params.get('description') ? decodeURIComponent(params.get('description')) : '';

  block.innerHTML = html(assets, renditionDefinitions, title, description);

  initRenditionSwitcher(block);
  initDragAndDrop(block);
}

// ─── HTML ────────────────────────────────────────────────────────────────────

function html(assets, renditionDefinitions, title, description) {
  const rows = assets
    .filter(Boolean)
    .map((asset) => assetRow(asset, renditionDefinitions))
    .join('');

  return `
    <a href="/" class="sheet__back">&#8592; Back to search</a>
    <h1 class="sheet__title">${title || 'Download Sheet'}</h1>
    ${description ? `<p class="sheet__description">${description}</p>` : ''}
    <p class="sheet__count">${assets.length} asset${assets.length === 1 ? '' : 's'}</p>
    <div class="sheet__asset-list">
      ${rows || '<p class="sheet__empty">No assets selected.</p>'}
    </div>
  `;
}

function assetRow(asset, renditionDefinitions) {
  const thumbnailUrl = services.renditions.getThumbnailUrl(asset);
  const fileType = asset.getProperty('file-type') || '';
  const fileSize = asset.getProperty('file-size') || '';
  const defaultRenditionId = renditionDefinitions[0]?.id || '';

  const pills = renditionDefinitions.map((def) => `
    <button class="btn btn--ghost btn--sm sheet__rendition-pill${def.id === defaultRenditionId ? ' sheet__rendition-pill--active' : ''}"
            data-rendition-id="${def.id}"
            aria-pressed="${def.id === defaultRenditionId}"
            type="button">
      ${def.label || def.id}
    </button>
  `).join('');

  const meta = [fileType, fileSize].filter(Boolean).join(' · ');

  return `
    <div class="sheet__asset-row"
         data-asc-asset="${asset.uuid}"
         data-asc-mime-type="${asset.mimeType || ''}"
         data-selected-rendition="${defaultRenditionId}"
         draggable="true">
      <div class="asc-ui-thumb sheet__asset-thumb">
        <img src="${thumbnailUrl}"
             alt="${asset.title}"
             loading="lazy"
             onerror="this.parentElement.classList.add('sheet__asset-thumb--error')" />
        <span class="sheet__asset-thumb-fallback" aria-hidden="true">${getFileIcon(fileType)}</span>
      </div>
      <div class="sheet__asset-info">
        <p class="asc-ui-asset-row__title">${asset.title}</p>
        ${meta ? `<p class="asc-ui-asset-row__meta">${meta}</p>` : ''}
      </div>
      <div class="sheet__asset-renditions" role="group" aria-label="Select rendition for ${asset.title}">
        ${pills || '<span class="sheet__no-renditions">—</span>'}
      </div>
      <div class="sheet__asset-actions">
        <a class="btn btn--primary btn--sm sheet__download-btn"
           href="#"
           download
           data-asc-asset="${asset.uuid}">
          Download
        </a>
      </div>
    </div>
  `;
}

function getFileIcon(fileType) {
  const icons = {
    PDF: '📕',
    Video: '🎬',
    Audio: '🎵',
    'Word Doc': '📝',
    Word: '📝',
    Excel: '📊',
    Spreadsheet: '📊',
    ZIP: '📦',
    Archive: '📦',
  };
  return icons[fileType] || '📄';
}

// ─── Rendition switcher ───────────────────────────────────────────────────────

function initRenditionSwitcher(block) {
  // Set initial download hrefs
  block.querySelectorAll('[data-asc-asset][data-selected-rendition]').forEach(updateDownloadHref);

  // Delegate pill clicks
  block.addEventListener('click', (event) => {
    const pill = event.target.closest('.sheet__rendition-pill');
    if (!pill) return;

    const row = pill.closest('[data-asc-asset]');
    if (!row) return;

    const { renditionId } = pill.dataset;
    row.dataset.selectedRendition = renditionId;

    row.querySelectorAll('.sheet__rendition-pill').forEach((p) => {
      const active = p.dataset.renditionId === renditionId;
      p.classList.toggle('sheet__rendition-pill--active', active);
      p.setAttribute('aria-pressed', String(active));
    });

    updateDownloadHref(row);
  });
}

function updateDownloadHref(row) {
  const assetId = row.dataset.ascAsset;
  const renditionId = row.dataset.selectedRendition;
  if (!assetId || !renditionId) return;

  const asset = window.asc?.cache?.assets?.get(assetId);
  if (!asset) return;

  const rendition = services.renditions.getRendition(asset, renditionId);
  const btn = row.querySelector('.sheet__download-btn');
  if (btn && rendition?.url) {
    btn.href = rendition.url;
    const filename = asset.filename || asset.title || 'asset';
    btn.setAttribute('download', filename);
  }
}

// ─── Drag and drop ────────────────────────────────────────────────────────────

function initDragAndDrop(block) {
  block.addEventListener('dragstart', (event) => {
    const row = event.target.closest('[data-asc-asset]');
    if (!row) return;

    const assetId = row.dataset.ascAsset;
    const asset = window.asc?.cache?.assets?.get(assetId);
    if (!asset) return;

    const renditionId = row.dataset.selectedRendition;
    const rendition = renditionId
      ? services.renditions.getRendition(asset, renditionId)
      : services.renditions.getRendition(asset, 'original');

    if (!rendition?.url) return;

    const mimeType = row.dataset.ascMimeType || asset.mimeType || 'application/octet-stream';
    const filename = asset.filename || asset.title || 'asset';

    event.dataTransfer.effectAllowed = 'copy';
    // Chrome/Edge: enables drag-to-Finder / drag-to-desktop
    event.dataTransfer.setData('DownloadURL', `${mimeType}:${filename}:${rendition.url}`);
    // Fallback for Firefox/Safari and apps that accept URI drops
    event.dataTransfer.setData('text/uri-list', rendition.url);
    event.dataTransfer.setData('text/plain', rendition.url);
  });
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function getDataFromSearchParams(queryParameters) {
  const assetsCompressed = queryParameters.get('assets');
  const renditionsCompressed = queryParameters.get('renditions');

  const assetIds = assetsCompressed
    ? await services.url.decompressToArray(assetsCompressed)
    : [];
  const renditionIds = renditionsCompressed
    ? await services.url.decompressToArray(renditionsCompressed)
    : [];

  const assets = await Promise.all(
    assetIds.map((id) => services.search.getAssetById(id)),
  );
  const renditionDefinitions = renditionIds
    .map((id) => services.renditions.getRenditionDefinition(id))
    .filter(Boolean);

  return { assets, renditionDefinitions };
}
