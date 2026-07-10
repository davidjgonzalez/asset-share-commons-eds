/** @owner user */
/**
 * details-header — the asset title + meta subtitle bar at the top of the
 * details view (mirrors the UI Kit .asc-dialog__header).
 *
 * Authored content is treated as a TEMPLATE: any `{{ … }}` token is resolved
 * against the current asset. Authoring (da.live table):
 *
 *   | details-header |
 *   | {{title}} |
 *   | {{mime-type}} · {{file-size}} · {{dimensions}} |
 *
 *   Row 1 → title (h2).   Row 2 → meta subtitle (p).  Both optional.
 *
 * Token syntax:  {{ accessor }}  or  {{ accessor | fallback }}
 *   accessor is resolved via Asset.getProperty() (so `title`, `mime-type`,
 *   `file-size`, `file-type`, `dimensions`, `description`, or any raw metadata
 *   key like `dc:format`), with a few computed getters (`url`, `uuid`,
 *   `file-extension`, `filename`) layered on top. Empty values fall back to the
 *   text after `|` (or collapse, trimming dangling " · " separators).
 *
 * Defaults (when a row is omitted): title → {{title}}, meta → file info line.
 */
import Asset from '../../scripts/asc/core/models/asset.js';
import { resolveTokens } from '../../scripts/asc/tokens.js';

const DEFAULT_TITLE = '{{title}}';
const DEFAULT_META = '{{file-type}} · {{file-size}} · {{dimensions}}';

export default async function decorate(block) {
  // Read authored rows as raw template strings before we replace the markup.
  const rows = [...block.children]
    .map((row) => row.textContent.trim())
    .filter(Boolean);
  const titleTpl = rows[0] || DEFAULT_TITLE;
  const metaTpl = rows.length > 1 ? rows[1] : DEFAULT_META;

  let asset;
  try {
    asset = await Asset.create(block);
  } catch (error) {
    block.innerHTML = '';
    return;
  }
  if (!asset) {
    block.innerHTML = '';
    return;
  }

  const title = resolveTokens(titleTpl, asset);
  const meta = resolveTokens(metaTpl, asset);

  if (title) document.title = `${title} - Asset Details`;

  block.innerHTML = `
    ${title ? `<h2 class="details-header__title">${esc(title)}</h2>` : ''}
    ${meta ? `<p class="details-header__meta">${esc(meta)}</p>` : ''}`;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
