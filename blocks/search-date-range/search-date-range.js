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
  addSearchEventListeners(block, config);
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
