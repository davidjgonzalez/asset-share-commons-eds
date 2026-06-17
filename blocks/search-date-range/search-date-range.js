/** @owner user */
/**
 * search-date-range — date range filter block.
 *
 * Emits QueryBuilder `daterange` predicate fields into the shared search form.
 * The active search provider translates these:
 *   QueryBuilder → daterange predicate (lowerBound / upperBound / lowerOperation / upperOperation)
 *   OpenAPI      → filter[createdAt|modifiedAt][from|to]  (mapped via DATE_PROPERTY_MAP in openapi.js)
 *
 * Authoring (da.live table):
 *   | property | jcr:content/metadata/dam:assetLastModified |   (required; sets the date field to filter)
 *   | title    | Modified Date                              |   (optional; label shown above inputs)
 *   | name     | daterange                                  |   (optional; QB predicate name, rarely changed)
 *
 * Both "From" and "To" inputs are optional at query time — omitting either end leaves that bound open.
 */
import { readBlockConfig, addSearchEventListeners } from '../../scripts/asc/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {}, {
    name: 'daterange',
    property: 'jcr:content/metadata/dam:assetLastModified',
  });

  block.innerHTML = html(config);
  if (isInlineDropdownMode(block)) {
    enhanceAsDropdown(block, config.title || 'Date');
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
  const titleEl = block.querySelector(':scope > .search-date-range__title');
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
  const lowerName = config.parameter('lowerBound');
  const upperName = config.parameter('upperBound');
  const lowerInitial = config.initial[lowerName] || '';
  const upperInitial = config.initial[upperName] || '';

  return `
    <!-- QB: daterange.property — which JCR date field to filter on -->
    <input type="hidden"
           name="${config.parameter('property')}"
           value="${config.property}"
           form="${config.form}"
           for="${config.fieldset}"/>
    <!-- QB: operations — always >= for lower, <= for upper -->
    <input type="hidden"
           name="${config.parameter('lowerOperation')}"
           value=">="
           form="${config.form}"
           for="${config.fieldset}"/>
    <input type="hidden"
           name="${config.parameter('upperOperation')}"
           value="<="
           form="${config.form}"
           for="${config.fieldset}"/>

    ${config.title ? `<label class="search-date-range__title">${config.title}</label>` : ''}

    <div class="search-date-range__inputs">
      <div class="search-date-range__field">
        <label class="search-date-range__label" for="${config.fieldset}-lower">From</label>
        <input type="date"
               id="${config.fieldset}-lower"
               name="${lowerName}"
               value="${lowerInitial}"
               data-asc-fieldset="${config.fieldset}"
               form="${config.form}"/>
      </div>
      <div class="search-date-range__field">
        <label class="search-date-range__label" for="${config.fieldset}-upper">To</label>
        <input type="date"
               id="${config.fieldset}-upper"
               name="${upperName}"
               value="${upperInitial}"
               data-asc-fieldset="${config.fieldset}"
               form="${config.form}"/>
      </div>
    </div>
  `;
}
