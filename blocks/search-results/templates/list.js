/**
 * List template for search results
 * Provides table-based layout for asset results
 */

export function container() {
  return `
        <table class="list">
        <thead>
            <tr>
            <th>Thumbnail</th>
            <th>Title</th>
            <th>Format</th>
            <th>Size</th>
            </tr>
        </thead>
        <tbody data-asc-results>
        </tbody>
        </table>
    `;
}

export function item(asset) {
  return `
    <tr tabindex="0" role="button" aria-label="View ${asset.getTitle()}" data-asc-uuid="${asset.getUuid()}">
      <td>
        <img src="${asset.getThumbnail()?.url || asset.getUrl()}" 
             alt="${asset.getTitle()}" 
             loading="lazy">
      </td>
      <td>${asset.getTitle()}</td>
      <td>${asset.getProperty("fileType") || "Unknown"}</td>
      <td>${asset.getProperty("fileSize") || "Unknown"}</td>
    </tr>
  `;
}

export function addEventListeners(block) {
  // Event listeners are handled by the main search-results.js file
}
