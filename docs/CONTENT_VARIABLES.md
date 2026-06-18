# Content Variables — `{{ }}` Token System

ASC blocks that render asset-specific content support a `{{ }}` token syntax in authored text.
Authors write templates in da.live tables; at runtime the block resolves each token against
the current asset and outputs the final string.

---

## Syntax

```
{{ accessor }}
{{ accessor | fallback }}
```

- `accessor` — the property name to resolve (see Accessors table below)
- `fallback` — optional literal text shown when the accessor returns an empty value

Whitespace inside `{{ }}` is ignored: `{{title}}`, `{{ title }}`, and `{{  title  }}` are all
equivalent.

Multiple tokens may appear in the same string:

```
{{ file-type }} · {{ file-size }} · {{ dimensions }}
```

**Dangling separator cleanup:** if a token resolves to an empty string (and has no fallback),
any adjacent ` · ` separators are automatically collapsed so you never get `JPEG ·  · 800×600`.
Leading and trailing ` · ` are also trimmed.

---

## Accessors

### Computed getters (resolved directly on the Asset instance)

| Accessor | Returns |
|---|---|
| `url` | Full asset URL |
| `uuid` | Asset UUID |
| `id` | Alias for `uuid` |
| `filename` | Node filename (with extension) |
| `file-extension` | File extension without dot (e.g. `jpg`) |

### Property accessors (resolved via `asset.getProperty()`)

| Accessor | Returns |
|---|---|
| `title` | `dc:title` |
| `description` | `dc:description` |
| `file-type` | Human-readable label: "JPEG", "PDF", etc. |
| `file-size` | Formatted size: "1.2 MB" |
| `mime-type` | Raw MIME type string (e.g. `image/jpeg`) |
| `dimensions` | Formatted as `width × height` (e.g. `1920 × 1080`) |
| `width` | Width in pixels |
| `height` | Height in pixels |
| `thumbnail` | Thumbnail URL |
| `modified` | Last-modified date as locale string |
| `created` | Created date as locale string |

Any raw JCR metadata key also works as an accessor (e.g. `dc:format`, `dam:assetState`).

### Custom property accessors

Properties registered in `scripts/configurations.js` under `properties.custom` are also
valid accessors:

```js
// configurations.js
properties: {
  custom: {
    'brand': (asset) => asset.getProperty('jcr:content/metadata/myco:brand'),
  }
}
```

Then in a template: `{{ brand }}` or `{{ brand | Unknown }}`.

---

## Value coercion

Before inserting into the template, values are coerced to strings:

| Value type | Output |
|---|---|
| `null` / `undefined` | `""` (empty — fallback applies if set) |
| String | As-is, trimmed |
| Array | Items joined with `, ` (empty items filtered out) |
| `{ width, height }` object | `"width × height"` |
| Other object | `""` (empty) |

---

## Blocks that support `{{ }}` tokens

### `details-header`

Authored as a da.live block table. Row 1 becomes the `<h2>` title template; row 2 becomes the
`<p>` meta subtitle template. Both rows are optional — defaults apply when omitted.

```
| details-header                                          |
| {{ title }}                                             |
| {{ file-type }} · {{ file-size }} · {{ dimensions }}    |
```

**Defaults:**
- Title row omitted → `{{ title }}`
- Meta row omitted → `{{ file-type }} · {{ file-size }} · {{ dimensions }}`

The resolved title is also applied to `document.title` as `"{title} - Asset Details"`.

### `details-renditions`

Column value cells in the renditions table also support `{{ }}` tokens. Tokens resolve against
the **current rendition** (not the asset directly), but `asset.*` paths reach the owning asset.
See `AGENTS.md` → "Renditions Table Templates" for the full rendition accessor list.

---

## Resolution order

For a given accessor, `details-header` resolves in this order:

1. **Computed getters** — `url`, `uuid`, `id`, `filename`, `file-extension` checked first
2. **`asset.getProperty(accessor)`** — all other names, including built-in properties and
   any custom properties registered in `configurations.js`

If the result is empty (null, undefined, empty string after coercion) and a `| fallback` is
present, the fallback text is used. If there is no fallback, the token produces an empty string
and adjacent ` · ` separators are cleaned up.

---

## Authoring examples

### Minimal — title only

```
| details-header |
| {{ title }}    |
```

### Full header with fallback

```
| details-header                                                           |
| {{ title | Untitled Asset }}                                             |
| {{ file-type }} · {{ file-size }} · {{ modified | date unknown }}        |
```

### UUID in subtitle (for debugging / asset ID display)

```
| details-header        |
| {{ title }}           |
| ID: {{ uuid }}        |
```

### Custom property

```
| details-header                                        |
| {{ title }}                                           |
| {{ brand | Unbranded }} · {{ file-type }} · {{ file-size }} |
```

---

## Implementation notes

Token resolution is currently implemented as a local `resolveTokens()` function inside
`blocks/details-header/details-header.js`. It is not yet a shared utility.

**Regex used for matching:**
```js
/\{\{\s*([^}|]+?)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g
```

Group 1 is the accessor; group 2 (optional) is the fallback text.

If you need `{{ }}` token support in a new block, copy the `resolveTokens()` + `assetValue()`
+ `stringifyValue()` functions from `details-header.js` until a shared utility is available.

---

## Related files

| File | Purpose |
|---|---|
| `blocks/details-header/details-header.js` | Primary implementation of token resolution |
| `scripts/asc/models/asset.js` | `Asset.getProperty()` and computed getters |
| `scripts/asc/services/properties/` | Custom property handler registration |
| `scripts/configurations.js` | Register `properties.custom` handlers |
| `AGENTS.md` → "Token Placeholders" | Shorter summary for AI assistant context |
