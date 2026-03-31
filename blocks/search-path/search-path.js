/**
 * search-path — DAM folder path filter.
 *
 * Provider compatibility:
 *   QueryBuilder → path predicate (path, path.exact, path.flat, path.self)
 *   OpenAPI      → filter[assetAncestorPath] (first selected value; exact/flat/self flags ignored)
 *
 * AEM QueryBuilder documentation - Path:
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates#path
 **/

import { readBlockConfig, getOptions, addSearchEventListeners } from '../../scripts/asc/utils/search.js';
import { htmlCheckboxes, htmlRadio, htmlDropdown } from '../search-property/search-property.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
    options: (content) => getOptions({ content: Array.isArray(content) ? content.join('\n') : String(content) }),
  }, {
    name: 'path',
    operation: 'equals',
    exact: false,
    flat: false,
    self: true,
    options: [],
  });

  block.innerHTML = html(config);
  addSearchEventListeners(block, config);
}

function html(config) {
  const type = config.type || 'checkbox';
  return `
    ${config.exact ? `
    <input type="hidden"
           for="${config.fieldset}"
           name="${config.parameter('exact')}"
           value="${config.exact}"
           form="${config.form}"/>` : ''}

    ${config.flat ? `
    <input type="hidden"
           for="${config.fieldset}"
           name="${config.parameter('flat')}"
           value="${config.flat}"
           form="${config.form}"/>` : ''}

    ${config.self ? `
    <input type="hidden"
           for="${config.fieldset}"
           name="${config.parameter('self')}"
           value="${config.self}"
           form="${config.form}"/>` : ''}

    ${config.title ? `<label class="search-path__title">${config.title}</label>` : ''}

    ${type === 'radio' ? htmlRadio(config) : ''}
    ${type === 'dropdown' || type === 'select' ? htmlDropdown(config) : ''}
    ${type === 'checkbox' ? htmlCheckboxes(config) : ''}
  `;
}
