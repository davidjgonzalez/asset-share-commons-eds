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
import serviceConfigurations from '../configurations.js';
import { delegateEvent } from '../../utils/events.js';
import { loadFragment } from '../../../../blocks/fragment/fragment.js';

class AssetDetails {
    constructor(config) {
        this.config = {
            showAssetDetails: this.showAssetDetails,
            ...config
        }
        this.init();
    }

    init() {
        // This syntax is used to ensure that the 'showAssetDetails' method is called with the correct 'this' context (the AssetDetails instance).
        // Without .bind(this), 'this' inside showAssetDetails would refer to the element or window, not the class instance.
        delegateEvent(document.body, '[data-asc-asset-details]', 'click', this.config.showAssetDetails.bind(this));
    }

    async getAsset(input) {       
        if (input.contains('/')) {
            // assume its a URL where the suffix is the UUID
            input = input.split('/').pop();
        } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) {
            input = input;
        } else {
            input = null;
        }

        if (input) {
            return services.search.getAssetById(input);
        }

        return null;
    }

    async showAssetDetails(event) {
        event.preventDefault();
        console.log('showAssetDetails', event.target);
        event.target.setAttribute('data-asc-asset-status', 'showing');
        const assetId = event.target.dataset.ascAssetId;
        const response = await fetch(`/details/default.plain.html/${assetId}`);

        const fragment = await loadFragment(`/details/default.plain.html/${assetId}`);


        // Create a <dialog> element and inject the HTML
        const dialog = document.createElement('dialog');    
        // Dialog should be fullscreen
        dialog.style.width = '90vw';
        dialog.style.height = '90vh';
        dialog.style.position = 'fixed';
        dialog.style.top = '0';
        dialog.style.left = '0';
        dialog.style.zIndex = '1000';
        dialog.classList.add('asset-details-dialog');
        dialog.appendChild(fragment);
        
        // Optionally add a close button if not present in html
        if (!dialog.querySelector('[data-dialog-close]')) {
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.type = 'button';
            closeBtn.setAttribute('data-dialog-close', '');
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '1em';
            closeBtn.style.right = '1em';
            dialog.appendChild(closeBtn);
        }

        // Close dialog on close button click or when dialog is canceled (ESC)
        dialog.addEventListener('click', (e) => {
            if (e.target.matches('[data-dialog-close]')) {
                dialog.close();
            }
        });
        dialog.addEventListener('close', () => {
            dialog.remove();
        });

        document.body.appendChild(dialog);
        dialog.showModal();
    }
}

export default new AssetDetails(serviceConfigurations.assetDetails);