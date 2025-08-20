import asc from '../../../scripts/asc.js';


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
    <div class="cards">
      ${results.hits.map(result => `<div class="item">${result['jcr:content']['metadata']['dc:title']}</div>`).join('')}
    </div>
  `;
}

function htmlList(results) {
  return `
    <div class="list">
      ${results.hits.map(result => `<div class="item">${result['jcr:content']['metadata']['dc:title']}</div>`).join('')}
    </div>
  `;
}

function htmlMasonry(results) {
  return `
    <div class="masonry">
      ${results.hits.map(result => `
        <div class="item">
          <img src="${asc.aem.host}${result['jcr:path']}" alt="${result['jcr:content']['metadata']['dc:title']}">
          <div class="title">${result['jcr:content']['metadata']['dc:title'] || result['jcr:content']['cq:name']}</div>
          <div class="type">${result['jcr:content']['metadata']['dc:format']}</div>
        </div>
      `).join('')}
    </div>
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
    // emit and event 'asc:search' with the value of the input
    document.addEventListener('asc:search:complete', (e) => {
        const results = e.detail.results;
        block.innerHTML = html(config, results);
    });

}
