/**
 * search-property — metadata property filter.
 *
 * Provider compatibility:
 *   QueryBuilder → property predicate (any JCR property path supported)
 *   OpenAPI      → Partial support. Only the following properties are mapped to
 *                  OpenAPI filter params (see openapi.js PROPERTY_MAP):
 *                    jcr:content/metadata/dc:format  → filter[assetFormat][]
 *                    jcr:content/metadata/cq:tags    → filter[assetTagIds][]
 *                  All other property paths are silently ignored by OpenAPI.
 *                  Use search-tags for tag filtering — it has full OpenAPI support.
 *
 * AEM QueryBuilder documentation - Property:
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates#property
 **/
import { readBlockConfig, getOptions, addSearchEventListeners } from '../../scripts/asc/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
    // readBlockConfig may return an array when a cell has multiple lines — join with \n
    // so getOptions can split correctly (it splits on \n, not commas)
    options: (content) => getOptions({ content: Array.isArray(content) ? content.join('\n') : String(content) }),
  }, {
    name: 'property',
    property: 'jcr:content/metadata/dc:format',
    operation: 'equals',
    and: false,
    options: [],
  });

  block.innerHTML = html(config);
  addSearchEventListeners(block, config);
}

function html(config) {
  const type = config.type || 'checkbox';
  return `
    <input type="hidden"
           name="${config.group}_group.${config.name}.property"
           value="${config.property}"
           form="${config.form}"
           for="${config.fieldset}"/>

    ${config.and ? `
    <input type="hidden"
           name="${config.group}_group.${config.name}.and"
           value="true"
           form="${config.form}"
           for="${config.fieldset}"/>` : ''}

    ${config.operation ? `
    <input type="hidden"
           name="${config.group}_group.${config.name}.operation"
           value="${config.operation}"
           form="${config.form}"
           for="${config.fieldset}"/>` : ''}

    ${config.title ? `<label class="search-property__title">${config.title}</label>` : ''}

    ${type === 'radio' ? htmlRadio(config) : ''}
    ${type === 'dropdown' || type === 'select' ? htmlDropdown(config) : ''}
    ${type === 'checkbox' ? htmlCheckboxes(config) : ''}
  `;
}

export function htmlCheckboxes(config) {
  return `<ul class="search-property__options">
    ${config.options.filter((o) => o.value).map((option, index) => {
      const name = `${config.group}_group.${config.name}.${index}_value`;
      const id = `${config.fieldset}-option-${index}`;
      const checked = config.initial[name] === option.value;
      return `
        <li class="search-property__option">
          <input type="checkbox"
                 id="${id}"
                 name="${name}"
                 value="${option.value}"
                 ${checked ? 'checked' : ''}
                 data-asc-fieldset="${config.fieldset}"
                 form="${config.form}"/>
          <label for="${id}">${option.text}</label>
        </li>`;
    }).join('')}
  </ul>`;
}

export function htmlRadio(config) {
  const sharedName = `${config.group}_group.${config.name}.value`;
  return `<ul class="search-property__options">
    ${config.options.filter((o) => o.value).map((option, index) => {
      const id = `${config.fieldset}-option-${index}`;
      const checked = config.initial[sharedName] === option.value;
      return `
        <li class="search-property__option">
          <input type="radio"
                 id="${id}"
                 name="${sharedName}"
                 value="${option.value}"
                 ${checked ? 'checked' : ''}
                 data-asc-fieldset="${config.fieldset}"
                 form="${config.form}"/>
          <label for="${id}">${option.text}</label>
        </li>`;
    }).join('')}
  </ul>`;
}

export function htmlDropdown(config) {
  const name = `${config.group}_group.${config.name}.value`;
  const selected = config.initial[name] || '';
  return `
    <select name="${name}"
            data-asc-fieldset="${config.fieldset}"
            form="${config.form}">
      <option value="">${config.title || 'Select…'}</option>
      ${config.options.filter((o) => o.value).map((option) => `
        <option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${option.text}</option>
      `).join('')}
    </select>`;
}
