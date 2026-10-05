/** @owner user */
/**
 * search-path — DAM folder path filter.
 *
 * Emits a neutral `path` FilterDescriptor (op 'under', meta { exact, flat }). The
 * active provider's translator maps it:
 *   QueryBuilder → path predicate (single), or OR'd path predicates (multi-select)
 *   OpenAPI      → filter[assetAncestorPath] (first value; exact/flat ignored)
 * Multiple selected paths are OR'd (match 'any').
 **/

import { readBlockConfig, getOptions, addSearchEventListeners, enhanceSearchFilterDropdown } from '../../scripts/asc/core/utils/search.js';
import { filterAttrs, decodeInitialFilter } from '../../scripts/asc/core/services/search/request.js';
import { mountToHeader } from '../../scripts/asc/core/utils/header-mount.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {
    options: (content) => getOptions({ content: Array.isArray(content) ? content.join('\n') : String(content) }),
  }, {
    name: 'path',
    exact: false,
    flat: false,
    options: [],
  });

  const meta = {};
  if (config.exact) meta.exact = true;
  if (config.flat) meta.flat = true;
  // Path has no field, so the id can't be derived from type:field — key it off the
  // block's name (author distinct `name`/`id` rows for multiple path filters). This id
  // is carried in the shared URL so hydration still matches.
  const filterId = config.id || `path:${config.name}`;
  config.descriptor = {
    id: filterId, type: 'path', field: '', op: 'under', match: 'any', meta,
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
    ${config.title ? `<label class="search-path__title">${config.title}</label>` : ''}

    ${type === 'radio' ? htmlPathRadio(config) : ''}
    ${type === 'dropdown' || type === 'select' ? htmlPathDropdown(config) : ''}
    ${type === 'checkbox' ? htmlPathCheckboxes(config) : ''}
  `;
}

function htmlPathRadio(config) {
  return `<ul class="search-path__options asc-ui-dropdown__list">
    ${config.options.filter((o) => o.value).map((option, index) => {
    const id = `${config.descriptor.id}-option-${index}`;
    const checked = config.initial.values[0] === option.value;
    return `
        <li class="search-path__option">
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

function htmlPathDropdown(config) {
  const selected = config.initial.values[0] || '';
  return `
    <select ${filterAttrs(config.descriptor)}
            form="${config.form}">
      <option value="">${config.title || 'Select…'}</option>
      ${config.options.filter((o) => o.value).map((option) => `
        <option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${option.text}</option>
      `).join('')}
    </select>`;
}

function htmlPathCheckboxes(config) {
  // Multi-path selection: every box carries the same descriptor id, so collectRequest
  // accumulates the checked values into one filter (OR'd by match:'any').
  return `
    <ul class="search-path__options asc-ui-dropdown__list">
      ${config.options.filter((o) => o.value).map((option, index) => {
    const id = `${config.descriptor.id}-option-${index}`;
    const checked = config.initial.values.includes(option.value);
    return `
          <li class="search-path__option">
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
