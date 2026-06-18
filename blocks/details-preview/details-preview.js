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
 * styles/asc/sections/detail.css). This keeps the details page author-arrangeable
 * and mirrors the UI Kit `.asc-ui-detail` two-pane layout.
 */
export default async function decorate(block) {
  try {
    const asset = await Asset.create(block);

    // Reflect the asset in the page/tab title
    document.title = `${asset.title} - Asset Details`;

    block.innerHTML = `
      <div class="asc-ui-detail__preview">
        <img src="${asset.getRendition('web')?.url || asset.thumbnail}" alt="${asset.title}" loading="eager">
      </div>
    `;
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
