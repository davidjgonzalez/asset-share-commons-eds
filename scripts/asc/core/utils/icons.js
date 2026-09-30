// ASC Core — do not edit. Customize via scripts/asc/configurations.js
/*
 * Shared inline-SVG icon set (24x24 viewBox, stroked with currentColor so icons follow the
 * surrounding text colour and theme). Use instead of pasting <svg> markup into blocks:
 *
 *   import { icon } from '../../scripts/asc/core/utils/icons.js';
 *   button.innerHTML = `${icon('download')} Download`;
 *   icon('check', { size: 12, strokeWidth: 2.5 });
 *   icon('star', { filled: true });
 */

const ICONS = {
  check: '<polyline points="20 6 9 17 4 12"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  arrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  arrowDown: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  externalLink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  comment: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-3a4 4 0 0 1-2-3.46V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4z"/>',
  more: { body: '<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>', filled: true, stroke: false },
  sortField: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/>',
  viewCards: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>',
  viewMasonry: '<rect x="3" y="3" width="5" height="12" rx="1"/><rect x="3" y="17" width="5" height="4" rx="1"/><rect x="10" y="3" width="5" height="4" rx="1"/><rect x="10" y="9" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="7" rx="1"/><rect x="17" y="12" width="4" height="9" rx="1"/>',
  viewList: '<rect x="3" y="4" width="4" height="4" rx="0.5"/><line x1="9" y1="6" x2="21" y2="6"/><rect x="3" y="11" width="4" height="4" rx="0.5"/><line x1="9" y1="13" x2="21" y2="13"/><rect x="3" y="18" width="4" height="4" rx="0.5"/><line x1="9" y1="20" x2="21" y2="20"/>',
};

/**
 * Returns the markup for a named icon.
 *
 * @param {string} name  A key of ICONS
 * @param {object} [options]
 * @param {number} [options.size=16]  Width and height in px
 * @param {number} [options.strokeWidth=2]
 * @param {boolean} [options.filled=false]  Fill with currentColor as well as stroke
 * @returns {string} SVG markup, or '' for an unknown name
 */
export function icon(name, { size = 16, strokeWidth = 2, filled = false } = {}) {
  const def = ICONS[name];
  if (!def) return '';
  const { body, filled: alwaysFilled = false, stroke = true } = typeof def === 'string' ? { body: def } : def;
  const fill = filled || alwaysFilled ? 'currentColor' : 'none';
  const strokeAttrs = stroke
    ? ` stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}"${strokeAttrs} aria-hidden="true">${body}</svg>`;
}

export default ICONS;
