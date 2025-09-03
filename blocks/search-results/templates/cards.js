import { loadCSS } from '../../../scripts/aem.js';

loadCSS('/blocks/search-results/templates/cards.css');

export function container() {
    return `<ul class="cards" data-asc-results></ul>`;
}

export function item(asset, index = 0) {
    return `
       <li tabindex="0" role="button" aria-label="View ${asset.getTitle()}">
          ${asset.getPictureHtml({
            breakpoints: [
              { renditionWidth: 250, width: 0 },
            ],
            sizes: "250px",
            loading: index < 3 ? "eager" : "lazy"
          })}
          <div>
            <h3>${asset.getTitle()}</h3>
            <span>${asset.getProperty('fileType')}</span>
          </div>
        </li>`;
}

export function addEventListeners(block) {

}