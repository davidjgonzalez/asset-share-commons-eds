/** @owner user */
import services from '../../scripts/asc/services/services.js';
import { escHtml } from '../../scripts/html.js';

/**
 * Sheet block — a download/rendition selection page.
 *
 * URL params:
 *   sheet      — compressed payload: { title, description?, expiresAt?, items[] }
 *   renditions — compressed array of rendition definition IDs (still supported)
 */
export default async function decorate(block) {
  const params = new URLSearchParams(window.location.search);
  const {
    mixedItems, assetMap, renditionDefinitions, title, description, expiresAt,
  } = await getDataFromSearchParams(params);

  if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
    block.innerHTML = expiredHtml(expiresAt);
    return;
  }

  const assetCount = mixedItems.filter((i) => i.type === 'asset').length;
  block.innerHTML = html(mixedItems, assetMap, renditionDefinitions, title, description, assetCount);

  initRenditionSwitcher(block);
  initDragAndDrop(block);
}

// ─── HTML ────────────────────────────────────────────────────────────────────

function expiredHtml(expiresAt) {
  const date = new Date(expiresAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return `
    <div class="sheet__expired">
      <p class="sheet__expired-title">This link has expired</p>
      <p class="sheet__expired-message">The link you followed expired on ${date}.</p>
    </div>`;
}

function html(mixedItems, assetMap, renditionDefinitions, title, description, assetCount) {
  const rows = mixedItems.map((item) => {
    if (item.type === 'section') return sectionHeading(item);
    const asset = assetMap.get(item.id);
    return asset ? assetRow(asset, renditionDefinitions, item.notes) : '';
  }).join('');

  return `
    <a href="/" class="sheet__back">&#8592; Back to search</a>
    <h1 class="sheet__title">${escHtml(title) || 'Download Sheet'}</h1>
    ${description ? `<p class="sheet__description">${escHtml(description)}</p>` : ''}
    <p class="sheet__count">${assetCount} asset${assetCount === 1 ? '' : 's'}</p>
    <div class="sheet__asset-list">
      ${rows || '<p class="sheet__empty">No assets selected.</p>'}
    </div>
  `;
}

function sectionHeading(item) {
  return `
    <div class="sheet__section">
      <h2 class="sheet__section-title">${escHtml(item.title)}</h2>
      ${item.body ? `<div class="sheet__section-body">${renderMarkdown(item.body)}</div>` : ''}
    </div>`;
}

function assetRow(asset, renditionDefinitions, notes) {
  const thumbnailUrl = services.renditions.getThumbnailUrl(asset);
  const fileType = asset.getProperty('file-type') || '';
  const fileSize = asset.getProperty('file-size') || '';
  const defaultRenditionId = renditionDefinitions[0]?.id || '';

  const pills = renditionDefinitions.map((def) => `
    <button class="btn btn--ghost btn--sm sheet__rendition-pill${def.id === defaultRenditionId ? ' sheet__rendition-pill--active' : ''}"
            data-rendition-id="${def.id}"
            aria-pressed="${def.id === defaultRenditionId}"
            type="button">
      ${escHtml(def.label || def.id)}
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
             alt="${escHtml(asset.title)}"
             loading="lazy"
             onerror="this.parentElement.classList.add('sheet__asset-thumb--error')" />
        <span class="sheet__asset-thumb-fallback" aria-hidden="true">${getFileIcon(fileType)}</span>
      </div>
      <div class="sheet__asset-info">
        <p class="asc-ui-asset-row__title">${escHtml(asset.title)}</p>
        ${meta ? `<p class="asc-ui-asset-row__meta">${escHtml(meta)}</p>` : ''}
        ${notes ? `<p class="sheet__asset-note">${escHtml(notes)}</p>` : ''}
      </div>
      <div class="sheet__asset-renditions" role="group" aria-label="Select rendition for ${escHtml(asset.title)}">
        ${pills || '<span class="sheet__no-renditions">&#8212;</span>'}
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

// ─── Markdown renderer (inline, no library) ───────────────────────────────────

function renderMarkdown(md) {
  if (!md) return '';

  let html2 = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Links: [text](url) — only allow safe schemes
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      const safe = /^https?:\/\//i.test(url) || url.startsWith('/') || url.startsWith('#');
      return safe ? `<a href="${url}" rel="noopener noreferrer">${text}</a>` : escHtml(text);
    })
    // Bold: **text**
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    // Italic: *text*
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // List items — collect runs of "- item" lines into <ul>
  html2 = html2.replace(/((?:^- .+$\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map((line) => `<li>${line.slice(2)}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Paragraphs — split on blank lines, wrap non-block content in <p>
  html2 = html2.split(/\n\n+/).map((chunk) => {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed.startsWith('<ul>') || trimmed.startsWith('<li>')) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html2;
}

// ─── Rendition switcher ───────────────────────────────────────────────────────

function initRenditionSwitcher(block) {
  block.querySelectorAll('[data-asc-asset][data-selected-rendition]').forEach(updateDownloadHref);

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
    event.dataTransfer.setData('DownloadURL', `${mimeType}:${filename}:${rendition.url}`);
    event.dataTransfer.setData('text/uri-list', rendition.url);
    event.dataTransfer.setData('text/plain', rendition.url);
  });
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function getDataFromSearchParams(queryParameters) {
  const renditionsCompressed = queryParameters.get('renditions');
  const renditionIds = renditionsCompressed
    ? await services.url.decompressToArray(renditionsCompressed)
    : [];
  const renditionDefinitions = renditionIds
    .map((id) => services.renditions.getRenditionDefinition(id))
    .filter(Boolean);

  const sheetParam = queryParameters.get('sheet');
  if (!sheetParam) {
    return {
      mixedItems: [], assetMap: new Map(), renditionDefinitions,
      title: '', description: '', expiresAt: null,
    };
  }

  const parts = await services.url.decompressToArray(sheetParam);
  const json = parts.join(',');
  const {
    title = '', description = '', expiresAt = null, items = [],
  } = JSON.parse(json);

  const mixedItems = items.map((entry) => {
    if (entry.startsWith('~')) {
      const sepIdx = entry.indexOf('|||', 1);
      return {
        type: 'section',
        title: sepIdx === -1 ? entry.slice(1) : entry.slice(1, sepIdx),
        body: sepIdx === -1 ? '' : entry.slice(sepIdx + 3),
      };
    }
    const sepIdx = entry.indexOf('|||');
    if (sepIdx !== -1) {
      return { type: 'asset', id: entry.slice(0, sepIdx), notes: entry.slice(sepIdx + 3) };
    }
    return { type: 'asset', id: entry };
  });

  const assetIds = mixedItems.filter((i) => i.type === 'asset').map((i) => i.id);
  const fetchedAssets = await Promise.all(assetIds.map((id) => services.search.getAssetById(id)));
  const assetMap = new Map(fetchedAssets.filter(Boolean).map((a) => [a.uuid, a]));

  return {
    mixedItems, assetMap, renditionDefinitions, title, description, expiresAt,
  };
}
