/** @owner user */
/**
 * search-property — metadata property filter.
 *
 * Emits a neutral `property` FilterDescriptor (see services/search/request.js). The
 * active provider's translator maps it:
 *   QueryBuilder → property predicate (any JCR property path)
 *   OpenAPI      → filter[assetFormat]/[assetTagIds] for mapped fields only; an
 *                  unmapped field warns and is skipped (never silently dropped).
 *                  Use search-tags for tags — it has full OpenAPI support.
 **/
import { readBlockConfig, getOptions, addSearchEventListeners, enhanceSearchFilterDropdown } from '../../scripts/asc/core/utils/search.js';
import { filterAttrs, decodeInitialFilter } from '../../scripts/asc/core/services/search/request.js';
import { mountToHeader } from '../../scripts/asc/core/utils/header-mount.js';

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

  // Deterministic filter id (type:field) so a shared URL hydrates this block without
  // carrying the id. Author an `id` row only to disambiguate two filters on the same field.
  const filterId = config.id || `property:${config.property}`;
  config.descriptor = {
    id: filterId,
    type: 'property',
    field: config.property,
    op: config.operation,
    match: config.and ? 'all' : 'any',
  };
  config.initial = decodeInitialFilter(filterId);

  block.innerHTML = html(config);
  enhanceSearchFilterDropdown(block, config.title || 'Filter');
  addSearchEventListeners(block, config);

  // Dropdown-style filter blocks (style: top|inline dropdowns search-filters) relocate
  // into the header's shared .search-filter-dropdowns row (see blocks/header/header.js)
  // — same mountToHeader() mechanism as search-active-filters — so every dropdown filter
  // block on the page ends up in one horizontal row regardless of which section(s) they
  // were authored in.
  const section = block.closest('.section.inline.dropdowns.search-filters, .section.top.dropdowns.search-filters');
  if (section) {
    mountToHeader(block, () => {
      document.querySelector('header .search-filter-dropdowns')?.append(block);
      // Once the last dropdown filter has left, this section no longer needs its
      // dropdown-row framing (centered flex row, card-style .block styling) — other
      // authored blocks (e.g. search-statistics) commonly share the section and should
      // fall back to rendering as plain page content instead of an odd, mostly-empty
      // card. Remove it outright if nothing else was ever authored alongside the filters.
      if (!section.querySelector('.search-filter-dropdown')) {
        section.classList.remove('inline', 'top', 'dropdowns', 'search-filters');
        if (!section.querySelector('.block')) {
          section.remove();
        } else {
          section.classList.add('filters-relocated');
        }
      }
    });
  }
}

function html(config) {
  const type = config.type || 'checkbox';
  return `
    ${type === 'radio' || type === 'checkbox' ? `
    <fieldset class="search-property__group">
      ${config.title ? `<legend class="search-property__title">${config.title}</legend>` : ''}
      ${type === 'radio' ? htmlRadio(config) : htmlCheckboxes(config)}
    </fieldset>` : ''}
    ${type === 'dropdown' || type === 'select' ? `
      ${config.title ? `<span class="search-property__title">${config.title}</span>` : ''}
      ${htmlDropdown(config)}` : ''}
  `;
}

export function htmlCheckboxes(config) {
  return `<ul class="search-property__options asc-ui-dropdown__list">
    ${config.options.filter((o) => o.value).map((option, index) => {
      const id = `${config.descriptor.id}-option-${index}`;
      const checked = config.initial.values.includes(option.value);
      return `
        <li class="search-property__option">
          <label class="asc-ui-dropdown__item">
            <input type="checkbox"
                   id="${id}"
                   value="${option.value}"
                   ${checked ? 'checked' : ''}
                   ${filterAttrs(config.descriptor)}
                   form="${config.form}"/>
            ${option.text}
          </label>
        </li>`;
    }).join('')}
  </ul>`;
}

export function htmlRadio(config) {
  return `<ul class="search-property__options asc-ui-dropdown__list">
    ${config.options.filter((o) => o.value).map((option, index) => {
      const id = `${config.descriptor.id}-option-${index}`;
      const checked = config.initial.values[0] === option.value;
      return `
        <li class="search-property__option">
          <label class="asc-ui-dropdown__item">
            <input type="radio"
                   id="${id}"
                   name="${config.descriptor.id}"
                   value="${option.value}"
                   ${checked ? 'checked' : ''}
                   ${filterAttrs(config.descriptor)}
                   form="${config.form}"/>
            ${option.text}
          </label>
        </li>`;
    }).join('')}
  </ul>`;
}

export function htmlDropdown(config) {
  const selected = config.initial.values[0] || '';
  return `
    <select aria-label="${config.title || 'Select option'}"
            ${filterAttrs(config.descriptor)}
            form="${config.form}">
      <option value="">${config.title || 'Select…'}</option>
      ${config.options.filter((o) => o.value).map((option) => `
        <option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${option.text}</option>
      `).join('')}
    </select>`;
}
