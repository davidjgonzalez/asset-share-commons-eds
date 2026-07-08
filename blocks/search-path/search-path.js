/** @owner user */
/**
 * search-path — DAM folder path filter.
 *
 * Provider compatibility:
 *   QueryBuilder → path predicate (path, path.exact, path.flat)
 *   OpenAPI      → filter[assetAncestorPath] (first selected value; exact/flat flags ignored)
 *
 * QB path predicate field names:
 *   radio/dropdown → N_group.path=<value>  (QB direct path predicate key)
 *   checkbox       → N_group.1_path=<v1>, N_group.2_path=<v2>, … + N_group.p.or=true
 *
 * NOTE: path.self is deprecated in QueryBuilder and is not emitted by this block.
 *
 * AEM QueryBuilder documentation - Path:
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates#path
 **/

import { readBlockConfig, getOptions, addSearchEventListeners, enhanceSearchFilterDropdown } from '../../scripts/asc/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
    options: (content) => getOptions({ content: Array.isArray(content) ? content.join('\n') : String(content) }),
  }, {
    name: 'path',
    exact: false,
    flat: false,
    options: [],
  });

  block.innerHTML = html(config);
  enhanceSearchFilterDropdown(block, config.title || 'Filter');
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

    ${config.title ? `<label class="search-path__title">${config.title}</label>` : ''}

    ${type === 'radio' ? htmlPathRadio(config) : ''}
    ${type === 'dropdown' || type === 'select' ? htmlPathDropdown(config) : ''}
    ${type === 'checkbox' ? htmlPathCheckboxes(config) : ''}
  `;
}

function htmlPathRadio(config) {
  // All radios share config.field (= N_group.path) — the direct QB path predicate key.
  return `<ul class="search-path__options asc-ui-dropdown__list">
    ${config.options.filter((o) => o.value).map((option, index) => {
    const id = `${config.fieldset}-option-${index}`;
    const checked = config.initial[config.field] === option.value;
    return `
        <li class="search-path__option">
          <label class="asc-ui-dropdown__item">
            <input type="radio"
                   id="${id}"
                   name="${config.field}"
                   value="${option.value}"
                   ${checked ? 'checked' : ''}
                   data-asc-fieldset="${config.fieldset}"
                   form="${config.form}"/>
            ${option.text}
          </label>
        </li>`;
  }).join('')}
  </ul>`;
}

function htmlPathDropdown(config) {
  // Select uses config.field (= N_group.path) — the direct QB path predicate key.
  const selected = config.initial[config.field] || '';
  return `
    <select name="${config.field}"
            data-asc-fieldset="${config.fieldset}"
            form="${config.form}">
      <option value="">${config.title || 'Select…'}</option>
      ${config.options.filter((o) => o.value).map((option) => `
        <option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${option.text}</option>
      `).join('')}
    </select>`;
}

function htmlPathCheckboxes(config) {
  // Multi-path selection: each option uses an indexed name (N_group.M_path) so QB
  // can combine them with OR logic via N_group.p.or=true. cleanFormData only includes
  // the p.or hidden field when at least one checkbox is checked.
  return `
    <input type="hidden"
           name="${config.group}_group.p.or"
           value="true"
           form="${config.form}"
           for="${config.fieldset}"/>
    <ul class="search-path__options asc-ui-dropdown__list">
      ${config.options.filter((o) => o.value).map((option, index) => {
    const name = `${config.group}_group.${index + 1}_path`;
    const id = `${config.fieldset}-option-${index}`;
    const checked = config.initial[name] === option.value;
    return `
          <li class="search-path__option">
            <label class="asc-ui-dropdown__item">
              <input type="checkbox"
                     id="${id}"
                     name="${name}"
                     value="${option.value}"
                     ${checked ? 'checked' : ''}
                     data-asc-fieldset="${config.fieldset}"
                     form="${config.form}"/>
              ${option.text}
            </label>
          </li>`;
  }).join('')}
    </ul>`;
}
