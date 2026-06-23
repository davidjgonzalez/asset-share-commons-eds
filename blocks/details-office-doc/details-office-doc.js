/** @owner user */
/**
 * details-office-doc — embeds Office documents (Word, Excel, PowerPoint) using
 * the Microsoft Office Online viewer.
 *
 * The asset URL must be publicly accessible — the viewer fetches the file from
 * Microsoft's servers and will fail if the asset is behind auth or a VPN.
 *
 * Authoring (da.live table — all rows optional):
 *
 *   | details-office-doc |         |
 *   | height             | 600px   |  ← viewer height, any CSS length (default: 600px)
 */

import { readBlockConfig } from '../../scripts/asc/utils/blocks.js';
import { escAttr } from '../../scripts/html.js';
import Asset from '../../scripts/asc/models/asset.js';

const OFFICE_VIEWER = 'https://view.officeapps.live.com/op/embed.aspx?src=';
const DEFAULT_HEIGHT = '600px';

export default async function decorate(block) {
  const { height = DEFAULT_HEIGHT } = readBlockConfig(block);

  block.innerHTML = `<div class="details-office-doc__viewer details-office-doc__viewer--loading">
    <span class="asc-ui-skeleton" style="width:100%;height:${escAttr(height)}"></span>
  </div>`;

  try {
    const asset = await Asset.create(block);
    const src = `${OFFICE_VIEWER}${encodeURIComponent(asset.url)}`;
    block.innerHTML = `
      <div class="details-office-doc__viewer">
        <iframe
          class="details-office-doc__frame"
          src="${escAttr(src)}"
          title="${escAttr(asset.title)}"
          style="height:${escAttr(height)}"
          loading="lazy"
          allowfullscreen>
        </iframe>
      </div>`;
  } catch {
    block.innerHTML = `
      <div class="asc-ui-empty-state">
        <p class="asc-ui-empty-state__title">Could not load document</p>
        <p class="asc-ui-empty-state__hint">The asset could not be found or loaded.</p>
      </div>`;
  }
}
