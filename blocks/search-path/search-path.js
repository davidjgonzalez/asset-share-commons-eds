/**
 * AEM QueryBuilder documentation - Path 
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates#path
 **/

import { readBlockConfig, getOptions } from '../../scripts/asc/utils/search.js';
import { htmlCheckboxes, htmlRadio, htmlDropdown } from '../search-property/search-property.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
        options: (content) => getOptions({content: String(content)}),
  }, {
    name: 'path',
    operation: 'equals',
    exact: false,
    flat: false,
    self: true,
    options: []
  });


  block.innerHTML = html(config);

  addEventListeners(block, config);

  //services.debug.formFields(block);
}

function html(config) {  
  return `
    <!-- Overrides the default exact behavior (default is OR) -->
    ${config.exact ? 
    `<input type="hidden"
           for="${config.fieldset}"
           name="${config.parameter('exact')}"
           value="${config.exact}"
           form="${config.form}"/>` : ''}

    <!-- Overrides the default flat behavior (default is false) -->
    ${config.flat ? 
    `<input type="hidden"
           for="${config.fieldset}"
           name="${config.parameter('flat')}"
           value="${config.flat}"
           form="${config.form}"/>` : ''}

    <!-- Overrides the default self behavior (default is false) -->
    ${config.self ? 
    `<input type="hidden"
           for="${config.fieldset}"
           name="${config.parameter('self')}"
           value="${config.self}"
           form="${config.form}"/>` : ''}

    <!-- Renders the title -->
    ${config.title ? `<label>${config.title}</label>` : ''}

      ${!config.type || config.type.includes('checkbox') ? htmlCheckboxes(config, config.initial) : ''}
      ${config.type.includes('radio')  ? htmlRadio(config, config.initial) : ''}
      ${config.type.includes('dropdown') || config.type.includes('select') ? htmlDropdown(config, config.initial) : ''}
`
}

/**
 * Add event listeners to the block
 * 
 * @param {*} block the block element
 * @param {*} config the block configuration
 */
function addEventListeners(block, config) {
    // Add event listeners for all interactive elements
    const inputs = block.querySelectorAll('input[type="checkbox"], input[type="radio"], select');
    
    inputs.forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.addEventListener('change', (e) => {
                document.dispatchEvent(new CustomEvent('asc:search', { 
                    detail: { 
                        value: e.target.checked ? e.target.value : '',
                        formId: config.form,
                        source: 'metadata-filter'
                    }
                }));
            });
        } else if (input.tagName === 'SELECT') {
            input.addEventListener('change', (e) => {
                document.dispatchEvent(new CustomEvent('asc:search', { 
                    detail: { 
                        value: e.target.value,
                        formId: config.form,
                        source: 'metadata-filter'
                    }
                }));
            });
        }
    });
}
