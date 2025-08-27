import services from '../../scripts/asc/services/services.js';

export default function decorate(block) {
  const config = extractConfig(block);

  //block.innerHTML = html(config);

  addEventListeners(block, config);

  // Trigger a search from query params
  document.dispatchEvent(new CustomEvent('asc:search', { detail: { source: 'query-params', value: window.location.search } }));
}

function extractConfig(block) {
  const config = {
    display: 'cards'
  };

  block.querySelectorAll(':scope > div').forEach(row => {
    const cells = row.querySelectorAll('div');
    if (cells.length === 2) {
      const key = cells[0].textContent.trim().toLowerCase();
      const value = cells[1].textContent.trim();
      
      const keyMap = {
        'display': (v) => { config.display = v; },
      };
      if (keyMap[key]) {
        keyMap[key](value);
      }
    }
  });

  return config;
}

function html(config, results) { 
  const filters = `
  <input type="hidden" name="${config.group}_group.path" value="/content/dam/asset-share-commons" form="${config.form}"/>
  `; 

  switch (config.display) {
    case 'cards':
      return htmlCards(results) + filters
    case 'list':
      return htmlList(results) + filters
    case 'masonry':
      return htmlMasonry(results) + filters
    default:
      return noResults() + filters;
  }
}

function htmlCards(results) {
  return `
    <ul class="cards">
      ${results.assets.map(asset => `
        <li tabindex="0" role="button" aria-label="View ${asset.getTitle()}">
          <figure>
            <img src="${asset.getThumbnail()?.url}" alt="${asset.getTitle()}" loading="lazy">
          </figure>
          <div>
            <h3>${asset.getTitle()}</h3>
            <span>${asset.getProperty('fileType')}</span>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

function htmlList(results) {
  return `
    <table class="list">
      <thead>
        <tr>
          <th>Thumbnail</th>
          <th>Title</th>
          <th>Format</th>
        </tr>
      </thead>
      <tbody>
      ${results.assets.map(asset => `
        <tr>
          <td><img src="${asset.getUrl()}" alt="${asset.getTitle()}" loading="lazy"></td>
          <td>${asset.getTitle()}</td>
          <td>${asset.getProperty('fileType')}</td>
        </tr>
      `).join('')}
      </tbody>
    </table>
  `;
}

function htmlMasonry(results) {
  return `
    <ul class="masonry">
      ${results.assets.map(asset => `
        <li tabindex="0" data-asc-uuid="${asset.getUuid()}">
          ${asset.getPictureHtml()}
          <div>
            <h3>${asset.getTitle()}</h3>
            <span>${asset.getProperty('fileType')}</span>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

function noResults() {
  return `
    <div class="no-results">
      <p>No results found</p>
    </div>
  `;
}

function addEventListeners(block, config) {
    // Listen for search start to show loading state
    document.addEventListener('asc:search:start', () => {
        block.classList.add('loading');
        block.innerHTML = '<div class="loading-placeholder"></div>';
    });

    // Listen for search complete to show results
    document.addEventListener('asc:search:complete', (e) => {
        block.classList.remove('loading');
        const results = e.detail.results;
        block.innerHTML = html(config, results);
        
        // Add click handlers to result items
        addResultItemHandlers(block);
    });

    // Listen for search error
    document.addEventListener('asc:search:error', (e) => {
        block.classList.remove('loading');
        block.innerHTML = `
            <div class="no-results">
                <p>Search failed. Please try again.</p>
            </div>
        `;
    });
}

function addResultItemHandlers(block) {
    const items = block.querySelectorAll('li');
    items.forEach(item => {
        item.addEventListener('click', handleItemClick);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleItemClick(e);
            }
        });
    });
}

function handleItemClick(e) {
    const item = e.currentTarget;
    const img = item.querySelector('img');
    const title = item.querySelector('h3')?.textContent;
    const uuid = item.getAttribute('data-asc-uuid');

    if (img && img.src) {
        // Dispatch custom event for item selection
        document.dispatchEvent(new CustomEvent('asc:asset:selected', {
            detail: {
                src: img.src,
                alt: img.alt,
                title: title,
                element: item
            }
        }));

        // Navigate to details page with asset path as URL parameter
        const assetPath = extractAssetPath(img.src);
        const detailsUrl = `/details/asset/${uuid}`;
        
        // Navigate to the details page
        window.location.href = detailsUrl;
    }
}
function extractAssetPath(assetUrl) {
    // Extract the asset path from the full URL
    // e.g., "https://author.aem.com/content/dam/path/to/asset.jpg" -> "/content/dam/path/to/asset.jpg"
    try {
        const url = new URL(assetUrl);
        return url.pathname;
    } catch (error) {
        // Fallback: assume it's already a path
        return assetUrl.startsWith('/') ? assetUrl : '/' + assetUrl;
    }
}
