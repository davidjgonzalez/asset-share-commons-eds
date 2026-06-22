# QueryBuilder Predicates Reference

AEM Cloud Service OOTB predicates for use in search filter blocks, `configurations.js`
`search.basePredicates`, and `search.preprocessQuery`.

**Source:** https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates

---

## How Predicates Map to URL Parameters

QueryBuilder uses numbered group prefixes:

```
?1_group.property=jcr:content/metadata/dc:format
&1_group.property.value=image/jpeg
&1_group.p.or=true
```

In ASC filter blocks, `readBlockConfig` generates the group prefix automatically based
on block position. Inside `configurations.js` (e.g. `search.basePredicates`), write raw QB
parameter names.

---

## Commonly Used Predicates

### `type`
Restricts results to a JCR node type.

```
type=dam:Asset
```

- **Always include** in ASC queries to return only assets.
- `mainasset=true` companion: filters to primary assets (excludes subassets like DM renditions).

---

### `path`
Restricts search to a subtree.

```
path=/content/dam/my-folder
path.flat=true          # only direct children (depth=1)
```

- Use `configurations.js` `search.basePredicates` to scope all searches to a specific DAM folder.
- `path.self=true` includes the root node itself.

---

### `fulltext`
Full-text search across JCR text content.

```
fulltext=beach
fulltext.relPath=jcr:content/metadata   # scope to metadata node only
```

- ASC `search-bar` block generates a `fulltext` predicate.
- Requires Lucene/Oak index; works out of the box in AEM Cloud Service.

---

### `property`
Matches an exact JCR property value.

```
property=jcr:content/metadata/dc:format
property.value=image/jpeg
property.operation=equals          # default
property.operation=unequals
property.operation=exists          # property is present
property.operation=not             # property does not exist
property.depth=2                   # search 2 nodes deep (default: 1)
```

- Multiple values: use `property.1_value`, `property.2_value` with `p.or=true`
- Case-insensitive match: `property.operation=like` with `%` wildcard

---

### `rangeproperty`
Numeric or date range on a single property.

```
rangeproperty=jcr:content/metadata/dam:assetLastModified
rangeproperty.lowerBound=1000
rangeproperty.upperBound=2000
rangeproperty.lowerOperation=>=    # default: >
rangeproperty.upperOperation=<=    # default: <
```

---

### `daterange`
Date/time range filter. Accepts ISO 8601 dates.

```
daterange.property=jcr:content/cq:lastModified
daterange.lowerBound=2024-01-01T00:00:00.000+01:00
daterange.upperBound=2024-12-31T23:59:59.000+01:00
daterange.lowerOperation=>=
daterange.upperOperation=<=
```

---

### `relativedaterange`
Date range relative to now — no absolute dates required.

```
relativedaterange.property=jcr:content/cq:lastModified
relativedaterange.lowerBound=-7d   # 7 days ago
relativedaterange.upperBound=0     # now (0 = today)
```

Units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days).

---

### `dateComparison`
Compares two date properties to each other.

```
dateComparison.property1=jcr:content/cq:lastModified
dateComparison.property2=jcr:content/cq:lastReplicated
dateComparison.operation=>=
```

---

### `tag`
Filters by one or more CQ tags.

```
tag=properties:orientation/landscape
tag.N_value=properties:orientation/landscape   # multiple tags
tag.property=jcr:content/metadata/cq:tags      # target property (default)
```

- Use `p.or=true` at the group level to OR multiple tags.
- Use multiple groups (each with a single tag) wrapped in a parent group with `p.or=false` to AND.

---

### `tagid`
Filters by exact tag UUID/ID.

```
tagid=namespace:category/value
tagid.property=jcr:content/metadata/cq:tags
```

---

### `tagsearch`
Full-text search across tag titles and descriptions.

```
tagsearch=landscape
tagsearch.property=jcr:content/metadata/cq:tags
tagsearch.lang=en                # limit to this language
tagsearch.all=true               # match all words (AND); false = OR
```

---

### `boolproperty`
Filters on a boolean JCR property.

```
boolproperty=jcr:content/metadata/my:approved
boolproperty.value=true
```

---

### `nodename`
Matches exact node name (filename for DAM assets).

```
nodename=beach.jpg
nodename=beach*                  # prefix wildcard
```

---

### `mainasset`
Filters to primary DAM assets only (excludes subassets, DM renditions, etc.).

```
mainasset=true
```

- Almost always set in ASC base predicates alongside `type=dam:Asset`.

---

### `similar`
Returns assets similar to a reference asset by comparing specified metadata fields.

