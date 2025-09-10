
import { loadCSS } from '../../../../scripts/aem.js';

loadCSS('/blocks/search-results/templates/no-results/no-results.css');

export default function noResults(results = {}) {
  return `<ul class="no-results"></ul>`;
}

