---
layout: page
title: QueryBuilder Predicates
permalink: /querybuilder
sidebar:
  - label: QueryBuilder
    items:
      - title: Overview
        url: "#overview"
      - title: basePredicates
        url: "#base-predicates"
      - title: Search config sheet
        url: "#search-sheet"
      - title: Search blocks → params
        url: "#search-blocks"
  - label: Predicates
    items:
      - title: Structural
        url: "#structural"
      - title: Property matching
        url: "#property"
      - title: Date filtering
        url: "#dates"
      - title: Path / content
        url: "#path"
      - title: Full-text / type
        url: "#fulltext"
      - title: Tagging
        url: "#tagging"
      - title: DAM / assets
        url: "#dam"
      - title: Access control
        url: "#access"
---

# QueryBuilder Predicates

Reference for the AEM QueryBuilder search provider. All predicates listed here are
supported — parameters are forwarded to the QueryBuilder API verbatim.

> **Upstream reference:** [AEM QueryBuilder Predicate Reference](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates)

---

## Overview {#overview}

The QueryBuilder provider (`scripts/asc/services/search/providers/querybuilder.js`)
translates search block form data directly into QueryBuilder URL parameters. Every
`<input name="X">` in a search block becomes the predicate `X=value` in the API call.

**Priority (lowest → highest):**

1. Hardcoded provider defaults (`type=dam:Asset`, `mainasset=true`, `orderby=dam:created`)
2. `basePredicates` from `configurations.js` — static always-on filters
3. Form data — user search input always wins

---

## Static filters with basePredicates {#base-predicates}

Use `basePredicates` in `configurations.js` to set predicates that apply to **every**
query, regardless of what the user searches for. They are overridden by form input,
so it is safe to use them for baseline constraints.

```js
// scripts/configurations.js
search: {
  provider: 'querybuilder',
  basePredicates: {
    // Only approved assets
    'property':         'jcr:content/metadata/dam:status',
    'property.value':   'approved',

    // Exclude sub-asset nodes
    'excludepaths':     '.*subassets.*',

    // Modified in the last 30 days
    'relativedaterange.property':   'jcr:content/jcr:lastModified',
    'relativedaterange.lowerBound': '-30d',
  },
},
```

---

## Search config sheet — content-author static predicates {#search-sheet}

`configurations.search.sheet` (default `/asc`) points to a da.live workbook. `SearchService` lazily fetches the `search-predicates` sheet (`{sheet}.json?sheet=search-predicates`) on first search and merges it into every query — a third tier between `basePredicates` and live form data, editable by content authors without touching `configurations.js`.

Sheet format — two columns:

| name | value |
|------|-------|
| `path` | `/content/dam/brand` |
| `notexpired.property` | `jcr:content/metadata/dam:expirationDate` |
| `1000_group.property` | `jcr:content/metadata/dam:status` |
| `1000_group.property.value` | `approved` |

- **`name`** — full QB predicate name; include a group prefix (`1000_group.*`) when grouping is needed
- **`value`** — predicate value

Both the QueryBuilder and OpenAPI providers receive the merged sheet params through the normal form-data flow — OpenAPI translates them via its existing predicate mapping (below). `SearchService.searchSilent(formData)` also applies sheet predicates, so blocks that run outside the search page's DOM (like `details-similar`) get them too.

> **`search-hidden` has been replaced** by this config sheet — page-specific always-on filters are now authored here rather than as a hidden block on the page.

---

## Search blocks → QueryBuilder params {#search-blocks}

Search block inputs map to QB predicates by their `name` attribute. The block
author controls the name; the QueryBuilder API receives it unchanged.

| Block | What it produces |
|-------|-----------------|
| `search-bar` | `fulltext=<value>` (plus view/sort/order preferences, applied client-side) |
| `search-property` | `property=<path>` + `property.value=<value>` (block-configured) |
| `search-tags` | `tagid=cq:tags` + `tagid.N_value=<tag>` entries |
| `search-date-range` | `daterange.property=<path>` + `daterange.lowerBound`/`upperBound` |
| `search-path` | `path=<dam-path>` |

