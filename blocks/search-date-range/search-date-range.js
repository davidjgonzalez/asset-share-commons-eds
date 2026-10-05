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
import { readBlockConfig, addSearchEventListeners, enhanceSearchFilterDropdown } from '../../scripts/asc/core/utils/search.js';
import { filterAttrs, decodeInitialFilter } from '../../scripts/asc/core/services/search/request.js';
import { mountToHeader } from '../../scripts/asc/core/utils/header-mount.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {}, {
    name: 'daterange',
    property: 'jcr:content/metadata/dam:assetLastModified',
  });

  const filterId = config.id || `daterange:${config.property}`;
  config.descriptor = {
    id: filterId, type: 'daterange', field: config.property, op: 'between',
  };
  config.initial = decodeInitialFilter(filterId);

  block.innerHTML = html(config);
  enhanceSearchFilterDropdown(block, config.title || 'Date');
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
  // The URL may carry full ISO (e.g. "2024-01-15T00:00:00.000Z"); <input type="date">
  // only accepts YYYY-MM-DD — strip any time suffix so the picker restores its state.
  const lowerInitial = (config.initial.bounds.lower || '').slice(0, 10);
  const upperInitial = (config.initial.bounds.upper || '').slice(0, 10);

  return `
    ${config.title ? `<label class="search-date-range__title">${config.title}</label>` : ''}

    <div class="search-date-range__inputs">
      <label class="search-date-range__field asc-ui-field">
        <span class="asc-ui-field__label">From</span>
        <input type="date"
               id="${config.descriptor.id}-lower"
               value="${lowerInitial}"
               ${filterAttrs(config.descriptor, { bound: 'lower' })}
               form="${config.form}"/>
      </label>
      <label class="search-date-range__field asc-ui-field">
        <span class="asc-ui-field__label">To</span>
        <input type="date"
               id="${config.descriptor.id}-upper"
               value="${upperInitial}"
               ${filterAttrs(config.descriptor, { bound: 'upper' })}
               form="${config.form}"/>
      </label>
    </div>
  `;
}
