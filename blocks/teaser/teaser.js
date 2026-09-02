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
 * Authoring is free-form rich text, not fixed key | value fields — type it
 * all into one table cell, exactly like any other rich-text block:
 *   | Teaser (Horizontal Card)                                    |
 *   | ## ![](/path/to/image.png)Spring 2026 Campaign               |
 *   | Curated hero shots for the spring launch                    |
 *   | [View the collection](/search?tagid=campaigns:spring-2026)  |
 * Rows/cells aren't meaningful on their own — DA's table→HTML conversion
 * wraps a cell's content in a div either way, so spreading the same content
 * across several rows instead (image alone in its own row, then a row per
 * paragraph, then the CTA in its own row) authors identically.
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
 * Add "Right Image" as a second, comma-separated variant to any --horizontal
 * format (Hero or Horizontal Card) to swap sides — thumb-right/body-left
 * instead of the default thumb-left/body-right, e.g.
 * "Teaser (Horizontal Card, Right Image)". "Left Image" is also accepted,
 * for authors who'd rather state the default explicitly.
 *
 * Cover image (optional): a pasted image — or a link/bare path that looks
 * like one (a file extension, or a DAM path like `/content/dam/foo/bar.png`)
 * — is the cover image as long as it's in the very first paragraph/heading,
 * either inline (e.g. pasted at the start of the opening heading, as in the
 * example above) or alone in its own leading paragraph. A DAM path is
 * resolved through the search index to a real asset and rendered via its
 * web-optimized-delivery thumbnail (configurations.renditions.thumbnails)
 * rather than used as a raw <img src>. An image anywhere else is left alone
 * as ordinary body content instead.
 *
 * Everything except the cover image and the CTA (below) is rendered as-is:
 * whatever headings/paragraphs/formatting were authored.
 *
 * CTA / resolver: the last paragraph that's just a single link (the standard
 * EDS "lone link in a paragraph becomes a button" convention — see
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
 * asset thumbnails) when there wasn't already a cover image, and drives the
 * eyebrow ("Live Search" / "Curated Set") — a search link stays current on
 * its own, while a sheet or authored link is a fixed, hand-picked set. None
 * of this runs for format: Text Only, since that never shows a thumbnail.
 */
import { escHtml, escAttr } from '../../scripts/asc/html.js';
import { MAX_MOSAIC_THUMBS, mosaicRowCounts, mosaicHeight } from '../../scripts/asc/core/utils/mosaic.js';
import services from '../../scripts/asc/core/services/services.js';

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

// Independent of format: any --horizontal format (Hero, Horizontal Card) can
// also take a "Right Image" variant, e.g. "Teaser (Horizontal Card, Right
// Image)" → class="teaser horizontal-card right-image" — the standard DA
// "Block (Variant, Variant)" convention. "Left Image" is accepted too, for
// authors who'd rather state the default explicitly; it's a no-op.
function isRightImage(block) {
  return block.classList.contains('right-image');
}

// DA's table→HTML conversion always nests one row div per table row and one
// cell div per column inside it, even for a single-column table — so a rich-
// text cell's own headings/paragraphs sit two levels below the block, not
// directly under the row (a single-row, single-cell teaser with an inline
// image + copy + CTA all typed into the one cell looks like
// block > row > cell > [h2, p, p]). Flatten through that wrapping to get the
// actual content nodes in authoring order, regardless of how many rows/cells
// they're spread across — a row with no such single-cell wrapper (or with
// several cells, i.e. a key|value row from some other convention) is passed
// through as-is instead of guessing.
function contentNodes(block) {
  const nodes = [];
  [...block.children].forEach((row) => {
    const isSingleCellWrapper = row.children.length === 1
      && row.firstElementChild.tagName === 'DIV';
    nodes.push(...(isSingleCellWrapper ? row.firstElementChild : row).children);
  });
  return nodes;
}

