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
import services from '../../scripts/asc/services/services.js';

export default async function decorate(block) {
  try {
    // Get asset from URL (UUID or path)
    const asset = await Asset.create(block);
    
    // Update page title
    document.title = `${asset.title} - Asset Details`;
    
    // Render asset preview
    block.innerHTML = `
      <section class="asset-preview">
        <figure>
          <img src="${asset.getRendition('web').url}" alt="${asset.title}" loading="eager">
          <figcaption>
            <h1>${asset.title}</h1>
            ${asset.description ? `<p class="description">${asset.description}</p>` : ''}
          </figcaption>
        </figure>
        <aside class="asset-info">
          <dl class="metadata">
            <dt>File Type</dt>
            <dd class="file-type">${asset.getProperty('file-type') || 'Unknown file type'}</dd>
            ${asset.sizeInBytes ? `<dt>File Size</dt><dd class="file-size">${formatFileSize(asset.sizeInBytes)}</dd>` : ''}
            <dt>File Path</dt>
            <dd class="file-path">${asset.path}</dd>
          </dl>
          ${services.collections.contains('cart', asset.uuid) ? 
            `<button data-asc-action="collection.remove@click" data-asc-asset="${asset.uuid}" data-asc-collection="cart">Remove from Cart</button>` 
            : 
            `<button data-asc-action="collection.add@click" data-asc-asset="${asset.uuid}" data-asc-collection="cart">Add to Cart</button>`
          }
        </aside>
      </section>
    `;
    
  } catch (error) {
    console.error('Failed to load asset:', error);
    block.innerHTML = `
      <div class="error">
        <h2>Asset not found</h2>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}
