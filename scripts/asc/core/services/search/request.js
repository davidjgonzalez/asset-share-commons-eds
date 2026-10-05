// ASC Core — do not edit. Customize via scripts/asc/configurations.js

/**
 * The provider-neutral search request model.
 *
 * Blocks and internal callers describe *what* to search for in these terms; a
 * SearchProvider's translator registry turns a request into the concrete API call
 * for QueryBuilder, DM OpenAPI, or any custom provider. No provider syntax
 * (QB predicate names, OpenAPI `filter[...]` keys) ever appears outside a provider.
 *
 * SearchRequest:
 *   {
 *     text:    string,              // free-text query ('' when none)
 *     filters: FilterDescriptor[],  // structured filters (order-independent)
 *     sort:    { field, direction },// neutral sort (see SORT_FIELDS)
 *     offset:  number,              // paging cursor (never serialized to the URL)
 *     limit:   number,              // page size
 *   }
 *
 * FilterDescriptor:
 *   {
 *     id:     string,   // STABLE identity (from block config / caller), not positional.
 *                       //   Two descriptors with the same id are the same filter.
 *     type:   string,   // neutral filter type: 'property' | 'path' | 'daterange'
 *                       //   | 'tags' | 'color' | 'similar' | … (extensible — a new
 *                       //   type is just a new string + a translator entry per provider)
 *     field:  string,   // logical/metadata field the filter acts on (may be '' for
 *                       //   types like 'path' that have no field)
 *     op:     string,   // 'equals' | 'in' | 'under' | 'between' | 'contains' | …
 *     values: string[], // always an array; single-value filters use [value]
 *     match:  'any'|'all', // multi-value combination (OR vs AND); default 'any'
 *     meta:   object,   // type-specific extras (e.g. { exact, flat } for path,
 *                       //   { lowerOp, upperOp } for daterange)
 *   }
 */

/** Neutral sort vocabulary. Each provider maps these to its own order fields. */
export const SORT_FIELDS = ['relevance', 'created', 'modified', 'title'];

export const DEFAULT_SORT = { field: 'created', direction: 'desc' };

const DEFAULT_LIMIT = 24;

// Filter types that are meaningful with no `values` (flags / reference-only), so
// createRequest must not drop them as "empty".
const VALUELESS_TYPES = new Set(['similar', 'notexpired']);

/** Normalize a partial descriptor to the full shape (stable defaults, array values). */
export function normalizeFilter(filter = {}) {
  const {
    id, type, field = '', op = 'equals', values, match = 'any', meta = {},
  } = filter;
  const arr = Array.isArray(values) ? values : (values == null || values === '' ? [] : [values]);
  return {
    id: id || `${type || 'filter'}:${field}`,
    type: type || 'property',
    field,
    op,
    values: arr.map((v) => String(v)),
    match: match === 'all' ? 'all' : 'any',
    meta: meta && typeof meta === 'object' ? meta : {},
  };
}

/** Build a complete SearchRequest from a partial one, applying defaults. */
export function createRequest(partial = {}) {
  const {
    text = '', filters = [], sort, offset = 0, limit = DEFAULT_LIMIT,
  } = partial;
  return {
    text: String(text || ''),
    filters: filters.map(normalizeFilter).filter((f) => f.values.length || VALUELESS_TYPES.has(f.type)),
    sort: normalizeSort(sort),
    offset: Number(offset) || 0,
    limit: Number(limit) || DEFAULT_LIMIT,
  };
}

function normalizeSort(sort) {
  if (!sort) return { ...DEFAULT_SORT };
  const field = SORT_FIELDS.includes(sort.field) ? sort.field : DEFAULT_SORT.field;
  const direction = sort.direction === 'asc' ? 'asc' : 'desc';
  return { field, direction };
}

// ── URL codec ────────────────────────────────────────────────────────────────
//
// Provider-neutral, so a shared link restores the same filters regardless of which
// provider is active. Readable where it can be (`q`, `sort`, `limit`); the structured
// filters ride in one `filters` param as compact JSON (URI-encoded), which round-trips
// metadata paths, tag ids, and MIME types that contain `:` `/` `,` without delimiter
// collisions. `offset` is intentionally never written — paging is not part of a shared
// view (matches the pre-refactor behaviour of stripping p.offset from the URL).