// The cover image is a pasted image, or a link/bare path that looks like one
// (checked against the whole node's content, so body copy that merely
// mentions a filename isn't mistaken for it) — either as its own node (then
// dropped entirely) or inline within the leading node, e.g. an image pasted
// at the start of the opening heading (then just that image is pulled out,
// leaving the heading's own text in place). Only the first node is eligible,
// so an image further down in the body stays part of the body.
function extractImage(nodes) {
  const [node] = nodes;
  if (!node) return null;
  const img = node.querySelector('img');
  if (img) {
    const raw = img.getAttribute('src');
    (img.closest('picture') || img).remove();
    if (!node.textContent.trim() && !node.children.length) nodes.shift();
    return { raw };
  }
  const link = node.querySelector('a');
  const raw = (link ? link.getAttribute('href') : node.textContent).trim();
  const wholeNode = link ? link.textContent.trim() === node.textContent.trim() : true;
  if (raw && wholeNode && (DAM_PATH_RE.test(raw) || IMAGE_EXT_RE.test(raw))) {
    nodes.shift();
    return { raw };
  }
  return null;
}

// The CTA is the last node that's just a single link — decorateButtons
// (scripts/aem.js), which runs on the whole page before any block's own
// decorate(), already marks a lone-link paragraph itself as
// `.button-container` (a's parent gets the class, since it's the one with
// a single childNode). Fall back to a bare, unwrapped <a> in case authored
// HTML skipped that.
function extractCta(nodes) {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    if (nodes[i].classList.contains('button-container')) {
      const link = nodes[i].querySelector(':scope > a');
      if (link) {
        nodes.splice(i, 1);
        return { link };
      }
    }
  }
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    const links = node.querySelectorAll('a');
    if (links.length === 1 && node.textContent.trim() === links[0].textContent.trim()) {
      nodes.splice(i, 1);
      return { link: links[0] };
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
  return `<div class="asc-ui-collection-card__thumbs" style="--collection-card-mosaic-height: ${mosaicHeight(rowCounts.length)}px">${rowsHtml}</div>`;
}

function thumbHtml(state) {
  if (state.image) return `<img src="${escAttr(state.image)}" alt="" loading="lazy">`;
  if (state.thumbnails?.length) return mosaicThumbHtml(state.thumbnails, state.total);
  return '<div class="asc-ui-filetype" aria-hidden="true"><span class="asc-ui-filetype__glyph">🔗</span><span class="asc-ui-filetype__ext">Link</span></div>';
}

const EYEBROW_LABEL = {
  sheet: 'Curated Set', authored: 'Curated Set', search: 'Live Search',
};

function cardHtml(format, reverse, state, link, bodyHtml, ctaLabel) {
  const showThumb = format !== 'text-only';
  const eyebrow = EYEBROW_LABEL[state.kind];
  const count = state.total ? `${state.total} asset${state.total === 1 ? '' : 's'}` : '';
  const cardClasses = [
    'asc-ui-asset-card',
    'asc-ui-asset-card--interactive',
    'asc-ui-asset-card--zoom-hover',
    ...FORMAT_CLASSES[format],
    reverse ? 'asc-ui-asset-card--reverse' : '',
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
  const reverse = isRightImage(block);
  const nodes = contentNodes(block);

  const imageInfo = extractImage(nodes);
  const isDamImage = imageInfo && DAM_PATH_RE.test(imageInfo.raw);
  const imagePath = isDamImage ? imageInfo.raw : '';

  const ctaInfo = extractCta(nodes);
  const link = ctaInfo ? services.url.toRelativeUrl(ctaInfo.link.getAttribute('href')) : '';
  const ctaLabel = ctaInfo ? (ctaInfo.link.textContent.trim() || 'View') : '';

  const bodyHtml = nodes.map((node) => node.outerHTML).join('');

  const state = {
    image: imageInfo && !isDamImage ? imageInfo.raw : '',
    thumbnails: [],
    total: 0,
    kind: 'none',
  };

  const render = () => {
    block.innerHTML = cardHtml(format, reverse, state, link, bodyHtml, ctaLabel);
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
