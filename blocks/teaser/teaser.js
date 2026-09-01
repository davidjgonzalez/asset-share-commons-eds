/** @owner user */
/**
 * teaser — a single curated teaser: a link to an authored board, a generated
 * sheet, or the configured search page with query parameters. This block is
 * only a teaser; the target page remains the source of truth.
 *
 * Place several side by side in a section to build a directory of teasers —
 * the section's own layout (e.g. `style: grid` section metadata) arranges
 * them; this block only renders one.
 *
 * Authoring is free-form rich text, not fixed key | value fields:
 *   | Teaser (Horizontal Card) |
 *   | (an image, pasted in, or a link/path to one)             |  ← optional, must be the FIRST row
 *   | ## Spring 2026 Campaign                                  |
 *   | Curated hero shots for the spring launch                 |
 *   | [View the collection](/search?tagid=campaigns:spring-2026) |  ← the CTA — a row that's just one link
 *
 * The visual layout comes from the block name itself, not a config row —
 * this is the standard DA "block (variant)" convention. Add a parenthesized
 * variant after the block name when inserting/authoring:
 *   Teaser              — plain vertical tile (default)
 *   Teaser (Hero)        — the one "headline" tile: biggest thumb + title
 *   Teaser (Horizontal Card) — wide teaser, thumb-left/body-right
 *   Teaser (Text Only)   — no thumbnail at all, just the rich text (skips
 *                          image resolution entirely)
 *
 * Row 1 — image (optional): if the first row is a pasted image, or a link/
 * bare path that looks like one (a file extension, or a DAM path like
 * `/content/dam/foo/bar.png`), it's used as the cover image — a DAM path is
 * resolved through the search index to a real asset and rendered via its
 * web-optimized-delivery thumbnail (configurations.renditions.thumbnails)
 * rather than used as a raw <img src>. Anything else in row 1 is treated as
 * ordinary body text instead.
 *
 * The rest of the rows — everything except the leading image row and the CTA
 * row below — are rendered as-is: whatever headings/paragraphs/formatting
 * were authored.
 *
 * CTA / resolver: the last row that's just a single link (the standard EDS
 * "lone link in a paragraph becomes a button" convention — see
 * `decorateButtons` in scripts/aem.js) is the thing being teased. Its href is
 * resolved to figure out what it links to:
 *   - A `?sheet=` link — the compressed payload identifies the asset list, so
 *     up to 15 thumbnails can be resolved without fetching the target page.
 *   - A link to the search page with query params — a real (silent,
 *     p.limit=15) search is run and the results' thumbnails are used.
 *   - Any other same-site link — the asset list isn't in the URL, but it may
 *     still be recoverable by fetching the target page's own `.plain.html`
 *     and reading its blocks directly: a `board` block with `source:
 *     authored` (its authored id list), or a `board` with `mode: sheet-url`
 *     (its authored share URL — decoded the same way as a `?sheet=` link above).
 *     Other pages fall back to a plain file-type placeholder.
 * That resolution also autopopulates the cover image (from the resolved
 * asset thumbnails) when row 1 didn't already supply one, and drives the
 * eyebrow ("Live Search" / "Curated Set") — a search link stays current on
 * its own, while a sheet or authored link is a fixed, hand-picked set. None
 * of this runs for format: Text Only, since that never shows a thumbnail.
 */
import { escHtml, escAttr } from '../../scripts/asc/html.js';
import { MAX_MOSAIC_THUMBS, mosaicRowCounts } from '../../scripts/asc/core/utils/mosaic.js';
import services from '../../scripts/asc/core/services/services.js';

// Each mosaic row adds this much card height — a teaser's whole point is to
// visibly signal "how much is behind this link".
const ROW_HEIGHT = 150;

const configurations = (await import('../../scripts/asc/configurations.js')).default;
const SEARCH_PAGE = (configurations.search?.page || '/search').replace(/\/$/, '');

// Shared across every teaser on the page, so a directory of several cards
// doesn't fire a burst of simultaneous preview fetches on page load.
const previewQueue = [];
let activePreviews = 0;
const PREVIEW_CONCURRENCY = Math.max(
  1,
  Number(configurations.teaser?.previewConcurrency) || 2,
);

