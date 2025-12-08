import { loadCSS } from '../../../../scripts/aem.js';

loadCSS('/blocks/search-results/templates/waterfall/waterfall.css');

export default function waterfall(results = {}) {
    return `<div class="waterfall" data-asc-results></div>`;
}

export function item(asset, index = 0) {
    const title = asset.title;
    const fileType = asset.getProperty('file-type');
    const fileSize = asset.getProperty('file-size');
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
        <div class="waterfall-item" 
             tabindex="0" 
             role="button" 
             aria-label="View ${title}"
             data-asc-asset-details="${asset.uuid}"
             data-asc-preload-fragment="/details/default/${asset.id}"
             data-asc-asset-id="${asset.uuid}"
             data-file-type="${fileType || ''}"
             data-index="${index}">
            <div class="waterfall-image">
                ${asset.getPictureHtml({
                    breakpoints: [
                        { renditionWidth: 400, width: 0 },
                        { renditionWidth: 600, width: 1024 },
                        { renditionWidth: 800, width: 1200 },
                    ],
                    sizes: "(max-width: 768px) 200px, (max-width: 1024px) 300px, (max-width: 1200px) 350px, 400px",
                    loading: index < 6 ? "eager" : "lazy",
                    alt: title
                })}
            </div>
            <div class="waterfall-overlay">
                <div class="waterfall-content">
                    <h3>${title}</h3>
                    <div class="waterfall-meta">
                        <span class="file-type">${fileType || 'Unknown'}</span>
                        ${fileSize ? `<span class="file-size">${formatFileSize(fileSize)}</span>` : ''}
                        ${dimensions ? `<span class="dimensions">${dimensions.width} × ${dimensions.height}</span>` : ''}
                    </div>
                </div>
                <div class="waterfall-actions">
                    <button class="waterfall-action" aria-label="Download ${title}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7,10 12,15 17,10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                    <button class="waterfall-action" aria-label="Like ${title}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>`;
}

export function addEventListeners(block) {
    const waterfallContainer = block.querySelector('.waterfall');
    const waterfallItems = block.querySelectorAll('.waterfall-item');
    
    // Initialize waterfall layout
    initializeWaterfall(waterfallContainer);
    
    waterfallItems.forEach(item => {
        // Handle click events
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const assetId = item.dataset.assetId;
            const title = item.querySelector('h3')?.textContent;
            
            if (assetId) {
                // Remove previous selection
                waterfallItems.forEach(i => i.classList.remove('selected'));
                
                // Add selection to clicked item
                item.classList.add('selected');
                
                // Dispatch custom event for asset selection
                const event = new CustomEvent('assetSelected', {
                    detail: {
                        assetId,
                        title,
                        element: item
                    },
                    bubbles: true
                });
                block.dispatchEvent(event);
            }
        });

        // Handle keyboard events for accessibility
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.click();
            }
        });

        // Add hover effects for better UX
        item.addEventListener('mouseenter', () => {
            item.setAttribute('aria-pressed', 'true');
        });

        item.addEventListener('mouseleave', () => {
            item.setAttribute('aria-pressed', 'false');
        });

        // Handle focus for accessibility
        item.addEventListener('focus', () => {
            item.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            });
        });

        // Add intersection observer for lazy loading animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '0';
                    entry.target.style.transform = 'translateY(30px)';
                    entry.target.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
                    
                    // Trigger animation after a small delay
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, 100);
                    
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '100px'
        });

        observer.observe(item);
    });

    // Handle waterfall layout adjustments on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            initializeWaterfall(waterfallContainer);
        }, 250);
    });

    // Add waterfall-specific keyboard navigation
    block.addEventListener('keydown', (e) => {
        const focusedItem = block.querySelector('.waterfall-item:focus');
        if (!focusedItem) return;

        const items = Array.from(waterfallItems);
        const currentIndex = items.indexOf(focusedItem);

        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                const nextItem = items[currentIndex + 1];
                if (nextItem) nextItem.focus();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                const prevItem = items[currentIndex - 1];
                if (prevItem) prevItem.focus();
                break;
            case 'ArrowDown':
                e.preventDefault();
                // Find item in next row (approximate)
                const itemsPerRow = Math.floor(waterfallContainer.offsetWidth / 300);
                const nextRowItem = items[currentIndex + itemsPerRow];
                if (nextRowItem) nextRowItem.focus();
                break;
            case 'ArrowUp':
                e.preventDefault();
                // Find item in previous row (approximate)
                const prevRowItem = items[currentIndex - itemsPerRow];
                if (prevRowItem) prevRowItem.focus();
                break;
        }
    });
}

function initializeWaterfall(container) {
    if (!container) return;
    
    const items = container.querySelectorAll('.waterfall-item');
    if (items.length === 0) return;

    // Clear any existing positioning
    items.forEach(item => {
        item.style.position = '';
        item.style.top = '';
        item.style.left = '';
        item.style.width = '';
    });

    // Get container width and calculate column count
    const containerWidth = container.offsetWidth;
    const gap = 16; // 16px gap between items
    const minItemWidth = 280;
    const maxColumns = Math.floor((containerWidth + gap) / (minItemWidth + gap));
    const columns = Math.max(1, Math.min(maxColumns, 6)); // Max 6 columns
    
    // Calculate item width
    const itemWidth = Math.floor((containerWidth - (gap * (columns - 1))) / columns);
    
    // Initialize column heights
    const columnHeights = new Array(columns).fill(0);
    
    // Position items
    items.forEach((item, index) => {
        // Find the shortest column
        const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));
        
        // Calculate position
        const x = shortestColumn * (itemWidth + gap);
        const y = columnHeights[shortestColumn];
        
        // Set item position and size
        item.style.position = 'absolute';
        item.style.left = `${x}px`;
        item.style.top = `${y}px`;
        item.style.width = `${itemWidth}px`;
        
        // Update column height
        const itemHeight = item.offsetHeight || 300; // Fallback height
        columnHeights[shortestColumn] += itemHeight + gap;
    });
    
    // Set container height
    const maxHeight = Math.max(...columnHeights);
    container.style.height = `${maxHeight}px`;
}

// Export the initialization function for external use
export { initializeWaterfall };
