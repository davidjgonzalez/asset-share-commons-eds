import { readBlockConfig } from "../../scripts/asc/utils/search.js";
import assetTeaser from "../../scripts/asc/parts/asset-teaser/asset-teaser.js";

export default async function decorate(block) {

  const config = readBlockConfig(block, {}, {
    'asc.search-results.display': 'waterfall',
    'limit': 100,
  });

  block.innerHTML = html(config);

  await addEventListeners(block, config);
  await emitEvents(block, config);
}

function html(config) {
  return `
    <!-- Results display selector -->
    <select name="asc.search-results.display" form="${config.form}">
      <option value="cards" ${config.initial['display'] === "cards" ? "selected" : ""}>Cards</option>
      <option value="list" ${config.initial['display'] === "list" ? "selected" : ""}>List</option>
      <option value="masonry" ${config.initial['display'] === "masonry" ? "selected" : ""}>Masonry</option>
      <option value="waterfall" ${config.initial['display'] === "waterfall" ? "selected" : ""}>Waterfall</option>
    </select>

    <!-- Results order by selector -->
    <select name="orderby" form="${config.form}">
      <option value="@jcr:score" ${config.initial['orderby'] === "@jcr:score" ? "selected" : ""}>Relevance</option>
      <option value="@jcr:content/metadata/dc:created" ${config.initial['orderby'] === "@jcr:content/metadata/dc:created" ? "selected" : ""}>Created Date</option>
      <option value="@jcr:content/metadata/dc:title" ${config.initial['orderby'] === "@jcr:content/metadata/dc:title" ? "selected" : ""}>Title</option>
    </select>

    <!-- Results order by sort selector -->
    <select name="orderby.sort" form="${config.form}">
      <option value="desc" ${config.initial['orderby.sort'] === "desc" ? "selected" : ""}>Descending</option>
      <option value="asc" ${config.initial['orderby.sort'] === "asc" ? "selected" : ""}>Ascending</option>
    </select>

    <input type="hidden" name="p.limit" value="${config['limit'] || 24}" form="${config.form}"/>
    <input type="hidden" name="p.offset" value="0" form="${config.form}"/>
    <input type="hidden" name="asc.search-results.more" value="true"/>
    <input type="hidden" name="asc.search-results.total" value="0"/>

    <div data-asc-results>
      <!-- Inject point for results here based on asc.search-results.display -->
    </div>
  `;
}

async function addEventListeners(block, _config) {
  block.querySelectorAll('[name="asc.search-results.display"], [name="orderby"], [name="orderby.sort"]').forEach(input => {
    input.addEventListener("change", () => {
      document.dispatchEvent(new CustomEvent("asc:search:execute", {
        detail: {
          type: "page-load",
        },
      }));
    });
  });

  let isLoadingMore = false;

  /* Display the results */
  document.addEventListener("asc:search:complete", async (event) => {
    const { results } = event.detail;

    // Handle case where results is undefined or null
    if (!results) {
      console.warn('Search completed but no results data received');
      return;
    }
  
    block.querySelector('[name="asc.search-results.more"]').value = results.more;
    block.querySelector('[name="asc.search-results.total"]').value = results.total || 0;

    // Increment the offset
    const newOffset = Number.parseInt(block.querySelector('[name="p.offset"]').value) + (results.size || 0);
    block.querySelector('[name="p.offset"]').value = newOffset;


    console.log('results', results);

    /* Display the results based on the type of search; load-more appends to the existing results */
    if (event.detail.type === 'load-more') {
      // Response is the reload of a load-more search, which appends to the existing results
      block.querySelector("[data-asc-results]").innerHTML += results.assets?.map((asset) => assetTeaser(asset)).join("") || "";
    } else {
      // Response is the initial results of a new search, which replaces the existing results
      // This may be a page load, or changing filter, order, or display criteria
      if (results.size === 0) {
        block.querySelector("[data-asc-results]").innerHTML = `<h4>NO RESULTS!</h4>`
      } else {
        block.querySelector("[data-asc-results]").innerHTML = results.assets.map((asset) => assetTeaser(asset)).join("") || "";
      }
    }

    isLoadingMore = false;
    // Use setTimeout to ensure DOM is updated before checking
    setTimeout(maybeLoadMore, 1);
  });

  /* Infinite scroll */
  // Infinite scroll: load more when the last result is within 100px of the bottom of the viewport,
  // and keep loading until [name="more"] === 'false'.
  // This should work both on scroll and on load (if too few results to fill the screen).


  function maybeLoadMore() {
    const moreInput = block.querySelector('[name="asc.search-results.more"]');
    if (!moreInput || moreInput.value === "false" || isLoadingMore) {
      return;
    }

    const resultsEl = block.querySelector("[data-asc-results]");
    if (!resultsEl || !resultsEl.lastElementChild) return;

    const lastResult = resultsEl.lastElementChild;
    const rect = lastResult.getBoundingClientRect();

    // If the last result is within 100px below the viewport bottom
    if (rect.top < window.innerHeight + 1080) {
      isLoadingMore = true;
      document.dispatchEvent(
        new CustomEvent("asc:search:execute", {
          detail: {
            type: "load-more",
          },
        })
      );
    }
  }

  // Listen for scroll and resize (in case of viewport changes)
  document.addEventListener("scroll", maybeLoadMore, { passive: true });
  window.addEventListener("resize", maybeLoadMore);
}

async function emitEvents(block, config) {
  document.dispatchEvent(
    new CustomEvent("asc:search:execute", {
      detail: {
        form: config.form,
        type: "page-load",
      },
    })
  );
}