function schedulePreview(task) {
  return new Promise((resolve) => {
    previewQueue.push({ task, resolve });
    const runNext = () => {
      while (activePreviews < PREVIEW_CONCURRENCY && previewQueue.length) {
        const entry = previewQueue.shift();
        activePreviews += 1;
        entry.task().then(entry.resolve, () => entry.resolve(NO_THUMBNAILS)).finally(() => {
          activePreviews -= 1;
          runNext();
        });
      }
    };
    runNext();
  });
}

function assetIdsFromSheetItems(items) {
  return (items || [])
    .filter((e) => typeof e === 'string' && !e.startsWith('~'))
    .map((entry) => {
      const withoutNotes = entry.split('|||')[0];
      const at = withoutNotes.indexOf('@');
      return at !== -1 ? withoutNotes.slice(0, at) : withoutNotes;
    });
}

async function thumbnailsFromSheet(sheetParam) {
  try {
    const parts = await services.url.decompressToArray(sheetParam);
    if (!parts) return null;
    const payload = JSON.parse(parts.join(','));
    const ids = assetIdsFromSheetItems(payload.items);
    const assets = await services.authoredAssets.resolveAssetReferences(
      ids.slice(0, MAX_MOSAIC_THUMBS),
    );
    const thumbnails = assets.map((a) => a?.thumbnail).filter(Boolean);
    return { thumbnails, total: ids.length, kind: 'sheet' };
  } catch {
    return null;
  }
}

async function thumbnailsFromSearch(searchParams) {
  try {
    const formData = new Map(searchParams);
    formData.set('p.limit', String(MAX_MOSAIC_THUMBS));
    const { assets, total } = await services.search.searchSilent(formData);
    const thumbnails = (assets || []).map((a) => a.thumbnail).filter(Boolean);
    return { thumbnails, total: total || thumbnails.length, kind: 'search' };
  } catch {
    return null;
  }
}

function readRowConfig(blockEl) {
  const config = {};
  [...blockEl.children].forEach((row) => {
    const cells = [...row.children];
    const key = cells[0]?.textContent.trim();
    if (key) config[key.toLowerCase()] = cells[1];
  });
  return config;
}

async function thumbnailsFromBoard(boardEl) {
  const config = readRowConfig(boardEl);

  // source: authored — a fixed, hand-typed list of raw asset ids on the page.
  if (config.source?.textContent.trim().toLowerCase() === 'authored' && config.items) {
    const ids = services.authoredAssets.parseAssetReferences(config.items);
    const assets = await services.authoredAssets.resolveAssetReferences(
      ids.slice(0, MAX_MOSAIC_THUMBS),
    );
    const thumbnails = assets.map((a) => a?.thumbnail).filter(Boolean);
    return { thumbnails, total: ids.length, kind: 'authored' };
  }

  // mode: sheet-url — the page authors a static, pre-encoded share URL rather
  // than reading ?sheet= from its own visited URL; same payload format either
  // way, so decode it the same way thumbnailsFromSheet does.
  if (config.mode?.textContent.trim().toLowerCase() === 'sheet-url' && config['sheet-url']) {
    const sheetUrl = config['sheet-url'].textContent.trim();
    let sheetParam;
    try {
      sheetParam = new URL(sheetUrl, window.location.origin).searchParams.get('sheet');
    } catch {
      return null;
    }
    return sheetParam ? thumbnailsFromSheet(sheetParam) : null;
  }

  return null;
}

// Nothing in the URL identifies the asset list for an authored-list page —
// fetch the page's own plain content (the same
// `.plain.html` convention the actionPages service uses) and read its blocks
// directly instead.
async function thumbnailsFromPage(link) {
  try {
    const path = new URL(link, window.location.origin).pathname.replace(/\/$/, '');
    const res = await fetch(`${path}.plain.html`);
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    const boardEl = doc.querySelector('.board');
    if (boardEl) {
      const result = await thumbnailsFromBoard(boardEl);
      if (result) return result;
    }

    return null;
  } catch {
    return null;
  }
}

const NO_THUMBNAILS = {
  thumbnails: [], total: 0, kind: 'none',
};

