/** @owner user */
import services from '../../scripts/asc/core/services/services.js';
import { normalizeFilter } from '../../scripts/asc/core/services/search/request.js';

/**
 * search-hidden — author-set baseline filters always applied to every search on the
 * page, regardless of what the visitor searches/filters for. These are provider-neutral
 * FilterDescriptors (see services/search/request.js), merged ahead of the user's own
 * filters, so they work identically under QueryBuilder, OpenAPI, or any custom provider.
 *
 * Authoring (da.live table) — each row is `type | value`:
 *
 *   | search-hidden        |                                  |
 *   | path                 | /content/dam/marketing           |
 *   | tags                 | properties:orientation/landscape |
 *   | property:dc:format   | image/jpeg                       |
 *
 * Row key = neutral filter type, optionally `type:field`:
 *   - `path`              → restrict to a DAM folder (op 'under')
 *   - `tags`              → tag id(s); field defaults to jcr:content/metadata/cq:tags
 *   - `property:<field>`  → exact match on a metadata field (field is the JCR path or
 *                           a short name like dc:format → jcr:content/metadata/dc:format)
 * Value may be pipe-separated for multiple values (`a | b | c`), OR'd by default.
 */

const SHORT_PROPERTY_PREFIX = 'jcr:content/metadata/';

function expandField(field) {
  if (!field) return field;
  return field.includes('/') ? field : `${SHORT_PROPERTY_PREFIX}${field}`;
}

function rowToFilter(key, value, index) {
  const values = value.split('|').map((v) => v.trim()).filter(Boolean);
  if (!values.length) return null;

  const [rawType, rawField = ''] = key.split(':');
  const type = rawType.trim();
  const field = rawField.trim();

  if (type === 'path') {
    return { id: `hidden-${index}-path`, type: 'path', field: '', op: 'under', values };
  }
  if (type === 'tags') {
    return {
      id: `hidden-${index}-tags`, type: 'tags', field: expandField(field) || 'jcr:content/metadata/cq:tags', op: 'in', values,
    };
  }
  if (type === 'property') {
    return {
      id: `hidden-${index}-property`, type: 'property', field: expandField(field), op: 'equals', values,
    };
  }
  // Fallback: treat the whole key as a property field path.
  return {
    id: `hidden-${index}-${key}`, type: 'property', field: expandField(key), op: 'equals', values,
  };
}

export default function decorate(block) {
  [...block.children].forEach((row, index) => {
    const cells = [...row.children];
    const key = cells[0]?.textContent.trim();
    const value = cells[1]?.textContent.trim();
    if (!key || !value) return;
    const filter = rowToFilter(key, value, index);
    if (filter) services.search.baseFilters.push(normalizeFilter(filter));
  });

  block.innerHTML = '';
}
