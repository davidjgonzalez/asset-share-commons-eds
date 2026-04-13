// ASC Core — do not edit. Customize via scripts/configurations.js

import services from '../../services/services.js';

/**
 * picture(asset, options) — returns a responsive <picture> HTML string for an asset.
 *
 * If the asset has web rendition nodes (cq5dam.web.*), a <picture> with <source>
 * breakpoints is built. Otherwise falls back to a plain <img> using the thumbnail URL.
 *
 * @param {Asset}  asset
 * @param {object} [options]
 * @param {string}  [options.alt]           Alt text (defaults to asset title)
 * @param {boolean} [options.eager]         loading="eager" + fetchpriority="high" for LCP images
 * @param {Array}   [options.breakpoints]   Custom breakpoints: [{ media: '(min-width: 768px)', renditionWidth: 800 }]
 * @param {object}  [options.imgAttributes] Extra attributes merged onto <img>
 * @returns {string}
 */
export default function picture(asset, options = {}) {
  const {
    alt = null,
    eager = false,
    breakpoints = null,
    imgAttributes = {},
  } = options;

  const altText = alt !== null ? alt : asset.title;
  const loading = eager ? 'eager' : 'lazy';
  const fetchpriority = eager ? 'high' : 'auto';

  // Collect delivery renditions — exclude cq5dam.thumbnail.* (display thumbnails,
  // not delivery renditions) and sort largest first.
  const imageRenditions = asset.staticRenditions
    .filter((r) => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(r.mimeType))
    .filter((r) => !r.id?.startsWith('cq5dam.thumbnail.'))
    .sort((a, b) => (b.width || 0) - (a.width || 0));

  const thumbnailUrl = services.renditions.getThumbnailUrl(asset);

  if (!imageRenditions.length) {
    return `<img ${buildAttrString({ src: thumbnailUrl, alt: altText, loading, fetchpriority, ...imgAttributes })} />`;
  }

  let sources;
  if (breakpoints) {
    sources = breakpoints.map((bp) => {
      const rendition = imageRenditions.find((r) => r.width >= bp.renditionWidth)
        || imageRenditions[imageRenditions.length - 1];
      return `<source srcset="${rendition.url}" type="${rendition.mimeType}" media="${bp.media}" />`;
    }).join('\n');
  } else {
    // Auto: one <source> per rendition, largest first, each guarded by a min-width.
    sources = imageRenditions.map((r, i) => {
      const next = imageRenditions[i + 1];
      const media = next ? `(min-width: ${next.width + 1}px)` : '';
      return media
        ? `<source srcset="${r.url}" type="${r.mimeType}" media="${media}" />`
        : `<source srcset="${r.url}" type="${r.mimeType}" />`;
    }).join('\n');
  }

  const fallback = imageRenditions[imageRenditions.length - 1];
  const style = fallback.width && fallback.height
    ? `aspect-ratio: ${fallback.width}/${fallback.height}; width: 100%; object-fit: cover;`
    : 'width: 100%; object-fit: cover;';

  const imgAttrStr = buildAttrString({
    src: fallback.url, alt: altText, loading, fetchpriority, style, ...imgAttributes,
  });

  return `<picture>\n${sources}\n<img ${imgAttrStr} />\n</picture>`;
}

function buildAttrString(attrs) {
  return Object.entries(attrs)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
}
