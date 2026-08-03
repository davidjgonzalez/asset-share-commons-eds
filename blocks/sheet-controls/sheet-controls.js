/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import { escHtml } from '../../scripts/asc/html.js';
import { triggerAction } from '../../scripts/asc.js';
import { registerTokens } from '../../scripts/asc/tokens.js';

const configurations = (await import('../../scripts/asc/configurations.js')).default;

export default async function decorate(block) {
  const controls = parseControls(block);
  const sheetParam = getSheetParam();
  const sheet = await loadSheet(sheetParam);

  registerTokens({
    'sheet.title': sheet?.title || 'Download Sheet',
    'sheet.description': sheet?.description || '',
    'sheet.count': String(sheet?.assetCount ?? 0),
    'sheet.expiresAt': sheet?.expiresAt ? formatExpires(sheet.expiresAt) : '',
  });

  const expired = sheet?.expiresAt && Date.now() > new Date(sheet.expiresAt).getTime();
  if (!sheet || expired) {
    block.innerHTML = '';
    return;
  }

  block.innerHTML = html(controls, sheet.assetCount);
  initInteractions(block, sheet);
}

function getSheetParam() {
  const urlParam = new URLSearchParams(window.location.search).get('sheet');
  if (urlParam) return urlParam;

  const board = document.querySelector('.board');
  if (board?.dataset.ascSheetParam) return board.dataset.ascSheetParam;
  const sheetUrl = [...(board?.children || [])].find((row) => (
    row.children[0]?.textContent.trim().toLowerCase() === 'sheet-url'
  ))?.children[1]?.textContent.trim();
  if (!sheetUrl) return null;

  try {
    return new URL(sheetUrl, window.location.origin).searchParams.get('sheet');
  } catch {
    return null;
  }
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseControls(block) {
  return [...block.querySelectorAll(':scope > div')].map((row) => ({
    id: row.children[0]?.textContent.trim().toLowerCase(),
    label: row.children[1]?.textContent.trim() || '',
    variant: row.children[2]?.textContent.trim().toLowerCase() || '',
  })).filter((c) => c.id);
}

function parseAssetId(entry) {
  const sep = entry.indexOf('|||');
  const base = sep !== -1 ? entry.slice(0, sep) : entry;
  const at = base.indexOf('@');
  return at !== -1 ? base.slice(0, at) : base;
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadSheet(sheetParam) {
  if (!sheetParam) return null;
  try {
    const parts = await services.url.decompressToArray(sheetParam);
    if (!parts) return null;
    const {
      title = '', description = '', expiresAt = null, items = [],
    } = JSON.parse(parts.join(','));

    const assetIds = items.filter((entry) => !entry.startsWith('~')).map(parseAssetId);
    const assets = (await Promise.all(assetIds.map((id) => services.search.getAssetById(id))))
      .filter(Boolean);

    return {
      title, description, expiresAt, assetCount: assetIds.length, assets,
    };
  } catch (err) {
    console.warn('[ASC] Failed to decode sheet URL:', err);
    return null;
  }
}

// ─── Token resolution ─────────────────────────────────────────────────────────

function formatExpires(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

const RENDERERS = {
  download: ({ label, variant, assetCount }) => `<button type="button" class="sheet-controls__download-btn btn btn--${variant || 'primary'}" aria-label="Download all assets in this sheet"${assetCount === 0 ? ' disabled' : ''}>${escHtml(label || 'Download')}</button>`,
  'copy-link': ({ label, variant }) => `<button type="button" class="sheet-controls__copy-btn btn btn--${variant || 'secondary'}" aria-label="Copy link to this sheet">${escHtml(label || 'Copy Link')}</button>`,
};

function html(controls, assetCount) {
  const items = controls
    .map(({ id, label, variant }) => RENDERERS[id]?.({ label, variant, assetCount }) ?? '')
    .join('');
  return `
    <div class="sheet-controls__toolbar">
      <div class="sheet-controls__toolbar-end">${items}</div>
    </div>`;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

function initInteractions(block, sheet) {
  block.querySelector('.sheet-controls__download-btn')?.addEventListener('click', () => {
    triggerAction(configurations.downloads?.actionPath || '/actions/download', {
      assets: sheet.assets,
      title: sheet.title || 'sheet',
    });
  });

  block.querySelector('.sheet-controls__copy-btn')?.addEventListener('click', (e) => {
    flashCopy(e.currentTarget, window.location.href);
  });
}

function flashCopy(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
}
