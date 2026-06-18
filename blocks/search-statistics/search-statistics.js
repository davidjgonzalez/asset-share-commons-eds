/** @owner user */
/**
 * search-statistics — displays search result counts.
 *
 * Listens for `asc:search:complete` and updates a live-region with result stats.
 * No form inputs — purely read-only display.
 *
 * Displays:
 *   "Showing 24 of 456 assets"  — when more results remain to be loaded
 *   "456 assets"                — when all results are shown
 *   "No results"                — when the search returned nothing
 *
 * No authoring config required. Place this block anywhere on the search page.
 */
export default function decorate(block) {
  block.innerHTML = `<p class="search-statistics__count asc-ui-copy" role="status" aria-live="polite"></p>`;

  const countEl = block.querySelector('.search-statistics__count');
  let shown = 0;

  document.addEventListener('asc:search:complete', (event) => {
    const { results, type } = event.detail || {};
    if (!results) return;

    // load-more appends to existing results; all other types replace them
    shown = type === 'load-more' ? shown + results.size : results.size;

    const total = results.total || 0;

    if (total === 0) {
      countEl.textContent = 'No results';
    } else if (total > shown) {
      countEl.textContent = `Showing ${shown} of ${total} asset${total !== 1 ? 's' : ''}`;
    } else {
      countEl.textContent = `${total} asset${total !== 1 ? 's' : ''}`;
    }
  });
}
