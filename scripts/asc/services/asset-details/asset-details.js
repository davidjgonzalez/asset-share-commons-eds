// ASC Core — do not edit. Customize via scripts/configurations.js

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

import { decorateBlock, loadBlock } from '../../../aem.js';
import serviceConfigurations from '../configurations.js';
import { loadFragment } from '../../utils/fragments.js';

// URL parameter used for deep-linking to a specific asset's details
const ASSET_URL_PARAM = 'asset';

class AssetDetails {
  constructor(config) {
    this.config = config || {};
    this.templates = this.config.templates || { default: '/details/default' };
    this.modal = null;
    this.init();
  }

  init() {
    // Inject the details-modal block if not already on the page
    if (!document.querySelector('.block.details-modal')) {
      const block = document.createElement('div');
      block.classList.add('details-modal');
      document.body.appendChild(block);
      decorateBlock(block);
      loadBlock(block).then(() => this._attachListeners(block));
    } else {
      this._attachListeners(document.querySelector('.block.details-modal'));
    }
  }

  _attachListeners(block) {
    this.modal = block;

    // Open modal when asc:asset:details:open fires (from data-asc-action or programmatically)
    document.body.addEventListener('asc:asset:details:open', async (event) => {
      const { ascAsset } = event.detail?.data || event.target?.dataset || {};
      if (!ascAsset) return;
      await this.open(ascAsset);
    });

    // Close modal — fired by the close button action or programmatically
    document.body.addEventListener('asc:asset:details:close', () => {
      this.close();
    });

    // Auto-open if URL already contains an asset param on page load
    const urlAsset = new URLSearchParams(window.location.search).get(ASSET_URL_PARAM);
    if (urlAsset) {
      this.open(urlAsset);
    }
  }

  /**
   * Resolve which fragment template to load for a given MIME type.
   * Uses the templates map from configurations.assetDetails.templates.
   * Supports exact matches ('application/pdf') and wildcard prefixes ('image/*').
   * Falls back to 'default'.
   */
  resolveTemplate(mimeType) {
    if (!mimeType) return this.templates.default || '/details/default';

    for (const [pattern, path] of Object.entries(this.templates)) {
      if (pattern === 'default') continue;
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        if (mimeType.startsWith(prefix)) return path;
      } else if (mimeType === pattern) {
        return path;
      }
    }

    return this.templates.default || '/details/default';
  }

  async open(assetId) {
    if (!this.modal) return;

    // Fetch the asset to determine its MIME type for template resolution
    // Import lazily to avoid circular dependencies
    const { default: search } = await import('../search/search.js');
    const asset = await search.getAssetById(assetId);

    if (!asset) {
      console.warn(`[AssetDetails] Asset not found: ${assetId}`);
      return;
    }

    const templatePath = this.resolveTemplate(asset.mimeType);

    const fragment = await loadFragment(templatePath, {
      main: {
        'data-asc-asset': assetId,
        class: 'modal',
      },
    });

    if (!fragment) {
      console.warn(`[AssetDetails] Could not load fragment: ${templatePath}`);
      return;
    }

    this.modal.querySelector('dialog .content').replaceChildren(fragment);
    this.modal.querySelector('dialog').showModal();

    // Update URL to make this view deep-linkable
    const url = new URL(window.location);
    url.searchParams.set(ASSET_URL_PARAM, assetId);
    window.history.replaceState({ assetId }, '', url);
  }

  close() {
    if (!this.modal) return;
    this.modal.querySelector('dialog')?.close();

    // Remove asset param from URL
    const url = new URL(window.location);
    url.searchParams.delete(ASSET_URL_PARAM);
    window.history.replaceState({}, '', url);
  }
}

export default new AssetDetails(serviceConfigurations.assetDetails);
