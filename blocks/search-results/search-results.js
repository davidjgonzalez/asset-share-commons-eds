import { loadScript } from '../../scripts/aem.js';
import { getBlockConfig } from '../../scripts/asc/utils/search.js';

export default async function decorate(block) {
  const config = getBlockConfig(block);
  config.display = 'cards';

  const { container } = await import(`./templates/${config.display}.js`);

  block.innerHTML = `
    <input type="text" name="p.limit" value="4" form="${config.form}"/>
    <input type="text" name="p.offset" value="0" form="${config.form}"/>
    <input type="text" name="display" value="${config.display}"/>
    <input type="text" name="more" value="true"/>
    <input type="text" name="success" value=""/>
    <input type="text" name="total" value="0"/>
  `;

  block.innerHTML += container();

  await addEventListeners(block);

  document.dispatchEvent(new CustomEvent('asc:search:start', {
    detail: {
      form: config.form,
      type: 'initial'
    }
  }));
}

async function addEventListeners(block) {
  /* Display the results */
  document.addEventListener('asc:search:complete', async (event) => {
    const { results, query, formData } = event.detail;

    block.querySelector('[name="p.offset"]').value = results?.total || 0;
    block.querySelector('[name="more"]').value = results.more;
    block.querySelector('[name="success"]').value = results.success;
    block.querySelector('[name="total"]').value = results.total;
    const display = block.querySelector('[name="display"]').value;

    const { item } = await import(`./templates/${display}.js`);

    if (event.detail.type === 'initial') {
      block.querySelector('[data-asc-results]').innerHTML = results.assets.map(item).join('');
      // Check after initial loads
      maybeLoadMore();
    } else {
      block.querySelector('[data-asc-results]').innerHTML += results.assets.map(item).join('');
    }
  });


  /* Infinite scroll */
  // Infinite scroll: load more when the last result is within 100px of the bottom of the viewport,
  // and keep loading until [name="more"] === 'false'.
  // This should work both on scroll and on load (if too few results to fill the screen).

  let isLoadingMore = false;

  function maybeLoadMore() {
    const moreInput = block.querySelector('[name="more"]');
    if (!moreInput || moreInput.value === 'false' || isLoadingMore) {
      return;
    }

    const resultsEl = block.querySelector('[data-asc-results]');
    if (!resultsEl || !resultsEl.lastElementChild) return;

    const lastResult = resultsEl.lastElementChild;
    const rect = lastResult.getBoundingClientRect();

    // If the last result is within 100px below the viewport bottom
    if (rect.top < window.innerHeight + 100) {
      isLoadingMore = true;
      document.dispatchEvent(new CustomEvent('asc:search', {
        detail: {
          type: 'more'
        }
      }));
    }
  }

  // Listen for scroll and resize (in case of viewport changes)
  document.addEventListener('scroll', maybeLoadMore, { passive: true });
  window.addEventListener('resize', maybeLoadMore);


  // Listen for new results to reset loading state and check if we need to load more
  document.addEventListener('asc:search:complete', () => {
    isLoadingMore = false;
    // Use setTimeout to ensure DOM is updated before checking
    setTimeout(maybeLoadMore, 0);
  });
}