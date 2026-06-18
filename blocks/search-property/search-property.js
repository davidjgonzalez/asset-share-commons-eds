/** @owner user */
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
  if (isInlineDropdownMode(block)) {
    enhanceAsDropdown(block, config.title || 'Filter');
  }
  addSearchEventListeners(block, config);
}

function isInlineDropdownMode(block) {
  return Boolean(
    block.closest('.section.inline.dropdowns.search-filters')
    || block.closest('.section.top.dropdowns.search-filters'),
  );
}

function enhanceAsDropdown(block, fallbackLabel) {
  const titleEl = block.querySelector(':scope > .search-property__title');
  const label = titleEl?.textContent?.trim() || fallbackLabel;
  titleEl?.remove();

  const hiddenInputs = Array.from(block.querySelectorAll(':scope > input[type="hidden"]'));
  const panelContent = Array.from(block.children).filter((el) => !hiddenInputs.includes(el));

  const dropdown = document.createElement('div');
  dropdown.className = 'search-filter-dropdown asc-ui-control asc-ui-dropdown';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'search-filter-dropdown__trigger btn btn--secondary asc-ui-control-btn';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `<span>${label}</span><span class="search-filter-dropdown__arrow asc-ui-chevron" aria-hidden="true">▾</span>`;

  const panel = document.createElement('div');
  panel.className = 'search-filter-dropdown__panel asc-ui-dropdown__panel';
  panel.hidden = true;
  panel.append(...panelContent);

  const closePanel = () => {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', () => {
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    panel.hidden = expanded;
    trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  });

  document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target)) closePanel();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  block.innerHTML = '';
  block.append(...hiddenInputs, dropdown);
  dropdown.append(trigger, panel);
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
  return `<ul class="search-property__options asc-ui-dropdown__list">
    ${config.options.filter((o) => o.value).map((option, index) => {
      const name = `${config.group}_group.${config.name}.${index}_value`;
      const id = `${config.fieldset}-option-${index}`;
      const checked = config.initial[name] === option.value;
      return `
        <li class="search-property__option">
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

export function htmlRadio(config) {
  const sharedName = `${config.group}_group.${config.name}.value`;
  return `<ul class="search-property__options asc-ui-dropdown__list">
    ${config.options.filter((o) => o.value).map((option, index) => {
      const id = `${config.fieldset}-option-${index}`;
      const checked = config.initial[sharedName] === option.value;
      return `
        <li class="search-property__option">
          <label class="asc-ui-dropdown__item">
            <input type="radio"
                   id="${id}"
                   name="${sharedName}"
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
