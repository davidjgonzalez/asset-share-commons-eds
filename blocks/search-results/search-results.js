import { readBlockConfig } from '../../scripts/asc/utils/search.js';
import assetTeaser from '../../scripts/asc/parts/asset-teaser/asset-teaser.js';
import services from '../../scripts/asc/services/services.js';

function getDisplayMode(block) {
  return block.querySelector('[name="asc.search-results.display"]')?.value || 'waterfall';
}

function teaserMode(display) {
  return display === 'list' ? 'list' : 'card';
}

function attachImageErrorHandlers(resultsEl) {
  resultsEl.querySelectorAll('.asc-asset-teaser__preview img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) {
      img.closest('.asc-asset-teaser')?.classList.add('asc-asset-teaser--no-preview');
      return;
    }
    img.addEventListener('error', () => {
      img.closest('.asc-asset-teaser')?.classList.add('asc-asset-teaser--no-preview');
    }, { once: true });
  });
}

export default async function decorate(block) {
  const config = readBlockConfig(block, {}, {
    'asc.search-results.display': 'waterfall',
    limit: 100,
  });

  block.innerHTML = html(config);

  block.querySelector('[data-asc-results]').dataset.display = config['asc.search-results.display'] || 'waterfall';

  await addEventListeners(block, config);
  await emitEvents(block, config);
}

function html(config) {
  return `
    <!-- Results display selector -->
    <select name="asc.search-results.display" form="${config.form}">
      <option value="cards" ${config.initial.display === 'cards' ? 'selected' : ''}>Cards</option>
      <option value="list" ${config.initial.display === 'list' ? 'selected' : ''}>List</option>
      <option value="masonry" ${config.initial.display === 'masonry' ? 'selected' : ''}>Masonry</option>
      <option value="waterfall" ${config.initial.display === 'waterfall' ? 'selected' : ''}>Waterfall</option>
    </select>

    <!-- Results order by selector -->
    <select name="orderby" form="${config.form}">
      <option value="@jcr:score" ${config.initial.orderby === '@jcr:score' ? 'selected' : ''}>Relevance</option>
      <option value="@jcr:content/metadata/dc:created" ${config.initial.orderby === '@jcr:content/metadata/dc:created' ? 'selected' : ''}>Created Date</option>
      <option value="@jcr:content/metadata/dc:title" ${config.initial.orderby === '@jcr:content/metadata/dc:title' ? 'selected' : ''}>Title</option>
    </select>

    <!-- Results order by sort selector -->
    <select name="orderby.sort" form="${config.form}">
      <option value="desc" ${config.initial['orderby.sort'] === 'desc' ? 'selected' : ''}>Descending</option>
      <option value="asc" ${config.initial['orderby.sort'] === 'asc' ? 'selected' : ''}>Ascending</option>
    </select>

    <input type="hidden" name="p.limit" value="${config.limit || 24}" form="${config.form}"/>
    <input type="hidden" name="p.offset" value="0" form="${config.form}"/>
    <input type="hidden" name="asc.search-results.more" value="true"/>
    <input type="hidden" name="asc.search-results.total" value="0"/>

    <div data-asc-results>
      <!-- Inject point for results here based on asc.search-results.display -->
    </div>
  `;
}

async function addEventListeners(block, _config) {
  block.querySelectorAll('[name="asc.search-results.display"], [name="orderby"], [name="orderby.sort"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.name === 'asc.search-results.display') {
        block.querySelector('[data-asc-results]').dataset.display = input.value;
      }
      document.dispatchEvent(new CustomEvent('asc:search:execute', {
        detail: { type: 'page-load' },
      }));
    });
  });

  let isLoadingMore = false;

  /* Display the results */
  document.addEventListener('asc:search:complete', async (event) => {
    const { results } = event.detail;

    if (!results) {
      console.warn('Search completed but no results data received');
      return;
    }

    block.querySelector('[name="asc.search-results.more"]').value = results.more;
    block.querySelector('[name="asc.search-results.total"]').value = results.total || 0;

    const newOffset = Number.parseInt(block.querySelector('[name="p.offset"]').value, 10) + (results.size || 0);
    block.querySelector('[name="p.offset"]').value = newOffset;

    const display = getDisplayMode(block);
    const mode = teaserMode(display);
    const resultsEl = block.querySelector('[data-asc-results]');
    resultsEl.dataset.display = display;

    if (event.detail.type === 'load-more') {
      resultsEl.innerHTML += results.assets?.map((asset) => assetTeaser(asset, { mode })).join('') || '';
    } else {
      if (results.size === 0) {
        resultsEl.innerHTML = '<h4>No results found.</h4>';
      } else {
        resultsEl.innerHTML = results.assets.map((asset) => assetTeaser(asset, { mode })).join('') || '';
      }
    }

    attachImageErrorHandlers(resultsEl);
    isLoadingMore = false;
    setTimeout(maybeLoadMore, 1);
  });

  /* Drag-and-drop */
  block.addEventListener('dragstart', (event) => {
    const article = event.target.closest('[data-asc-asset]');
    if (!article) return;

    const assetId = article.dataset.ascAsset;
    const asset = window.asc?.cache?.assets?.get(assetId);
    if (!asset) return;

    const mimeType = article.dataset.ascMimeType || asset.mimeType || 'application/octet-stream';

    const rendition = services.renditions.getRendition(asset, 'original')
      || services.renditions.getRendition(asset, 'web');

    if (!rendition?.url) return;

    const filename = asset.filename || `${asset.title || 'asset'}`;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('DownloadURL', `${mimeType}:${filename}:${rendition.url}`);
    event.dataTransfer.setData('text/uri-list', rendition.url);
    event.dataTransfer.setData('text/plain', rendition.url);
  });

  /* Infinite scroll */
  function maybeLoadMore() {
    const moreInput = block.querySelector('[name="asc.search-results.more"]');
    if (!moreInput || moreInput.value === 'false' || isLoadingMore) {
      return;
    }

    const resultsEl = block.querySelector('[data-asc-results]');
    if (!resultsEl || !resultsEl.lastElementChild) return;

    const lastResult = resultsEl.lastElementChild;
    const rect = lastResult.getBoundingClientRect();

    if (rect.top < window.innerHeight + 1080) {
      isLoadingMore = true;
      document.dispatchEvent(
        new CustomEvent('asc:search:execute', {
          detail: { type: 'load-more' },
        }),
      );
    }
  }

  document.addEventListener('scroll', maybeLoadMore, { passive: true });
  window.addEventListener('resize', maybeLoadMore);
}

async function emitEvents(block, config) {
  document.dispatchEvent(
    new CustomEvent('asc:search:execute', {
      detail: {
        form: config.form,
        type: 'page-load',
      },
    }),
  );
}
