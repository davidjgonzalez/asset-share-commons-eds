# Search Filters — the provider-neutral model

ASC search is **provider-neutral**. Blocks and callers describe *what* to search for; a
`SearchProvider` translates that into the concrete API call (AEM QueryBuilder, Dynamic Media
OpenAPI, or a custom provider). No provider syntax (QB predicate names, OpenAPI `filter[...]`
keys) exists outside a provider.

## The request

`scripts/asc/core/services/search/request.js` defines the model:

```js
SearchRequest = {
  text,                          // free-text query ('' when none)
  filters: [FilterDescriptor],   // structured filters
  sort: { field, direction },    // neutral sort
  offset, limit,                 // paging (offset is never serialized to the URL)
}

FilterDescriptor = {
  id,       // stable identity; defaults to `type:field`
  type,     // 'property' | 'path' | 'daterange' | 'tags' | 'color' | 'similar' | …
  field,    // metadata field the filter acts on ('' for types like path)
  op,       // 'equals' | 'in' | 'under' | 'between' | …
  values,   // always an array
  match,    // 'any' (OR, default) | 'all' (AND)
  meta,     // type-specific extras ({ exact, flat } for path, etc.)
}
```

Neutral sort vocabulary: `relevance | created | modified | title`.

## How a filter block participates

A filter block renders its value inputs with the descriptor attached, using the helpers from
`request.js`:

```js
import { filterAttrs, decodeInitialFilter } from '.../core/services/search/request.js';

const filterId = config.id || `property:${config.property}`;        // deterministic default
const descriptor = { id: filterId, type: 'property', field: config.property, op: 'equals' };
const initial = decodeInitialFilter(filterId);                      // hydrate from the URL

// in markup — each value input:
`<input type="checkbox" value="image/jpeg"
        ${initial.values.includes('image/jpeg') ? 'checked' : ''}
        ${filterAttrs(descriptor)} form="asc-search-form">`
```

- All inputs carry `form="asc-search-form"`; `SearchService.collectRequest()` reads them.
- Inputs sharing a descriptor `id` accumulate their values into one filter.
- Date inputs add `data-asc-bound="lower|upper"` so the two bounds land in `values[0]`/`values[1]`.
- A deterministic `filterId` (`type:field`) means a shared URL restores the filter without the
  URL having to carry the id. Author an `id` row only to disambiguate two filters on one field
  (then the id is carried in the URL automatically).

search-bar is the exception: its text input uses `data-asc-search-text`, and its sort controls use
`data-asc-search-sort` / `data-asc-search-dir`.

## How a provider translates

Each provider owns a **translator registry** keyed by neutral filter type:

```js
export default class QueryBuilderProvider extends SearchProvider {
  static id = 'querybuilder';
  static translators = {
    property: (filter, { group }) => {
      const base = `${group}_group.property`;
      return [[`${base}.property`, filter.field], [`${base}.operation`, filter.op],
        ...filter.values.map((v, i) => [`${base}.${i}_value`, v])];
    },
    // …path, tags, daterange, similar
  };
  applyScaffold(params, request) { /* base params, text, sort, paging */ }
}
```

`buildRequest()` (in the base class) runs `applyScaffold()` then calls one translator per filter.
A filter whose type has **no translator for the active provider** is skipped with a
`console.warn` — never silently dropped. That is how `similar` (QueryBuilder only) and `color`
(OpenAPI only) degrade on the other provider.

### Adding a new filter type or predicate

To support a QueryBuilder predicate that isn't wired yet (e.g. `rangeproperty`, `nodename`), or a
brand-new neutral type:

1. Emit the descriptor from a block (or build it in a request): `{ type: 'myType', … }`.
2. Add a translator entry per provider that supports it — either in the provider's
   `static translators`, or, without editing core, from configurations.js:

```js
search: {
  translators: {
    querybuilder: {
      myType: (filter, { group }) => [[`${group}_group.myType`, filter.values[0]]],
    },
    openapi: {
      myType: (filter) => [['filter[myKey]', filter.values[0]]],
    },
  },
}
```

A custom entry whose key matches a built-in type overrides it. This mirrors
`renditions.resolvers` and `search.providers`.

## Built-in filter type coverage

The neutral model is a curated capability vocabulary, not a 1:1 mirror of QueryBuilder. These
types ship with translators; add more on demand (one entry per provider).

| Neutral type | QueryBuilder | OpenAPI | Shape |
|---|---|---|---|
| `fulltext` (request `text`) | `fulltext` | `q` | — |
| `property` | `property` | `filter[*]` for mapped fields, else warn | `field`, `values`, `match` |
| `tags` | `tagid` | `filter[assetTagIds][]` | `field`, `values`, `match` |
| `path` | `path` / OR'd paths | `filter[assetAncestorPath]` | `values`, `meta:{exact,flat}` |
| `daterange` | `daterange` | `filter[createdAt\|modifiedAt][from/to]` | `field`, `values:[lower,upper]` |
| `relativedaterange` | `relativedaterange` | resolved to absolute `from/to` | `field`, `values:[lower,upper]` e.g. `-30d`,`now` |
| `color` | — (warn) | `filter[color]` | `values:[hex]` |
| `similar` | `similar` (MLT) | — (warn) | `values:[path]`, `meta:{fields}` |
| `range` | `rangeproperty` | — (warn) | `field`, `values:[min,max]`, `meta:{lowerOp,upperOp}` |
| `boolproperty` | `boolproperty` | — (warn) | `field`, `values:[true\|false]` |
| `nodename` | `nodename` | — (warn) | `values:[glob]` |
| `excludepaths` | `excludepaths` | — (warn) | `values:[regex]` |
| `notexpired` | OR group (future-dated OR unset) | — (warn) | `field` (expiration date property), no values |
| sort | `orderby` + `orderby.sort` | `sort=field:dir` | `relevance\|created\|modified\|title` |
| paging | `p.offset` / `p.limit` | `p.offset` / `p.limit` | request `offset`/`limit` |

OOTB QueryBuilder predicates not yet mapped (e.g. `contentfragment`, `hasPermission`,
`savedquery`, raw structural groups) are a one-entry translator away when a block needs them.

## Baseline filters

Developer- and author-set filters applied to every search, ahead of the visitor's own:

- **`configurations.search.baseFilters`** — an array of neutral descriptors (code).
- **The `search-filters` sheet** in the `search.sheet` workbook — author-editable
  (`type | field | op | values | match`, `values` pipe-separated).
- **The `search-hidden` block** — pushes neutral descriptors onto `services.search.baseFilters`.

## The URL

The browser URL uses the neutral codec, independent of the active provider:

```
?q=beach&filters=[{"t":"property","f":"jcr:content/metadata/dc:format","o":"equals","v":["image/jpeg"],"m":"any"}]&sort=modified:desc
```

`q`, `sort`, and `limit` are plain; `filters` is compact JSON (so metadata paths / tag ids with
`:` `/` round-trip safely). Offset is never written. A filter's `id` is carried (`i`) only when it
differs from the `type:field` default. Because the encoding is neutral, a shared link restores the
same filters whichever provider is configured.

> This replaced the previous model where blocks emitted QueryBuilder predicate strings directly.
> URLs produced under that model do not restore (clean break — the project was pre-launch).
