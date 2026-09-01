// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import { propValue, escHtml, escAttr } from '../../../html.js';

export default function get(asset) {
  const dist = asset.getProperty('jcr:content/metadata/dam:colorDistribution').data;
  if (!dist || typeof dist !== 'object') return null;
  const list = Object.values(dist)
    .filter((c) => c && Array.isArray(c.rgb) && c.rgb.length === 3)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  if (!list.length) return null;
  const swatches = list.map(({ rgb, name }) => ({
    hex: `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`,
    label: name.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
  }));
  const html = `<span class="asc-ui-swatch-list">${swatches.map(({ hex, label }) =>
    `<span class="asc-ui-swatch" style="--asc-ui-swatch-color:${escAttr(hex)}">`
    + `<span class="asc-ui-swatch__dot"></span>`
    + `<span class="asc-ui-swatch__label">${escHtml(label)}</span>`
    + `</span>`).join('')}</span>`;
  return propValue(swatches, html, swatches.map((s) => s.label).join(', '));
}