/** SearchRequest → URLSearchParams (offset omitted). */
export function encodeRequest(request) {
  const params = new URLSearchParams();
  const req = createRequest(request);
  if (req.text) params.set('q', req.text);
  if (req.filters.length) {
    // Store the semantic fields; the id is recomputed on decode as `${type}:${field}`
    // and only carried explicitly (`i`) when it differs from that default (e.g. a path
    // filter, or an author-set id to disambiguate duplicates).
    const compact = req.filters.map((f) => {
      const entry = {
        t: f.type, f: f.field, o: f.op, v: f.values, m: f.match,
      };
      if (f.id && f.id !== `${f.type}:${f.field}`) entry.i = f.id;
      if (hasMeta(f.meta)) entry.x = f.meta;
      return entry;
    });
    params.set('filters', JSON.stringify(compact));
  }
  if (req.sort.field !== DEFAULT_SORT.field || req.sort.direction !== DEFAULT_SORT.direction) {
    params.set('sort', `${req.sort.field}:${req.sort.direction}`);
  }
  if (req.limit !== DEFAULT_LIMIT) params.set('limit', String(req.limit));
  return params;
}

/** URL search string (or URLSearchParams) → SearchRequest. Unknown/garbled parts are ignored. */
export function decodeRequest(search) {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(search || '');
  const partial = { filters: [] };
  const q = params.get('q');
  if (q) partial.text = q;

  const raw = params.get('filters');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        partial.filters = parsed.map((c) => normalizeFilter({
          id: c.i, type: c.t, field: c.f, op: c.o, values: c.v, match: c.m, meta: c.x,
        }));
      }
    } catch {
      // Malformed filters param — ignore rather than throw (degrade to no filters).
    }
  }

  const sort = params.get('sort');
  if (sort) {
    const [field, direction] = sort.split(':');
    partial.sort = { field, direction };
  }
  const limit = params.get('limit');
  if (limit) partial.limit = parseInt(limit, 10);

  return createRequest(partial);
}

function hasMeta(meta) {
  return meta && typeof meta === 'object' && Object.keys(meta).length > 0;
}

// ── Block authoring helpers ───────────────────────────────────────────────────
//
// Filter blocks emit value inputs carrying the filter's descriptor as a
// `data-asc-filter` attribute; the service's collectRequest() reads it back. These
// helpers keep the attribute shape in one place so blocks never hand-build it.

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * HTML attribute string for a filter value input. Drop straight into markup:
 *   `<input ... ${filterAttrs(descriptor)}>`
 * The descriptor's `values` are supplied at runtime by the input state, so only the
 * identity/shape (id/type/field/op/match/meta) is encoded here.
 *
 * @param {object} descriptor  { id, type, field, op, match, meta }
 * @param {object} [opts]
 * @param {'lower'|'upper'} [opts.bound]  for daterange inputs, which bound this input sets
 */
export function filterAttrs(descriptor, { bound } = {}) {
  const {
    id, type, field = '', op = 'equals', match = 'any', meta = {},
  } = descriptor;
  const payload = {
    id: id || `${type}:${field}`, type, field, op, match, ...(hasMeta(meta) ? { meta } : {}),
  };
  const attr = `data-asc-filter="${escapeAttr(JSON.stringify(payload))}"`;
  return bound ? `${attr} data-asc-bound="${bound}"` : attr;
}

/**
 * Hydration helper: the values (and date bounds) for one filter id from a URL.
 * Blocks use it to restore their checked/selected/date state on load.
 *
 * @param {string} id
 * @param {string|URLSearchParams} [search=window.location.search]
 * @returns {{ values: string[], bounds: { lower?: string, upper?: string } }}
 */
export function decodeInitialFilter(id, search = window.location.search) {
  const request = decodeRequest(search);
  const filter = request.filters.find((f) => f.id === id);
  if (!filter) return { values: [], bounds: {} };
  if (filter.type === 'daterange') {
    return { values: filter.values, bounds: { lower: filter.values[0], upper: filter.values[1] } };
  }
  return { values: filter.values, bounds: {} };
}

/** The free-text query from a URL (for search-bar hydration). */
export function decodeInitialText(search = window.location.search) {
  return decodeRequest(search).text;
}

/** The sort { field, direction } from a URL (for search-bar hydration). */
export function decodeInitialSort(search = window.location.search) {
  return decodeRequest(search).sort;
}