Custom search blocks can use any predicate name as the input `name` attribute — the
provider passes everything through.

---

## Structural predicates {#structural}

### group / N_group

Nest predicates into AND or OR groups.

```
group.p.or=true          Any predicate in the group matches (OR logic)
group.p.not=true         Negate the group
group.N_<predicate>      Multiple instances — e.g. group.1_property, group.2_property
```

In a search block, use numbered prefix notation:

```html
<input name="group.p.or" value="true" type="hidden">
<input name="group.1_fulltext" value="mountains">
<input name="group.2_fulltext" value="ocean">
```

### orderby

| Parameter | Values | Description |
|-----------|--------|-------------|
| `orderby` | `@jcr:title`, `dam:created`, `dc:modified` … | Sort field. Prefix with `@` for JCR properties. |
| `orderby.sort` | `asc` \| `desc` | Sort direction |
| `orderby.case` | `ignore` | Case-insensitive sort |
| `N_orderby` | — | Multi-property sort: `1_orderby`, `2_orderby` … |

---

## Property matching {#property}

### property

Matches assets where a JCR property equals (or matches) a value.

| Parameter | Description |
|-----------|-------------|
| `property` | JCR property path, e.g. `jcr:content/metadata/dam:status` |
| `property.value` | Exact value to match |
| `property.N_value` | Multiple values (`1_value`, `2_value` …) — OR by default |
| `property.and` | `true` — AND across N_value entries |
| `property.operation` | `equals` \| `unequals` \| `like` \| `not` \| `exists` |
| `property.depth` | Wildcard depth — searches `node/*/prop` at each level |

```js
basePredicates: {
  'property':           'jcr:content/metadata/dam:status',
  'property.value':     'approved',
}
```

### boolproperty

| Parameter | Description |
|-----------|-------------|
| `boolproperty` | JCR Boolean property path |
| `boolproperty.value` | `true` \| `false` |

### rangeproperty

Numeric range filter (LONG, DOUBLE, DECIMAL properties).

| Parameter | Description |
|-----------|-------------|
| `rangeproperty.property` | Property path |
| `rangeproperty.lowerBound` | Lower bound value |
| `rangeproperty.lowerOperation` | `>` (default) \| `>=` |
| `rangeproperty.upperBound` | Upper bound value |
| `rangeproperty.upperOperation` | `<` (default) \| `<=` |
| `rangeproperty.decimal` | `true` for Decimal properties |

---

## Date filtering {#dates}

### daterange

Filter by a DATE property interval (ISO 8601).

| Parameter | Description |
|-----------|-------------|
| `daterange.property` | DATE property path |
| `daterange.lowerBound` | Lower date — `2024-01-01` or `2024-01-01T00:00:00.000Z` |
| `daterange.lowerOperation` | `>` (default) \| `>=` |
| `daterange.upperBound` | Upper date (ISO 8601) |
| `daterange.upperOperation` | `<` (default) \| `<=` |
| `daterange.timeZone` | Timezone ID, e.g. `Europe/Berlin` |

```html
<!-- search-date-range block renders inputs like these: -->
<input name="daterange.property" value="jcr:content/jcr:lastModified" type="hidden">
<input name="daterange.lowerBound" type="date">
<input name="daterange.upperBound" type="date">
```

### relativedaterange

Offset from current server time. Useful in `basePredicates`.

| Parameter | Description |
|-----------|-------------|
| `relativedaterange.property` | DATE property path |
| `relativedaterange.lowerBound` | Offset string: `-1d`, `-6M`, `-1y`, `0` |
| `relativedaterange.upperBound` | Offset string: `1h`, `1d`, `now` |

```js
// Only assets from the last 90 days
basePredicates: {
  'relativedaterange.property':   'jcr:content/jcr:lastModified',
  'relativedaterange.lowerBound': '-90d',
}
```

### dateComparison

Compare two DATE properties against each other.

| Parameter | Description |
|-----------|-------------|
| `dateComparison.property1` | First property path |
| `dateComparison.property2` | Second property path |
| `dateComparison.operation` | `=` \| `!=` \| `>` \| `>=` |

### notexpired

Require a DATE property to be in the future (asset not yet expired).

