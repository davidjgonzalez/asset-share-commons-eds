/** @owner user */
/**
 * details-video — embeds a video asset using a native <video> element.
 *
 * Authoring (da.live table — all rows optional):
 *
 *   | details-video |          |
 *   | height        | 600px    |  ← viewer height, any CSS length (default: 600px)
 *   | controls      | true     |  ← show native controls (default: true)
 *   | autoplay      | false    |
 *   | muted         | false    |
 *   | loop          | false    |
 *   | playsinline   | true     |
 *   | preload       | metadata |  ← auto | metadata | none
 *   | poster        |          |  ← optional poster image URL
 */

import { readBlockConfig } from '../../scripts/asc/utils/blocks.js';
import { escAttr } from '../../scripts/html.js';
import Asset from '../../scripts/asc/models/asset.js';

const DEFAULTS = {
  height: '600px',
  preload: 'metadata',
};

export default async function decorate(block) {
  const raw = readBlockConfig(block);
  const bool = (key, def) => (raw[key] === undefined ? def : raw[key] !== 'false');

  const config = {
    height: raw.height || DEFAULTS.height,
    controls: bool('controls', true),
    autoplay: bool('autoplay', false),
    muted: bool('muted', false),
    loop: bool('loop', false),
    playsInline: bool('playsinline', true),
    preload: raw.preload || DEFAULTS.preload,
    poster: raw.poster || '',
  };

  block.innerHTML = `<div class="details-video__viewer details-video__viewer--loading">
    <span class="asc-ui-skeleton" style="width:100%;height:${escAttr(config.height)}"></span>
  </div>`;

  try {
    const asset = await Asset.create(block);
    const attr = [
      config.controls ? 'controls' : '',
      config.autoplay ? 'autoplay' : '',
      config.muted ? 'muted' : '',
      config.loop ? 'loop' : '',
      config.playsInline ? 'playsinline' : '',
      `preload="${escAttr(config.preload)}"`,
      config.poster ? `poster="${escAttr(config.poster)}"` : '',
    ].filter(Boolean).join(' ');

    block.innerHTML = `
      <div class="details-video__viewer">
        <video
          class="details-video__player"
          title="${escAttr(asset.filename || asset.title || 'Video preview')}"
          style="height:${escAttr(config.height)}"
          ${attr}>
          <source src="${escAttr(asset.url)}" type="${escAttr(asset.mimeType || 'video/mp4')}">
        </video>
      </div>`;
  } catch {
    block.innerHTML = `
      <div class="asc-ui-empty-state">
        <p class="asc-ui-empty-state__title">Could not load video</p>
        <p class="asc-ui-empty-state__hint">The asset could not be found or loaded.</p>
      </div>`;
  }
}