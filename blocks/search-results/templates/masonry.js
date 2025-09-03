
export function masonry(assets) {
  return `
    <ul class="masonry" data-asc-results>${assets.map(asset => item(asset)).join('')}</ul>
  `;
}

export function item(asset, index = 0) {
  return `
    <li tabindex="0" role="button" aria-label="View ${asset.getTitle()}" data-asc-uuid="${asset.getUuid()}">
      ${asset.getPictureHtml ? asset.getPictureHtml({
        breakpoints: [
          { renditionWidth: 400, width: 0 },
        ],
        sizes: "250px",
        loading: index < 3 ? "eager" : "lazy"
      }) : `
        <figure>
          <img src="${asset.getThumbnail()?.url || asset.getUrl()}" 
               alt="${asset.getTitle()}" 
               loading="${index < 3 ? 'eager' : 'lazy'}">
        </figure>
      `}
      <div>
        <h3>${asset.getTitle()}</h3>
        <span>${asset.getProperty('fileType') || 'Unknown'}</span>
      </div>
    </li>
  `;
}

export function addEventListeners(block) {
  // Event listeners are handled by the main search-results.js file
}