| Parameter | Description |
|-----------|-------------|
| `notexpired.property` | DATE property path, e.g. `jcr:content/offTime` |

---

## Path / content {#path}

### path

Restrict search to a DAM folder.

| Parameter | Description |
|-----------|-------------|
| `path` | DAM folder path, e.g. `/content/dam/brand` |
| `path.exact` | `true` = exact path only; `false` (default) = full subtree |
| `path.flat` | `true` = direct children only |

### excludepaths

Exclude paths matching a regex.

| Parameter | Description |
|-----------|-------------|
| `excludepaths` | Regex string, e.g. `.*subassets.*` or `.*\.pdf` |

### nodename

Filter by JCR node name with wildcards.

| Parameter | Description |
|-----------|-------------|
| `nodename` | Node name pattern — supports `*`, `?`, `[abc]` |

### savedquery

Include predicates from a persisted QueryBuilder query node.

| Parameter | Description |
|-----------|-------------|
| `savedquery` | Path to the saved query node or String property |

### contentfragment

Restricts results to Content Fragments. Any value activates it.

```
contentfragment=true
```

---

## Full-text / type {#fulltext}

### fulltext

Full-text search across indexed text.

| Parameter | Description |
|-----------|-------------|
| `fulltext` | Search term(s) |
| `fulltext.relPath` | Restrict to a property or sub-node, e.g. `@jcr:title` |

### type

Restrict to a JCR node type or mixin.

```
type=dam:Asset       (default in ASC)
type=dam:AssetContent
```

### language

Restrict to an AEM page language.

| Parameter | Description |
|-----------|-------------|
| `language` | ISO language code, e.g. `de`, `fr` |

### similar

Similarity search — finds assets similar to a given asset based on shared metadata.

| Parameter | Description |
|-----------|-------------|
| `similar` | Path to the reference asset node |
| `similar.fields` | Space-separated property paths to compare |
| `similar.local` | Descendant path for similarity node (default: `.`) |

Used by the `details-similar` block to surface related assets.

---

## Tagging {#tagging}

### tag

Filter by tag title path.

| Parameter | Description |
|-----------|-------------|
| `tag` | Tag title path, e.g. `properties:orientation/landscape` |
| `tag.property` | Tag property (default: `cq:tags`) |
| `tag.N_value` | Multiple tags — `1_value`, `2_value` … |
| `tag.and` | `true` → all tags must match |

### tagid

Filter by tag ID.

| Parameter | Description |
|-----------|-------------|
| `tagid` | Tag ID |
| `tagid.property` | Tag property (default: `cq:tags`) |
| `tagid.N_value` | Multiple tag IDs |
| `tagid.and` | `true` → all tag IDs must match |

The `search-tags` block uses `tagid` predicates. Inputs render as:

```
tagid=cq:tags
tagid.1_value=<first selected tag>
tagid.2_value=<second selected tag>
```

### tagsearch

Filter by keyword in tag titles (not the tag ID — the display title).

| Parameter | Description |
|-----------|-------------|
| `tagsearch` | Keyword to search in tag titles |
| `tagsearch.property` | Tag property (default: `cq:tags`) |
| `tagsearch.lang` | Restrict to a specific locale |
| `tagsearch.all` | `true` = search all tag text fields |

---

## DAM / assets {#dam}

### mainasset

| Parameter | Description |
|-----------|-------------|
| `mainasset` | `true` = main assets only; `false` = sub-assets only |

ASC sets `mainasset=true` by default. Override in `basePredicates` to include sub-assets.

### memberOf

Filter to members of a Sling Resource Collection.

| Parameter | Description |
|-----------|-------------|
| `memberOf` | Collection path, e.g. `/content/dam/collections/brand-kit` |

---

## Access control {#access}

### hasPermission

Require specific JCR privileges on each result node. Results without the privilege
are silently excluded.

| Parameter | Description |
|-----------|-------------|
| `hasPermission` | Comma-separated privilege names, e.g. `jcr:write,jcr:modifyAccessControl` |

```js
// Only show assets the current user can modify
basePredicates: {
  'hasPermission': 'jcr:write',
}
```
