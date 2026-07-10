// ASC Core — do not edit. Customize via scripts/asc/configurations.js

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

import { decorateBlock, loadBlock } from '../../../../aem.js';
import serviceConfigurations from '../configurations.js';
import { loadFragment } from '../../utils/fragments.js';

// URL parameter used for deep-linking to a specific asset's details
const ASSET_URL_PARAM = 'asset';

class AssetDetails {
  constructor(config) {
    this.config = config || {};
    this.templates = this.config.templates || (() => '/details');
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

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
      if (event.state?.assetId) {
        // Navigate to the asset in this history entry without pushing a new entry
        this.open(event.state.assetId, { addHistory: false });
      } else {
        // No asset in this history entry — close without touching history
        this.close({ updateHistory: false });
      }
    });

    // Auto-open if URL already contains an asset param on page load.
    // Use replaceState (not pushState) — the URL already reflects this state.
    const urlAsset = new URLSearchParams(window.location.search).get(ASSET_URL_PARAM);
    if (urlAsset) {
      this.open(urlAsset, { addHistory: false });
    }
  }

  /**
   * Resolve which fragment template to load for a given asset.
   * `config.templates` must be a function: (asset) => string.
   * Falls back to '/details' if the function returns a falsy value.
   */
  resolveTemplate(asset) {
    return this.templates(asset) || '/details';
  }

  /**
   * Open the asset details modal for the given asset ID.
   *
   * @param {string} assetId  UUID of the asset to display
   * @param {object} [opts]
   * @param {boolean} [opts.addHistory=true]  Push a new browser history entry.
   *   Pass false when responding to a popstate event (back/forward) or on
   *   initial page load (URL already reflects the state).
   */
  async open(assetId, { addHistory = true } = {}) {
    if (!this.modal) return;
    this._triggerElement = document.activeElement;

    // Fetch the asset to determine its MIME type for template resolution
    // Import lazily to avoid circular dependencies
    const { default: search } = await import('../search/search.js');
    const asset = await search.getAssetById(assetId);

    if (!asset) {
      console.warn(`[AssetDetails] Asset not found: ${assetId}`);
      return;
    }

    const templatePath = this.resolveTemplate(asset);

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

    const dialog = this.modal.querySelector('dialog');
    dialog.querySelector('.content').replaceChildren(fragment);
    if (!dialog.open) dialog.showModal();

    // Update URL and browser history
    const url = new URL(window.location);
    url.searchParams.set(ASSET_URL_PARAM, assetId);

    if (addHistory) {
      window.history.pushState({ assetId }, '', url);
    } else {
      window.history.replaceState({ assetId }, '', url);
    }
  }

  /**
   * Close the asset details modal.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.updateHistory=true]  Update the URL/history.
   *   Pass false when responding to a popstate event — history is already
   *   being navigated and should not be modified again.
   */
  close({ updateHistory = true } = {}) {
    if (!this.modal) return;
    this.modal.querySelector('dialog')?.close();
    this._triggerElement?.focus();
    this._triggerElement = null;

    if (updateHistory) {
      const url = new URL(window.location);
      url.searchParams.delete(ASSET_URL_PARAM);
      window.history.replaceState({}, '', url);
    }
  }
}

export default new AssetDetails(serviceConfigurations.assetDetails || {});