```
similar=/content/dam/my-folder/image.jpg
similar.fields=jcr:content/metadata/dc:tags jcr:content/metadata/dc:format
```

- Space-separated list of fields.
- ASC `details-similar` block uses this predicate.

---

### `excludepaths`
Excludes one or more path subtrees from results.

```
excludepaths.0_value=/content/dam/archive
excludepaths.1_value=/content/dam/temp
```

---

### `hasPermission`
Returns only nodes the current user has specific JCR permissions on.

```
hasPermission.jcr:rights=read
hasPermission.jcr:rights=jcr:write
```

- Useful for surfacing only assets the current user can download or modify.
- Multiple values: comma-separated.

---

### `notexpired`
Filters out assets whose expiry date has passed.

```
notexpired.property=jcr:content/metadata/dam:expirationDate
notexpired.lowerBound=-P0D       # include today-expiring assets
```

---

### `language`
Filters on the `jcr:language` property.

```
language=en
```

---

### `memberOf`
Checks if an asset is a member of an AEM collection.

```
memberOf.collection=/content/dam/collections/my-collection
```

---

### `contentfragment`
Restricts to Content Fragment nodes.

```
contentfragment=true
contentfragment.type=my-cf-model
```

---

### `savedquery`
Includes results from a stored QueryBuilder query.

```
savedquery=/content/querybuilder/queries/my-saved-query
```

---

## Group Logic

Use numbered groups (`1_group`, `2_group`, …) to combine predicates with AND/OR.

```
# (dc:format = image/jpeg OR dc:format = image/png) AND mainasset
1_group.property=jcr:content/metadata/dc:format
1_group.property.1_value=image/jpeg
1_group.property.2_value=image/png
1_group.p.or=true
mainasset=true
```

Nested groups express complex Boolean logic:

```
# (A AND B) OR (C AND D)
1_group.1_group.property=...
1_group.1_group.property.value=A
1_group.2_group.property=...
1_group.2_group.property.value=B
2_group.1_group.property=...
# etc.
p.or=true   # OR between 1_group and 2_group
```

---

## ASC-Specific Usage Patterns

### Scope all searches to a DAM folder

In `configurations.js`:
```js
search: {
  basePredicates: {
    'path': '/content/dam/brand',
    'type': 'dam:Asset',
    'mainasset': 'true',
  }
}
```

### Base predicates for image-only search

```js
basePredicates: {
  'type': 'dam:Asset',
  'mainasset': 'true',
  '1_group.property': 'jcr:content/metadata/dc:format',
  '1_group.property.1_value': 'image/jpeg',
  '1_group.property.2_value': 'image/png',
  '1_group.property.3_value': 'image/gif',
  '1_group.property.4_value': 'image/webp',
  '1_group.p.or': 'true',
}
```

### Filter block: exclude expired assets

In `search.basePredicates`:
```js
'notexpired.property': 'jcr:content/metadata/dam:expirationDate',
```

### Filter block: tag picker

A `search-tags` block generates:
```
1_group.tag=properties:orientation/landscape
```

The ASC `search-tags` block handles the group prefix via `readBlockConfig`. Each selected
tag becomes a numbered `tag.N_value` within the group.

---

## Group number conventions

| Range | Owner |
|-------|-------|
| `1`–`n` | Filter blocks (DOM order), assigned by `getGroup(block)` via `readBlockConfig` |
| `1000`+ | Search config sheet — authors write the full prefix directly (e.g. `1000_group.property`) |

Filter blocks occupy low group numbers; use `1000`+ for sheet predicates to avoid collisions.

## Predicate Ordering Rules

1. Predicates **without** a group prefix apply globally.
2. All predicates **within** a group must share the same group prefix.
3. The `p.limit`, `p.offset`, `p.hits`, `p.nodedepth`, `p.excerpt`, `p.facets` pagination and
   facet parameters are always top-level (no group prefix).

---

## Pagination Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `p.limit` | `10` | Number of results per page |
| `p.offset` | `0` | Result offset for pagination |
| `p.hits` | `simple` | Response shape: `simple`, `selective`, `full` |
| `p.nodedepth` | `1` | Node depth included in `full` hits |
| `p.excerpt` | `false` | Include text excerpt in results |
| `p.facets` | — | Comma-separated properties to facet |
| `p.guessTotal` | `false` | Estimate total count for performance |

---

## Response Shapes (`p.hits`)

| Value | What you get |
|-------|-------------|
| `simple` | `path`, `excerpt` only |
| `selective` | named subset (specify via `p.properties`) |
| `full` | entire node tree to `p.nodedepth` |

ASC uses `p.hits=full` with `p.nodedepth=10` to fetch all metadata in one request.
