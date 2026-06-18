/** @owner user */
/**
 * search-tags — tag-based filter block.
 *
 * Emits QueryBuilder `tagid` predicate fields into the shared search form.
 * The active search provider translates these:
 *   QueryBuilder → tagid predicate (property + N_value entries)
 *   OpenAPI      → filter[assetTagIds][]  (mapped in openapi.js)
 *
 * Authoring (da.live table):
 *   | property | jcr:content/metadata/cq:tags |  (optional; tag property path)
 *   | title    | Tags                         |  (optional; label shown above options)
 *   | type     | checkbox                     |  (optional; checkbox | radio | dropdown)
 *   | and      | false                        |  (optional; true = AND, false = OR between selections)
 *   | options  | Display Label : namespace:tag/path
 *              | Another Tag   : namespace:other/tag |
 *
 * Tag values follow AEM tag namespace format: `namespace:tag-path`
 * (e.g. `dam:status/approved`, `myns:category/nature`).
 */
import { readBlockConfig, getOptions, addSearchEventListeners } from '../../scripts/asc/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
    options: (content) => getOptions({ content: String(content) }),
  }, {
    name: 'tagid',
    property: 'jcr:content/metadata/cq:tags',
    and: false,
    type: 'checkbox',
    options: [],
  });

  block.innerHTML = html(config);
  if (isInlineDropdownMode(block)) {
    enhanceAsDropdown(block, config.title || 'Tags');
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
  const titleEl = block.querySelector(':scope > .search-tags__title');
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
  return `
    <!-- QB: tagid.property — which JCR tag property to filter on -->
    <input type="hidden"
           name="${config.parameter('property')}"
           value="${config.property}"
           form="${config.form}"
           for="${config.fieldset}"/>

    <!-- QB: tagid.and — AND (true) or OR (false) logic between selections -->
    ${config.and ? `
    <input type="hidden"
           name="${config.parameter('and')}"
           value="true"
           form="${config.form}"
           for="${config.fieldset}"/>` : ''}

    ${config.title ? `<label class="search-tags__title">${config.title}</label>` : ''}

    <div class="search-tags__options asc-ui-dropdown__list">
      ${config.type === 'radio' ? htmlRadio(config) : ''}
      ${config.type === 'dropdown' || config.type === 'select' ? htmlDropdown(config) : ''}
      ${!config.type || config.type === 'checkbox' ? htmlCheckboxes(config) : ''}
    </div>
  `;
}

function htmlCheckboxes(config) {
  return config.options.map((option, index) => {
    const name = config.parameter('value', index);
    const id = `${config.fieldset}-tag-${index}`;
    const checked = config.initial[name] === option.value;

    return `
      <label class="search-tags__option asc-ui-dropdown__item">
        <input type="checkbox"
               id="${id}"
               name="${name}"
               value="${option.value}"
               ${checked ? 'checked' : ''}
               data-asc-fieldset="${config.fieldset}"
               form="${config.form}"/>
        ${option.text}
      </label>`;
  }).join('');
}

function htmlRadio(config) {
  // All radios share one name so only one can be selected at a time
  const sharedName = config.parameter('value', 0);

  return config.options.map((option, index) => {
    const id = `${config.fieldset}-tag-${index}`;
    const checked = config.initial[sharedName] === option.value;

    return `
      <label class="search-tags__option asc-ui-dropdown__item">
        <input type="radio"
               id="${id}"
               name="${sharedName}"
               value="${option.value}"
               ${checked ? 'checked' : ''}
               data-asc-fieldset="${config.fieldset}"
               form="${config.form}"/>
        ${option.text}
      </label>`;
  }).join('');
}

function htmlDropdown(config) {
  const name = config.parameter('value', 0);
  const selected = config.initial[name] || '';

  return `
    <select name="${name}"
            data-asc-fieldset="${config.fieldset}"
            form="${config.form}">
      <option value="">All tags</option>
      ${config.options.map((option) => `
        <option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${option.text}</option>
      `).join('')}
    </select>`;
}
