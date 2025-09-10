import { getBlockConfig } from "../../scripts/asc/utils/search.js";

export default async function decorate(block) {
  const config = getBlockConfig(block, {}, {
    'asc.search-results.display': 'cards',
    'limit': 100,
  });

  block.innerHTML = `
    <!-- Results display selector -->
    <select name="asc.search-results.display" form="${config.form}">
      <option value="cards" ${config.initial['asc.search-results.display'] === "cards" ? "selected" : ""}>Cards</option>
      <option value="list" ${config.initial['asc.search-results.display'] === "list" ? "selected" : ""}>List</option>
      <option value="masonry" ${config.initial['asc.search-results.display'] === "masonry" ? "selected" : ""}>Masonry</option>
    </select>


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
    
    <input type="text" name="p.limit" value="${config['limit'] || 24}" form="${config.form}"/>
    <input type="text" name="p.offset" value="0" form="${config.form}"/>
    <input type="text" name="asc.search-results.more" value="true"/>
    <input type="text" name="asc.search-results.total" value="0"/>

    <div data-asc-results-wrapper>
      <!-- Inject point for results here based on asc.search-results.display -->
    </div>
  `;

  await addEventListeners(block);

  document.dispatchEvent(
    new CustomEvent("asc:search", {
      detail: {
        form: config.form,
        type: "page-load",
      },
    })
  );
}

async function addEventListeners(block) {
  block.querySelectorAll('[name="asc.search-results.display"], [name="orderby"], [name="orderby.sort"]').forEach(input => {
    input.addEventListener("change", () => {
      document.dispatchEvent(new CustomEvent("asc:search"), {
        detail: {
          type: "page-load",
        },
      });
    });
  });


  let isLoadingMore = false;

  /* Display the results */
  document.addEventListener("asc:search:complete", async (event) => {
    const { results, query, formData } = event.detail;

  
    /* Load the results renderer */
    let display = (results && results.size > 0)
      ? block.querySelector('[name="asc.search-results.display"]').value
      : 'no-results';
    const { default: container, item } = await import(`./templates/${display}/${display}.js`);

    block.querySelector('[name="asc.search-results.more"]').value = results.more;
    block.querySelector('[name="asc.search-results.total"]').value = results.total;

    // Increment the offset
    const newOffset = Number.parseInt(block.querySelector('[name="p.offset"]').value) + (results.size || 0);
    block.querySelector('[name="p.offset"]').value = newOffset;

    /* Display the results based on the type of search; load-more appends to the existing results */
    if (event.detail.type === 'load-more') {
      // Response is the reload of a load-more search, which appends to the existing results
      // Append the new results to the existing results
      block.querySelector("[data-asc-results]").innerHTML += results.assets.map(item).join("");
    } else {
      // Response is the initial results of a new search, which replaces the existing results
      // This may be a page load, or changing filter, order, or display criteria
      if (results.size === 0) {
        block.querySelector("[data-asc-results-wrapper]").innerHTML = `<div>NO RESULTS</div>`
      } else {
        block.querySelector("[data-asc-results-wrapper]").innerHTML = container();
        block.querySelector("[data-asc-results]").innerHTML = results.assets?.map(item).join("") || "";
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
        new CustomEvent("asc:search", {
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
