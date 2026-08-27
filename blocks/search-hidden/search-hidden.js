/** @owner user */
import services from '../../scripts/asc/core/services/services.js';

/**
 * search-hidden — author-set QueryBuilder (or active-provider) predicates that
 * are always merged into every search on the page, regardless of what the
 * visitor searches/filters for.
 *
 * Authoring (da.live table) — each row is `predicate-name | value`, passed
 * through to the query verbatim:
 *
 *   | search-hidden |
 *   | path          | /content/dam/marketing |
 *   | tagid         | properties:orientation/landscape |
 *
 * Grouping (QueryBuilder only): write ordinary QB group syntax with small,
 * ordinary numbers (1, 2, ...) — ASC rewrites them to a page-unique, high
 * group-number range so they can never collide with the numbers filter
 * blocks (search-property, search-tags, ...) auto-assign themselves via
 * getGroup() in scripts/asc/core/utils/search.js:
 *
 *   | search-hidden      |      |
 *   | 1_group.p.or       | true |
 *   | 1_group.1_type     | dam:Asset |
 *   | 1_group.2_type     | dam:AssetContentFragment |
 *   | path               | /content/dam/marketing |
 *
 * Not provider-agnostic: N_group.* syntax is QueryBuilder-specific. On the
 * openapi provider these keys are passed through unchanged and have no
 * special meaning.
 *
 * Merged directly into services.search.provider.config.basePredicates (the
 * same object configurations.js's search.basePredicates points at) rather
 * than emitted as hidden form inputs, so it can never collide with the
 * filter blocks' own form-field namespace and real visitor filters still
 * win (basePredicates is layered before form data in buildParams()).
 */

const GROUP_BASE = 100;
const GROUP_ROW_RE = /^(\d+)(_group\..+)$/;

// Each search-hidden instance on a page gets its own multiple of GROUP_BASE
// (100, 200, 300, ...) so two search-hidden blocks can't collide with each
// other either.
const instanceBases = new WeakMap();
let instanceCount = 0;

function getInstanceBase(block) {
  if (!instanceBases.has(block)) {
    instanceCount += 1;
    instanceBases.set(block, GROUP_BASE * instanceCount);
  }
  return instanceBases.get(block);
}

function remapGroupNumber(key, base) {
  const match = key.match(GROUP_ROW_RE);
  if (!match) return key;
  return `${base + Number(match[1])}${match[2]}`;
}

export default function decorate(block) {
  const base = getInstanceBase(block);
  const predicates = {};

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const key = cells[0]?.textContent.trim();
    const value = cells[1]?.textContent.trim();
    if (!key || !value) return;
    predicates[remapGroupNumber(key, base)] = value;
  });

  services.search.provider.config.basePredicates = {
    ...services.search.provider.config.basePredicates,
    ...predicates,
  };

  block.innerHTML = '';
}
