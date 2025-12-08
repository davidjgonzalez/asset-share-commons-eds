import { readBlockConfig } from '../../scripts/asc/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {}, {
    placeholder: 'Search assets...',
    inputType: 'search',
    name: 'fulltext',
  });

  block.innerHTML = html(config);

  addEventListeners(block, config);
}

function html(config, values) {  
  return `
    <input type="${config.inputType}" placeholder="${config.placeholder}" 
        form="${config.form}"
        name="${config.field}" 
        value="${config.initial[`${config.group}_group.${config.name}`] || ''}"
        data-asc-filter="${config.id}">   
  `;
}

function addEventListeners(block, config) {
    // emit and event 'asc:search' with the value of the input
    block.querySelector('input').addEventListener('input', (e) => {
        document.dispatchEvent(new CustomEvent('asc:search', { detail: e.target.value }));
    });

    const button = block.querySelector('button');
    if (button) {
        button.addEventListener('click', (e) => {
            const input = block.querySelector('input');
            document.dispatchEvent(new CustomEvent('asc:search', { detail: input ? input.value : '' }));
        });
    }
}
