/** @owner user */
import services from '../../scripts/asc/core/services/services.js';

const configurations = (await import('../../scripts/asc/configurations.js')).default;

export function parseConfig(block) {
  const config = {
    source: 'sheet',
    mode: 'view',
    notes: true,
    searchProperties: [],
    details: null,
    sheetUrl: null,
    items: [],
    height: null,
  };
  [...block.children].forEach((row) => {
    const [keyCell, valCell] = [...row.children];
    if (!keyCell || !valCell) return;
    const key = keyCell.textContent.trim().toLowerCase();
    const val = valCell.textContent.trim();
    if (key === 'source') config.source = val || 'sheet';
    else if (key === 'mode') config.mode = val || 'view';
    else if (key === 'notes') config.notes = val.toLowerCase() !== 'false';
    // Any valid CSS length (e.g. "90vh", "800px") — overrides the dynamic
    // fill-remaining-space calculation in sizeViewport() below. Unset by default:
    // most pages want the canvas to fill whatever room is left below the header,
    // which varies per page, rather than a fixed size that risks overlapping
    // taller header content.
    else if (key === 'height') config.height = val || null;
    else if (key === 'search-properties') {
      config.searchProperties = val ? val.split(',').map((p) => p.trim()).filter(Boolean) : [];
    } else if (key === 'details') config.details = val ? services.url.toRelativeUrl(val) : null;
    else if (key === 'sheet-url') config.sheetUrl = val ? services.url.toRelativeUrl(val) : null;
    else if (key === 'items') {
      // One asset UUID or DAM path per line — a fixed, site-owner-curated list (a "Press Kit",
      // a hand-picked set for a campaign) rather than a personal collection or a
      // compressed ?sheet= URL. See loadFromAuthoredList().
      config.items = services.authoredAssets.parseAssetReferences(valCell);
    }
  });
  return config;
}

// ─── Details path resolution ──────────────────────────────────────────────────

function matchesMime(pattern, mime) {
  if (pattern === '*/*') return true;
  if (pattern.endsWith('/*')) return mime.startsWith(pattern.slice(0, -2));
  return mime === pattern;
}

function resolveDetailsPath(detailsBase, mime) {
  const templates = configurations.assetDetails?.templates || {};
  for (const [pattern, tplPath] of Object.entries(templates)) {
    if (pattern === 'default') continue;
    if (matchesMime(pattern, mime)) {
      const parts = tplPath.replace(/^\//, '').split('/');
      const relative = parts.slice(1).join('/');
      return relative ? `${detailsBase}/${relative}` : detailsBase;
    }
  }
  const defaultPath = templates.default;
  if (defaultPath) {
    const parts = defaultPath.replace(/^\//, '').split('/');
    const relative = parts.slice(1).join('/');
    return relative ? `${detailsBase}/${relative}` : detailsBase;
  }
  return detailsBase;
}

export function openDetails(uuid, asset, config) {
  if (config.details) {
    const mime = asset?.getProperty('mime-type')?.data || '';
    const path = resolveDetailsPath(config.details, mime);
    window.location.href = `${path}?asset=${encodeURIComponent(uuid)}`;
  } else {
    document.body.dispatchEvent(new CustomEvent('asc:asset:details:open', {
      bubbles: true,
      detail: { data: { ascAsset: uuid } },
    }));
  }
}
