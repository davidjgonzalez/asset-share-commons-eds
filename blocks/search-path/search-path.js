/** @owner user */
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
  const titleEl = block.querySelector(':scope > .search-path__title');
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
