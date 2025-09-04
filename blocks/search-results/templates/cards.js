import { loadCSS } from '../../../scripts/aem.js';

loadCSS('/blocks/search-results/templates/cards.css');

export function container() {
    return `<ul class="cards" data-asc-results></ul>`;
}

export function item(asset, index = 0) {
    const title = asset.getTitle();
    const fileType = asset.getProperty('fileType');
    const fileSize = asset.getProperty('fileSize');
    const dimensions = asset.getProperty('dimensions');
    
    // Format file size for display
    const formatFileSize = (size) => {
        if (!size) return '';
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
       <li tabindex="0" 
           role="button" 
           aria-label="View ${title}"
           data-asset-id="${asset.getProperty('id') || ''}"
           data-file-type="${fileType || ''}">
          <div class="card-image">
            ${asset.getPictureHtml({
              breakpoints: [
                { renditionWidth: 319, width: 0 },
                { renditionWidth: 560, width: 768 },
                { renditionWidth: 840, width: 1024 },
              ],
              sizes: "(max-width: 768px) 250px, (max-width: 1024px) 280px, 280px",
              loading: index < 3 ? "eager" : "lazy",
              alt: title
            })}
          </div>
          <div class="card-content">
            <h3>${title}</h3>
            <div class="card-meta">
              <span class="file-type">${fileType || 'Unknown'}</span>
              ${fileSize ? `<span class="file-size">${formatFileSize(fileSize)}</span>` : ''}
            </div>
          </div>
        </li>`;
}

export function addEventListeners(block) {
    const cards = block.querySelectorAll('.cards > li');
    
    cards.forEach(card => {
        // Handle click events
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const assetId = card.dataset.assetId;
            const title = card.querySelector('h3')?.textContent;
            
            if (assetId) {
                // Dispatch custom event for asset selection
                const event = new CustomEvent('assetSelected', {
                    detail: {
                        assetId,
                        title,
                        element: card
                    },
                    bubbles: true
                });
                block.dispatchEvent(event);
            }
        });

        // Handle keyboard events for accessibility
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });

        // Add hover effects for better UX
        card.addEventListener('mouseenter', () => {
            card.setAttribute('aria-pressed', 'true');
        });

        card.addEventListener('mouseleave', () => {
            card.setAttribute('aria-pressed', 'false');
        });

        // Handle focus for accessibility
        card.addEventListener('focus', () => {
            card.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            });
        });
    });
}