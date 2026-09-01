/** @owner user */
/**
 * share-directory — a curated, browsable index of published shares: the "here's
 * what we've put together" front door, distinct from search (which assumes you
 * already know what you're looking for) and from a visitor's own personal
 * collections (which nobody has built yet on a first visit).
 *
 * Each entry links to either an authored board, a generated sheet, or the
 * configured search page with query parameters. This block is only a directory;
 * the target page remains the source of truth.
 *
 * Authoring (da.live table) — one row per share, plus optional 2-cell config
 * rows (distinguished purely by cell count — no marker column needed):
 *   | share-directory |                                            |                        |
 *   | view                  | horizontal                               |                      |  ← optional: horizontal (default) | vertical
 *   | hero                  | true                                      |                      |  ← optional: true (default) | false
 *   | hero-index            | 2                                         |                      |  ← optional: 1 (default) — which row (1-based) is the hero
 *   | Spring 2026 Campaign | Curated hero shots for the spring launch | /search?tagid=campaigns:spring-2026 |
 *   | Press Kit             | Logos, product shots, and boilerplate    | /sheets/press-kit    |
 *
 * `view: vertical` renders every card mosaic-on-top instead of the default
 * thumb-left/body-right split (see the "Collection cards" section of
 * docs/UI_KIT.md for both variants). `hero: false` turns off the featured
 * treatment entirely — every card renders at the same --lg size. `hero-index`
 * picks which authored row gets the featured treatment (default: the first
 * one) without having to reorder rows — handy when a page stacks several
 * share-directory blocks (mixed with other authored content in between) and
 * only some of them should lead with a hero.
 *
 * Each share row is: Label | Description | URL/path. A 4th cell is optional —
 * either a cover image (drop one in) or an image URL; omit it, and the card
 * shows an automatically-resolved thumbnail mosaic (see the "Collection cards"
 * section of docs/UI_KIT.md / docs/ui-kit.html) when the link makes one
 * available:
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
 *
 * Card SIZE (not just mosaic density) scales with how many assets are behind
 * the share — more assets → more mosaic rows → a taller card, so a 2-asset
 * press kit and a 40-asset photo library don't read as the same size. Cards
 * default to the asc-ui-asset-card --horizontal --lg variant (mosaic fills a
 * wide column on the left; eyebrow/title/description/count on the right)
 * rather than looking like a plain vertical collection-card clone — see
 * `view`/`hero` above to change that. The eyebrow ("Live Search" / "Curated
 * Set") surfaces which kind of share it is — a
 * search link stays current on its own, while a sheet or authored
 * link is a fixed, hand-picked set.
 */
import { escHtml, escAttr } from '../../scripts/asc/html.js';
import { MAX_MOSAIC_THUMBS, mosaicRowCounts } from '../../scripts/asc/core/utils/mosaic.js';
import services from '../../scripts/asc/core/services/services.js';

// Each mosaic row adds this much card height — unlike the (much milder)
// collection-card sizing in scripts/asc/core/utils/mosaic.js, a share-directory
// teaser's whole point is to visibly signal "how much is behind this link".
const ROW_HEIGHT = 150;

const configurations = (await import('../../scripts/asc/configurations.js')).default;
const SEARCH_PAGE = (configurations.search?.page || '/search').replace(/\/$/, '');
const previewCache = new Map();
const previewQueue = [];
let activePreviews = 0;
const PREVIEW_CONCURRENCY = Math.max(
  1,
  Number(configurations.shareDirectory?.previewConcurrency) || 2,
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
  if (!previewCache.has(link)) {
    previewCache.set(link, schedulePreview(() => resolveThumbnailsUncached(link)));
  }
  return previewCache.get(link);
}

