/**
 * AEM QueryBuilder documentation - Property 
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates#property
 **/
import { readBlockConfig, getOptions, addSearchEventListeners } from '../../scripts/asc/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
        options: (content) => getOptions({content: String(content)}),
  }, {
    name: 'property',
    property: 'jcr:content/metadata/dc:format',
    operation: 'equals',
    and: false,
    options: []
  });


  block.innerHTML = html(config);

  addSearchEventListeners(block, config);
}

function html(config) {  
  return `
    <!-- Sets the metadata property to search over -->
    <input type="hidden"
           name="${config.group}_group.${config.name}.property"
           value="${config.property}"
           form="${config.form}"
           for="${config.fieldset}"/>

    <!-- Overrides the default AND/OR behavior (default is OR) -->
    ${config.and ? 
    `<input
           type="hidden"
           name="${config.group}_group.${config.name}.and"
           value="${config.and}"
           form="${config.form}"
           for="${config.fieldset}"/>` : ''}

    <!-- Overrides the default operation (default is equals) -->
    ${config.operation ? 
    `<input type="hidden"
           name="${config.group}_group.${config.name}.operation"
           value="${config.operation}"
           form="${config.form}"
           for="${config.fieldset}"/>` : ''}

    <!-- Renders the title -->
    ${config.title ? `<label for="${config.group}_${config.name}_fieldset">${config.title}</label>` : ''}

    <div class="expand-collapse">
      ${!config.type || config.type.includes('checkbox') ? htmlCheckboxes(config, config.initial) : ''}
      ${config.type.includes('radio')  ? htmlRadio(config, config.initial) : ''}
      ${config.type.includes('dropdown') || config.type.includes('select') ? htmlDropdown(config, config.initial) : ''}
    </div>
`
}


/**
 * Render HTML checkboxes
 * 
 * @param {*} config the block configuration
 * @returns HTML to render checkbox-based search filters
 */
export function htmlCheckboxes(config) {
  return config.options.map((option, index) => {
    const name = `${config.group}_group.${config.name}.${index}_value`;
    const id = `${config.group}_group-${config.name}_filter_${config.name}_${index}_value`;
    const selected = config.initial[name] === option.value;

    return `<li><input type="checkbox"
              data-asc-fieldset="${config.fieldset}"
              form="${config.form}"
              name="${name}"
              ${selected ? 'checked' : ''}
              value="${option.value}"/>
            <label for="${id}">${option.text}</label></li>`
  }).join('');
}

/**
 * Render HTML radio buttons
 * 
 * @param {*} config the block configuration
 * @returns HTML to render radio-based search filters
 */
export function htmlRadio(config) {
  return config.options.map((option, index) => {
    const inputName = `${config.group}_group.${config.name}.value`; // All radio buttons share the same name
    const id = `${config.group}_${config.name}_${index}_value`;
    const selected = config.initial[inputName] === option.value;
    
    return `<input type="radio"
              data-asc-fieldset="${config.fieldset}"
              form="${config.form}"
              name="${inputName}"
              ${selected ? 'checked' : ''}
              value="${option.value}"/>
            <label for="${id}">${option.text}</label>`
  }).join('');
}


/**
 * Render HTML dropdown
 * 
 * @param {*} config the block configuration
 * @returns HTML to render dropdown-based search filters
 */
export function htmlDropdown(config, initialValues = {}) {
  const selectName = `${config.group}.${config.name}.value`;
  const selectedValue = initialValues.find(v => v.key === selectName)?.value || '';
  
  return `<select
            name="${selectName}"
            data-asc-fieldset="${config.fieldset}"
            form="${config.form}">
            
        <option value="">${config.label || 'Select...'}</option>
        ${config.options.map(option => `
          <option value="${option.value}"
                  ${option.value === selectedValue ? 'selected' : ''}>
                  ${option.label}
          </option>
        `).join('')}
    </select>`;
}

