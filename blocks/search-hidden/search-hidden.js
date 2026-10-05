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
 *   - `path`                      → restrict to a DAM folder (op 'under')
 *   - `tags`                      → tag id(s); field defaults to jcr:content/metadata/cq:tags
 *   - `property:<field>`          → exact match on a metadata field (JCR path, or a short
 *                                   name like dc:format → jcr:content/metadata/dc:format)
 *   - `daterange:<field>`         → absolute date window; value `2024-01-01 | 2024-12-31`
 *   - `relativedaterange:<field>` → relative window; value `-30d | now`
 *   - `range:<field>`             → numeric range; value `min | max`
 *   - `boolproperty:<field>`      → boolean flag; value `true`
 *   - `nodename`                  → file-name glob; value `*.jpg`
 *   - `excludepaths`              → exclude a subtree; value is a path regex
 *   - `notexpired:<field>`        → expiration in the future OR unset (field = the
 *                                   expiration-date property); no value needed
 * Value may be pipe-separated for multiple values (`a | b | c`), OR'd by default.
 * Some types (range, boolproperty, nodename, excludepaths, notexpired) are QueryBuilder-only
 * and warn-and-skip on the OpenAPI provider.
 */

const SHORT_PROPERTY_PREFIX = 'jcr:content/metadata/';

function expandField(field) {
  if (!field) return field;
  return field.includes('/') ? field : `${SHORT_PROPERTY_PREFIX}${field}`;
}

// Neutral types that take a metadata `field` and a list of values.
const FIELD_TYPES = {
  property: 'equals',
  tags: 'in',
  daterange: 'between',
  relativedaterange: 'between',
  range: 'between',
  boolproperty: 'equals',
};
// Neutral types that take values but no field.
const FIELDLESS_TYPES = { nodename: 'matches', excludepaths: 'exclude' };

function rowToFilter(key, value, index) {
  const values = value.split('|').map((v) => v.trim()).filter(Boolean);
  const [rawType, rawField = ''] = key.split(':');
  const type = rawType.trim();
  const field = rawField.trim();
  const id = `hidden-${index}-${type}`;

  // "Not expired" is a valueless flag over the expiration-date field (field may be given
  // in the key as notexpired:<field>, or as the row value).
  if (type === 'notexpired') {
    return { id, type, field: expandField(field || values[0] || ''), op: 'exists', values: [] };
  }

  if (!values.length) return null;

  if (type === 'path') return { id, type: 'path', field: '', op: 'under', values };
  if (FIELDLESS_TYPES[type]) return { id, type, field: '', op: FIELDLESS_TYPES[type], values };
  if (FIELD_TYPES[type]) {
    const resolvedField = type === 'tags' ? (expandField(field) || 'jcr:content/metadata/cq:tags') : expandField(field);
    return { id, type, field: resolvedField, op: FIELD_TYPES[type], values };
  }
  // Fallback: treat the whole key as a property field path.
  return { id: `hidden-${index}-${key}`, type: 'property', field: expandField(key), op: 'equals', values };
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