function parseItemRow(cells) {
  const title = cells[0]?.textContent.trim() || '';
  const description = cells[1]?.textContent.trim() || '';
  const link = cells[2]?.textContent.trim() || '';
  const imageCell = cells[3];
  // The link is always a page on this same site (a sheet/collection path) —
  // normalize it to the current domain. The cover image is left alone: it
  // legitimately lives on a different host (the DAM/dynamic media delivery host).
  const image = imageCell?.querySelector('img')?.getAttribute('src') || imageCell?.textContent.trim() || '';
  if (!title || !link) return null;
  return {
    title, link: services.url.toRelativeUrl(link), description, image,
  };
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

function thumbHtml(item) {
  if (item.image) return `<img src="${escAttr(item.image)}" alt="" loading="lazy">`;
  if (item.thumbnails?.length) return mosaicThumbHtml(item.thumbnails, item.total);
  return '<div class="asc-ui-filetype" aria-hidden="true"><span class="asc-ui-filetype__glyph">🔗</span><span class="asc-ui-filetype__ext">Link</span></div>';
}

const EYEBROW_LABEL = {
  sheet: 'Curated Set', authored: 'Curated Set', search: 'Live Search',
};

// wrapperTag is 'li' for a regular grid item, or 'div' for the hero card,
// which sits outside (before) the grid entirely — not just visually full-width
// within it — so its grid-column: 1/-1 span (from the old single-grid layout)
// can't keep auto-fit from collapsing the real grid's unused trailing tracks.
// A hero row-1 span reads as "using" every auto-fit track to the algorithm,
// so 2 regular cards below it would get stuck at 33%/33% + an empty 33% gap
// instead of stretching to fill 50/50 — pulling hero out of the grid avoids
// that interaction entirely.
function cardHtml(item, index, { isHero, config, wrapperTag }) {
  const eyebrow = EYEBROW_LABEL[item.kind];
  const count = item.total ? `${item.total} asset${item.total === 1 ? '' : 's'}` : '';
  const cardClasses = [
    'asc-ui-asset-card',
    'asc-ui-asset-card--interactive',
    'asc-ui-asset-card--zoom-hover',
    config.view === 'vertical' ? '' : 'asc-ui-asset-card--horizontal',
    isHero ? 'asc-ui-asset-card--hero' : 'asc-ui-asset-card--lg',
  ].filter(Boolean).join(' ');
  return `
    <${wrapperTag} class="share-directory__card${isHero ? ' share-directory__card--hero' : ''}" data-share-index="${index}">
      <a class="${cardClasses}" href="${escAttr(item.link)}">
        <div class="asc-ui-asset-card__thumb">${thumbHtml(item)}</div>
        <div class="asc-ui-asset-card__body">
          ${eyebrow ? `<span class="share-directory__eyebrow">${escHtml(eyebrow)}</span>` : ''}
          <h3 class="asc-ui-asset-card__title">${escHtml(item.title)}</h3>
          ${item.description ? `<p class="asc-ui-asset-card__meta">${escHtml(item.description)}</p>` : ''}
          ${count ? `<p class="share-directory__count">${escHtml(count)}</p>` : ''}
        </div>
      </a>
    </${wrapperTag}>`;
}

function parseConfig(block) {
  const config = { view: 'horizontal', hero: true, heroIndex: 1 };
  const itemRows = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length !== 2) {
      itemRows.push(cells);
      return;
    }
    const key = cells[0]?.textContent.trim().toLowerCase();
    const value = cells[1]?.textContent.trim().toLowerCase();
    if (key === 'view' && value === 'vertical') config.view = 'vertical';
    else if (key === 'hero') config.hero = value !== 'false';
    else if (key === 'hero-index') {
      const n = parseInt(value, 10);
      if (Number.isFinite(n) && n >= 1) config.heroIndex = n;
    }
    // Any other 2-cell row isn't a valid share row (those need Label |
    // Description | URL/path, at least 3 cells) or a recognized config key —
    // drop it rather than mis-rendering an incomplete card.
  });
  return { config, itemRows };
}

export default async function decorate(block) {
  const { config, itemRows } = parseConfig(block);
  const items = itemRows.map(parseItemRow).filter(Boolean);

  const gridClass = `share-directory__grid${config.view === 'vertical' ? ' share-directory__grid--vertical' : ''}`;
  const heroIndex = config.hero ? Math.min(config.heroIndex, items.length) - 1 : -1;
  const heroItem = heroIndex >= 0 ? items[heroIndex] : null;
  const restEntries = items
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index !== heroIndex);

  const heroHtml = heroItem
    ? cardHtml(heroItem, heroIndex, { isHero: true, config, wrapperTag: 'div' }) : '';
  const restHtml = restEntries.length
    ? `<ul class="${gridClass}" role="list">${restEntries.map(({ item, index }) => cardHtml(item, index, { isHero: false, config, wrapperTag: 'li' })).join('')}</ul>`
    : '';

  block.innerHTML = `
    ${items.length
    ? `${heroHtml}${restHtml}`
    : `<div class="asc-ui-empty-state">
        <p class="asc-ui-empty-state__title">No shares yet</p>
        <p class="asc-ui-empty-state__hint">Add a row to this block to feature a published collection here.</p>
      </div>`}`;

  const observer = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach(async (entry) => {
      observer.unobserve(entry.target);
      const index = Number(entry.target.dataset.shareIndex);
      const item = items[index];
      if (!item || item.image) return;
      const result = await resolveThumbnails(item.link);
      Object.assign(item, result);
      const isHero = index === heroIndex;
      const template = document.createElement('template');
      template.innerHTML = cardHtml(item, index, {
        isHero,
        config,
        wrapperTag: isHero ? 'div' : 'li',
      });
      entry.target.replaceWith(template.content.firstElementChild);
    });
  }, { rootMargin: '300px' });
  block.querySelectorAll('.share-directory__card').forEach((card) => observer.observe(card));
}
