import { loadCSS } from '../../../scripts/aem.js';

loadCSS('/blocks/search-results/templates/list.css');

/**
 * List template for search results
 * Provides table-based layout for asset results
 */

export function container() {
  return `
        <div class="list-container">
            <table class="list">
                <thead>
                    <tr>
                        <th class="sortable" data-sort="thumbnail">Thumbnail</th>
                        <th class="sortable" data-sort="title">Title</th>
                        <th class="sortable" data-sort="format">Format</th>
                        <th class="sortable" data-sort="size">Size</th>
                    </tr>
                </thead>
                <tbody data-asc-results>
                </tbody>
            </table>
        </div>
    `;
}

export function item(asset, index = 0) {
  const title = asset.getTitle();
  const fileType = asset.getProperty('fileType');
  const fileSize = asset.getProperty('fileSize');
  const assetId = asset.getProperty('id');
  
  // Format file size for display
  const formatFileSize = (size) => {
    if (!size) return 'Unknown';
    const bytes = parseInt(size);
    if (isNaN(bytes)) return size;
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let fileSize = bytes;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    
    return `${fileSize.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  return `
    <tr tabindex="0" 
        role="button" 
        aria-label="View ${title}"
        data-asc-uuid="${asset.getUuid()}"
        data-asset-id="${assetId || ''}"
        data-file-type="${fileType || ''}"
        data-file-size="${fileSize || ''}">
      <td data-label="Thumbnail">
        <div class="thumbnail-container">
          <img src="${asset.getThumbnail()?.url || asset.getUrl()}" 
               alt="${title}" 
               loading="${index < 10 ? 'eager' : 'lazy'}"
               onerror="this.classList.add('broken')">
        </div>
      </td>
      <td data-label="Title">
        <span class="title-text">${title}</span>
      </td>
      <td data-label="Format">
        <span class="file-type-badge">${fileType || 'Unknown'}</span>
      </td>
      <td data-label="Size">
        ${formatFileSize(fileSize)}
      </td>
    </tr>
  `;
}

export function addEventListeners(block) {
  const table = block.querySelector('.list');
  const rows = block.querySelectorAll('tbody tr');
  const sortableHeaders = block.querySelectorAll('th.sortable');
  
  // Handle row clicks
  rows.forEach(row => {
    row.addEventListener('click', (e) => {
      e.preventDefault();
      const assetId = row.dataset.assetId;
      const title = row.querySelector('.title-text')?.textContent;
      
      if (assetId) {
        // Remove previous selection
        rows.forEach(r => r.classList.remove('selected'));
        
        // Add selection to clicked row
        row.classList.add('selected');
        
        // Dispatch custom event for asset selection
        const event = new CustomEvent('assetSelected', {
          detail: {
            assetId,
            title,
            element: row
          },
          bubbles: true
        });
        block.dispatchEvent(event);
      }
    });

    // Handle keyboard events for accessibility
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        row.click();
      }
    });

    // Add hover effects for better UX
    row.addEventListener('mouseenter', () => {
      row.setAttribute('aria-pressed', 'true');
    });

    row.addEventListener('mouseleave', () => {
      row.setAttribute('aria-pressed', 'false');
    });

    // Handle focus for accessibility
    row.addEventListener('focus', () => {
      row.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    });
  });

  // Handle column sorting
  sortableHeaders.forEach(header => {
    header.addEventListener('click', (e) => {
      e.preventDefault();
      const sortKey = header.dataset.sort;
      const currentSort = header.classList.contains('asc') ? 'asc' : 
                         header.classList.contains('desc') ? 'desc' : null;
      
      // Remove sort classes from all headers
      sortableHeaders.forEach(h => {
        h.classList.remove('asc', 'desc');
      });
      
      // Determine new sort direction
      let newSort = 'asc';
      if (currentSort === 'asc') {
        newSort = 'desc';
      }
      
      // Add sort class to clicked header
      header.classList.add(newSort);
      
      // Dispatch custom event for sorting
      const event = new CustomEvent('sortRequested', {
        detail: {
          sortKey,
          direction: newSort,
          element: header
        },
        bubbles: true
      });
      block.dispatchEvent(event);
    });
  });

  // Handle table scrolling for better UX
  if (table) {
    let isScrolling = false;
    
    table.addEventListener('scroll', () => {
      if (!isScrolling) {
        isScrolling = true;
        requestAnimationFrame(() => {
          // Add visual feedback during scroll
          table.style.transition = 'box-shadow 0.2s ease';
          table.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          
          setTimeout(() => {
            table.style.boxShadow = '';
            isScrolling = false;
          }, 200);
        });
      }
    });
  }
}
