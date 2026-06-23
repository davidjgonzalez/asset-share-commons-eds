/** @owner user */
// Copyright 2025 David G.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import Asset from '../../scripts/asc/models/asset.js';

/**
 * details-preview — renders ONLY the asset's visual preview (the media).
 *
 * Title, metadata, and actions are intentionally NOT part of this block — they
 * are composed from separate blocks (details-property, details-actions) and
 * arranged alongside the preview by the `detail` section layout (see
 * styles/sections/detail.css). This keeps the details page author-arrangeable
 * and mirrors the UI Kit `.asc-ui-detail` two-pane layout.
 */
export default async function decorate(block) {
  try {
    const asset = await Asset.create(block);

    // Reflect the asset in the page/tab title
    document.title = `${asset.title} - Asset Details`;

    const defaultRendition = asset.getRendition('original') || asset.getRendition('web');
    let activeRendition = defaultRendition;

    const srcFor = (r) => r?.url || asset.thumbnail;

    block.innerHTML = `
      <div class="asc-ui-detail__preview">
        <img src="${srcFor(activeRendition)}" alt="${asset.title}" loading="eager">
        <span class="asc-ui-chip details-preview__rendition-label"></span>
      </div>
    `;

    const preview = block.querySelector('.asc-ui-detail__preview');
    const img = block.querySelector('img');
    const label = block.querySelector('.details-preview__rendition-label');

    // Size the container to the most vertical rendition so switching renditions
    // never causes a layout shift — landscape renditions just have more padding.
    const withDims = asset.renditions.filter((r) => r.width && r.height);
    if (withDims.length) {
      const tallest = withDims.reduce((best, r) => (r.width / r.height < best.width / best.height ? r : best));
      preview.style.aspectRatio = `${tallest.width} / ${tallest.height}`;
    }

    const setDisplay = (rendition, sticky) => {
      img.src = srcFor(rendition);
      label.textContent = rendition?.label ? `Rendition: ${rendition.label}` : '';
      if (sticky) activeRendition = rendition;
    };

    setDisplay(activeRendition, false);

    document.body.addEventListener('asc:rendition:activate', (e) => {
      setDisplay(e.detail.rendition, true);
    });

    document.body.addEventListener('asc:rendition:preview', (e) => {
      if (e.detail.rendition) {
        setDisplay(e.detail.rendition, false);
      } else {
        setDisplay(activeRendition, false);
      }
    });
  } catch (error) {
    console.error('Failed to load asset:', error);
    block.innerHTML = `
      <div class="asc-ui-empty-state">
        <span class="asc-ui-empty-state__icon" aria-hidden="true">⚠️</span>
        <p class="asc-ui-empty-state__title">Asset not found</p>
        <p class="asc-ui-empty-state__hint">${error.message}</p>
      </div>
    `;
  }
}
