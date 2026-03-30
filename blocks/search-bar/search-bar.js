import { readBlockConfig } from '../../scripts/asc/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {}, {
    placeholder: 'Search assets...',
    inputType: 'search',
    name: 'fulltext',
  });

  block.innerHTML = html(config);

  addEventListeners(block);
}

function html(config) {
  return `
    <input type="${config.inputType}" placeholder="${config.placeholder}"
        form="${config.form}"
        name="${config.field}"
        value="${config.initial[`${config.group}_group.${config.name}`] || ''}"
        data-asc-filter="${config.id}">
  `;
}

function addEventListeners(block) {
  block.querySelector('input').addEventListener('input', () => {
    document.dispatchEvent(new CustomEvent('asc:search:execute'));
  });

  const button = block.querySelector('button');
  if (button) {
    button.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('asc:search:execute'));
    });
  }
}