async function resolveThumbnailsUncached(link) {
  let url;
  try {
    url = new URL(link, window.location.origin);
  } catch {
    return NO_THUMBNAILS;
  }
  const sheetParam = url.searchParams.get('sheet');
  if (sheetParam) return (await thumbnailsFromSheet(sheetParam)) || NO_THUMBNAILS;
  if (url.pathname.replace(/\/$/, '') === SEARCH_PAGE && [...url.searchParams].length) {
    return (await thumbnailsFromSearch(url.searchParams)) || NO_THUMBNAILS;
  }
  return (await thumbnailsFromPage(link)) || NO_THUMBNAILS;
}

function resolveThumbnails(link) {
  return schedulePreview(() => resolveThumbnailsUncached(link));
}

// A DAM path has no delivery URL of its own — resolve it to a real asset
// through the search index, then reuse its normal web-optimized-delivery
// thumbnail (Asset#thumbnail → configurations.renditions.thumbnails), the
// same rendition ladder every other teaser in the app uses.
async function resolveDamImageUncached(path) {
  try {
    const asset = await services.authoredAssets.resolveAssetReference(path);
    return asset?.thumbnail || null;
  } catch {
    return null;
  }
}

function resolveDamImage(path) {
  return schedulePreview(() => resolveDamImageUncached(path));
}

const DAM_PATH_RE = /^\/content\/dam\//;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i;

// The visual format comes from the block's own classList — the standard DA
// "Block Name (Variant)" convention resolves to extra classes (e.g.
// "Teaser (Hero)" → class="teaser hero") before this JS ever runs.
const FORMAT_CLASSES = {
  hero: ['asc-ui-asset-card--horizontal', 'asc-ui-asset-card--hero'],
  card: [],
  'horizontal-card': ['asc-ui-asset-card--horizontal', 'asc-ui-asset-card--lg'],
  'text-only': [],
};
const KNOWN_VARIANTS = Object.keys(FORMAT_CLASSES).filter((key) => key !== 'card');

function getFormat(block) {
  return KNOWN_VARIANTS.find((variant) => block.classList.contains(variant)) || 'card';
}

// Row 1 is the cover image when it's a pasted image, or a link/bare path
// that looks like one — otherwise it's left alone as ordinary body text.
function extractImageRow(rows) {
  const row = rows[0];
  if (!row) return null;
  const img = row.querySelector('img');
  if (img) return { row, raw: img.getAttribute('src') };
  const link = row.querySelector('a');
  const raw = (link ? link.getAttribute('href') : row.textContent).trim();
  if (raw && (DAM_PATH_RE.test(raw) || IMAGE_EXT_RE.test(raw))) return { row, raw };
  return null;
}

// The CTA is the last row that's just a single link — decorateButtons
// (scripts/aem.js), which runs on the whole page before any block's own
// decorate(), already wraps a lone-link paragraph as `.button-container`.
// Fall back to a bare, unwrapped <a> in case authored HTML skipped that.
function findCtaRow(rows) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const link = rows[i].querySelector(':scope > .button-container a');
    if (link) return { row: rows[i], link };
  }
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const links = row.querySelectorAll('a');
    if (links.length === 1 && row.textContent.trim() === links[0].textContent.trim()) {
      return { row, link: links[0] };
    }
  }
  return null;
}

function mosaicThumbHtml(thumbnails, total) {
  const shown = thumbnails.slice(0, MAX_MOSAIC_THUMBS);
  const overflow = total - shown.length;
  const rowCounts = mosaicRowCounts(shown.length);
  let cursor = 0;
  const rowsHtml = rowCounts.map((rowCount, rowIndex) => {
    const isLastRow = rowIndex === rowCounts.length - 1;
    const cells = Array.from({ length: rowCount }, (_, i) => {
      const url = shown[cursor];
      cursor += 1;
      const isLastCell = isLastRow && i === rowCount - 1;
      const more = isLastCell && overflow > 0
        ? `<span class="asc-ui-collection-card__thumb-more">+${overflow}</span>` : '';
      return `<div class="asc-ui-collection-card__thumb"><img src="${escAttr(url)}" alt="" loading="lazy">${more}</div>`;
    }).join('');
    return `<div class="asc-ui-collection-card__thumb-row" style="--collection-card-row-cols: ${rowCount}">${cells}</div>`;
  }).join('');
  return `<div class="asc-ui-collection-card__thumbs" style="--collection-card-mosaic-height: ${rowCounts.length * ROW_HEIGHT}px">${rowsHtml}</div>`;
}

