import { getBlockConfig } from '../../scripts/asc/utils/search.js';

export default function decorate(block) {
  const config = getBlockConfig(block, {}, {
    placeholder: 'Search assets...',
    buttonLabel: 'Search',
    hideButton: false,
    inputType: 'search',
    name: 'fulltext',
  });

console.log('iv', config.initial);
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

    <i class="search icon"></i>
    ${!config.hideButton ? `<button type="submit" 
      form="${config.form}">${config.buttonLabel}</button>` : ''}
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
