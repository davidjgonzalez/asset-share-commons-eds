import { SEARCH_FORM } from '../../scripts/asc/utils/search.js';

/**
 * Injects hidden QueryBuilder predicates as hidden form inputs.
 *
 * Author each predicate as a two-column row in the block table:
 *   | predicate name           | value                  |
 *   |--------------------------|------------------------|
 *   | path                     | /content/dam/brand     |
 *   | excludepaths             | .*subassets.*          |
 *   | mainasset                | true                   |
 *
 * The predicate name is used verbatim — do NOT add a group prefix.
 * Use basePredicates in configurations.js for programmatic static filters;
 * use this block for content-authorable static filters on a specific page.
 */
export default function decorate(block) {
  const fields = [...block.querySelectorAll(':scope > div')]
    .map((row) => {
      const cells = row.querySelectorAll('div');
      if (cells.length < 2) return null;
      const name = cells[0].textContent.trim();
      const value = cells[1].textContent.trim();
      return name && value ? { name, value } : null;
    })
    .filter(Boolean);

  block.innerHTML = fields
    .map(({ name, value }) => `<input type="hidden" name="${name}" value="${value}" form="${SEARCH_FORM}">`)
    .join('\n');
}