function thumbHtml(state) {
  if (state.image) return `<img src="${escAttr(state.image)}" alt="" loading="lazy">`;
  if (state.thumbnails?.length) return mosaicThumbHtml(state.thumbnails, state.total);
  return '<div class="asc-ui-filetype" aria-hidden="true"><span class="asc-ui-filetype__glyph">🔗</span><span class="asc-ui-filetype__ext">Link</span></div>';
}

const EYEBROW_LABEL = {
  sheet: 'Curated Set', authored: 'Curated Set', search: 'Live Search',
};

function cardHtml(format, state, link, bodyHtml, ctaLabel) {
  const showThumb = format !== 'text-only';
  const eyebrow = EYEBROW_LABEL[state.kind];
  const count = state.total ? `${state.total} asset${state.total === 1 ? '' : 's'}` : '';
  const cardClasses = [
    'asc-ui-asset-card',
    'asc-ui-asset-card--interactive',
    'asc-ui-asset-card--zoom-hover',
    ...FORMAT_CLASSES[format],
  ].filter(Boolean).join(' ');
  const thumb = showThumb ? `
    <div class="asc-ui-asset-card__thumb">
      ${link ? `<a href="${escAttr(link)}" tabindex="-1" aria-hidden="true">${thumbHtml(state)}</a>` : thumbHtml(state)}
    </div>` : '';
  return `
    <article class="${cardClasses}">
      ${thumb}
      <div class="asc-ui-asset-card__body">
        ${eyebrow ? `<span class="teaser__eyebrow">${escHtml(eyebrow)}</span>` : ''}
        <div class="teaser__content">${bodyHtml}</div>
        ${count ? `<p class="teaser__count">${escHtml(count)}</p>` : ''}
        ${link ? `<a class="btn btn--secondary teaser__cta" href="${escAttr(link)}">${escHtml(ctaLabel)}</a>` : ''}
      </div>
    </article>`;
}

export default async function decorate(block) {
  const format = getFormat(block);
  const rows = [...block.children];

  const imageInfo = extractImageRow(rows);
  if (imageInfo) rows.splice(rows.indexOf(imageInfo.row), 1);
  const isDamImage = imageInfo && DAM_PATH_RE.test(imageInfo.raw);
  const imagePath = isDamImage ? imageInfo.raw : '';

  const ctaInfo = findCtaRow(rows);
  if (ctaInfo) rows.splice(rows.indexOf(ctaInfo.row), 1);
  const link = ctaInfo ? services.url.toRelativeUrl(ctaInfo.link.getAttribute('href')) : '';
  const ctaLabel = ctaInfo ? (ctaInfo.link.textContent.trim() || 'View') : '';

  const bodyHtml = rows.map((row) => row.innerHTML).join('');

  const state = {
    image: imageInfo && !isDamImage ? imageInfo.raw : '',
    thumbnails: [],
    total: 0,
    kind: 'none',
  };

  const render = () => {
    block.innerHTML = cardHtml(format, state, link, bodyHtml, ctaLabel);
  };
  render();

  const needsDamResolve = !!imagePath;
  const needsLinkAutopopulate = !imagePath && !state.image && !!link && format !== 'text-only';
  if (!needsDamResolve && !needsLinkAutopopulate) return;

  const observer = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach(async () => {
      observer.disconnect();
      let result;
      if (needsDamResolve) {
        const resolvedImage = await resolveDamImage(imagePath);
        result = resolvedImage ? { image: resolvedImage } : (link ? await resolveThumbnails(link) : NO_THUMBNAILS);
      } else {
        result = await resolveThumbnails(link);
      }
      Object.assign(state, result);
      render();
    });
  }, { rootMargin: '300px' });
  observer.observe(block);
}
