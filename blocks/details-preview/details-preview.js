/** @owner user */
import { readBlockConfig } from '../../scripts/aem.js';
import Asset from '../../scripts/asc/models/asset.js';
import { escHtml } from '../../scripts/html.js';

const OFFICE_EXTS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

function isOfficeMime(mime) {
  return mime.includes('officedocument') || mime.includes('ms-word')
    || mime.includes('ms-excel') || mime.includes('ms-powerpoint');
}

function detectType(rendition, fallbackMime) {
  const mime = rendition?.mimeType || fallbackMime || '';
  const ext = (rendition?.filename || '').split('.').pop().toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (isOfficeMime(mime) || OFFICE_EXTS.has(ext)) return 'office';
  return 'image';
}

function resolveInitial(asset, priorityList) {
  for (const name of priorityList) {
    const r = asset.getRendition(name);
    if (r) return r;
  }
  return asset.renditions[0] ?? null;
}

export default async function decorate(block) {
  const config = readBlockConfig(block);
  const priority = (config.renditions || 'original')
    .split(',').map((s) => s.trim()).filter(Boolean);

  block.innerHTML = '<div class="details-preview__viewer"></div>';
  const viewer = block.querySelector('.details-preview__viewer');

  try {
    const asset = await Asset.create(block);
    document.title = `${asset.title} - Asset Details`;

    const initialRendition = resolveInitial(asset, priority);
    let activeRendition = initialRendition;
    let currentType = detectType(initialRendition, asset.mimeType);

    viewer.dataset.type = currentType;
    const mod = await import(`./${currentType}.js`);
    let handler = mod.mount(viewer, asset, initialRendition, config);

    document.body.addEventListener('asc:rendition:activate', async (e) => {
      const r = e.detail?.rendition;
      if (!r) return;
      const newType = detectType(r, asset.mimeType);
      if (newType !== currentType) {
        handler.dispose();
        viewer.dataset.type = newType;
        const newMod = await import(`./${newType}.js`);
        handler = newMod.mount(viewer, asset, r, config);
        currentType = newType;
      } else {
        handler.setDisplay(r, true);
      }
      activeRendition = r;
    });

    document.body.addEventListener('asc:rendition:preview', (e) => {
      const r = e.detail?.rendition;
      const target = r ?? activeRendition;
      if (!target) return;
      const targetType = detectType(target, asset.mimeType);
      // Cross-type hover: no-op — don't swap types on hover
      if (targetType !== currentType) return;
      handler.setDisplay(target, false);
    });
  } catch (error) {
    console.error('details-preview: Failed to load asset', error);
    block.innerHTML = `
      <div class="asc-ui-empty-state">
        <span class="asc-ui-empty-state__icon" aria-hidden="true">⚠️</span>
        <p class="asc-ui-empty-state__title">Asset not found</p>
        <p class="asc-ui-empty-state__hint">${escHtml(error.message)}</p>
      </div>`;
  }
}
