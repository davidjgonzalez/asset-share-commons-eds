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

export default async function decorate(block) {
  try {
    // Get asset from URL (UUID or path)
    const asset = await Asset.create(window.location.pathname.split('/').pop());
    
    // Update page title
    document.title = `${asset.getTitle()} - Asset Details`;
    
    // Render asset preview
    block.innerHTML = `
      <div class="asset-preview">
        <figure>
          <img src="${asset.getUrl()}" alt="${asset.getTitle()}" loading="eager">
        </figure>
        <div class="asset-info">
          <h1>${asset.getTitle()}</h1>
          ${asset.getDescription() ? `<p class="description">${asset.getDescription()}</p>` : ''}
          <div class="metadata">
            <span class="file-type">${asset.getProperty('fileType') || 'Unknown'}</span>
            ${asset.getSizeInBytes() ? `<span class="file-size">${formatFileSize(asset.getSizeInBytes())}</span>` : ''}
          </div>
        </div>
      </div>
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
