
import { loadCSS } from '../../../../scripts/aem.js';

loadCSS('/blocks/search-results/templates/masonry/masonry.css');

export default function masonry(results = {}) {
  return `<ul class="masonry" data-asc-results></ul>`;
}

export function item(asset, index = 0) {
  const title = asset.title;
  const fileType = asset.getProperty('fileType');
  const fileSize = asset.getProperty('fileSize');
  const assetId = asset.getProperty('id');
  
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
        data-asc-uuid="${asset.uuid}"
        data-asset-id="${assetId || ''}"
        data-file-type="${fileType || ''}">
      <div class="masonry-image">
        ${asset.getPictureHtml ? asset.getPictureHtml({
          breakpoints: [
            { renditionWidth: 280, width: 0 },
            { renditionWidth: 560, width: 768 },
            { renditionWidth: 840, width: 1024 },
          ],
          sizes: "(max-width: 768px) 200px, (max-width: 1024px) 280px, 280px",
          loading: index < 3 ? "eager" : "lazy",
          alt: title
        }) : `
          <figure>
            <img src="${asset.thumbnail || asset.url}" 
                 alt="${title}" 
                 loading="${index < 3 ? 'eager' : 'lazy'}"
                 onerror="this.classList.add('broken')">
          </figure>
        `}
      </div>
      <div class="masonry-content">
        <h3>${title}</h3>
        <div class="masonry-meta">
          <span class="file-type">${fileType || 'Unknown'}</span>
          ${fileSize ? `<span class="file-size">${formatFileSize(fileSize)}</span>` : ''}
        </div>
      </div>
    </li>
  `;
}

export function addEventListeners(block) {
  const masonryItems = block.querySelectorAll('.masonry > li');
  
  masonryItems.forEach(item => {
    // Handle click events
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const assetId = item.dataset.assetId;
      const title = item.querySelector('h3')?.textContent;
      
      if (assetId) {
        // Remove previous selection
        masonryItems.forEach(i => i.classList.remove('selected'));
        
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
          entry.target.style.transform = 'translateY(20px)';
          entry.target.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
          
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
      rootMargin: '50px'
    });

    observer.observe(item);
  });

  // Handle masonry layout adjustments on window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Trigger a re-layout if needed
      const event = new CustomEvent('masonryResize', {
        detail: { block },
        bubbles: true
      });
      block.dispatchEvent(event);
    }, 250);
  });

  // Add masonry-specific keyboard navigation
  block.addEventListener('keydown', (e) => {
    const focusedItem = block.querySelector('.masonry > li:focus');
    if (!focusedItem) return;

    const items = Array.from(masonryItems);
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
        const itemsPerRow = Math.floor(block.offsetWidth / 280);
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

