# Content Variables — `{{ }}` Token System

ASC supports a `{{ }}` token syntax in authored da.live content. Authors write templates in
headings, paragraphs, links, block table cells, and even the page's `<title>` / meta
description; at runtime a block resolves each token and writes the final string back into the
DOM.

All resolution shares one engine (`scripts/asc/tokens.js`), but there are **two ways to feed it
values**, depending on what kind of data your block has. Pick the right one — see
"Which system should my block use?" below.

---

## Syntax

```
{{ accessor }}
{{ accessor | fallback }}
```

- `accessor` — the property/token name to resolve
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

This part is shared by both systems below — it's all implemented by one function,
`resolveTokens(template, context)`.

---

## Which system should my block use?

| Your block... | Use |
|---|---|
| Hydrates **one** piece of page-level data (a collection, a shared sheet, a config value) and wants `{{ns.*}}` tokens resolved in *authored content anywhere on the page* — including `<title>`/meta description | **Page-wide registry** — `registerTokens(context)` |
| Renders **many** independent items, each needing tokens resolved against *its own* context (e.g. one Asset per card in a grid) | **Direct resolution** — `resolveTokens(template, context)` / `resolveTokensInElement(el, context)` |

---

## System 1 — Page-wide registry: `registerTokens(context)`

```js
import { registerTokens } from '../../scripts/asc/tokens.js';
```

`registerTokens(context)`:

1. Merges `context` (a plain `{ 'ns.key': value, ... }` object) into a single page-wide registry.
2. (Re)scans the **entire document** — `<head>` and `<body>`, any section, `<title>`,
   `meta[content]`, headings, paragraphs, links — for any `{{...}}` occurrence not yet recorded.
3. Re-resolves **every** recorded occurrence against the full merged registry.

Safe to call repeatedly and from multiple blocks. Later values for the same accessor simply
overwrite earlier ones (call it again after a rename, a fetch completing, etc. to refresh
what's on screen). An accessor nothing has registered yet just doesn't resolve — it renders
empty (or its `| fallback`) until something registers it. There's no ordering dependency
between whichever blocks end up supplying values, and a token whose namespace doesn't apply to
the current page (e.g. `{{sheet.title}}` on a collection page) is never touched, because nothing
on that page ever registers it.

Because the scan covers the whole document, this is also how `{{collection.title}}` /
`{{sheet.title}}` resolve when authored into the page's `<title>` or
`<meta name="description">` — no special-casing needed, it's the same mechanism.

### Namespace your keys

Registry keys are a single flat namespace, so **always prefix your keys** (`myThing.title`, not
`title`) to avoid collisions with other blocks' tokens on the same page.

### Callers today

| Caller | When | Keys registered |
|---|---|---|
| `ascDecorateMain()` (`scripts/asc.js`) | Before block decoration | Every URL search param, keyed by its own name (e.g. `?fulltext=mountains` → `{{fulltext}}`) |
| `collection-controls` block | After collection data is hydrated; again on rename / item add-remove | `collection.title`, `collection.description`, `collection.count`, `collection.lastUpdated` |
| `sheet-controls` block | After the `?sheet=` payload is decoded | `sheet.title`, `sheet.description`, `sheet.count`, `sheet.expiresAt` |

### Adding tokens to a new block

```js
// my-widget.js
import { registerTokens } from '../../scripts/asc/tokens.js';

export default async function decorate(block) {
  const data = await fetchMyWidgetData();
  registerTokens({
    'my-widget.title': data.title,
    'my-widget.count': String(data.items.length),
  });
  // ...render the block itself...
}
```

Then anywhere on the same page (usually in an authored heading/paragraph in the same section):

```
{{my-widget.title}}
{{my-widget.count}} items
```

Call `registerTokens()` again whenever the underlying data changes (e.g. on a re-render after
a mutation) — it always re-resolves from the *original* authored template, never from
already-resolved text, so there's no risk of double-resolving or losing the template.

### Authoring example — collection page

```
← Collections            [link to /collections/]
{{collection.title}}     [H1]
{{collection.description}}
{{collection.count}} assets — Last updated {{collection.lastUpdated}}

| collection-controls |
| past-shares | Past Shares | ghost     |
| edit        | Edit        | ghost     |
| share       | Share       | secondary |
| download    | Download    | primary   |
```

### Authoring example — sheet page

```
← Back to search           [link to /]
{{sheet.title}}            [H1]
{{sheet.description}}
{{sheet.count}} assets — Expires {{sheet.expiresAt|Never}}

| sheet-controls |
| download  | Download  | primary   |
| copy-link | Copy Link | secondary |
```

### Authoring example — page `<head>`

Since the scan covers the whole document, the same tokens work in page metadata (set via
da.live's page Title / Description properties, which the EDS pipeline renders into `<head>`):

```
Title:       {{sheet.title}}
Description: {{sheet.description}}
```

### Authoring example — URL params

```
URL: /search?fulltext=mountains
Token: {{fulltext}}  →  "mountains"
```

---

## System 2 — Direct resolution: `resolveTokens()` / `resolveTokensInElement()`

```js
import { resolveTokens, resolveTokensInElement } from '../../scripts/asc/tokens.js';
```

Use this when your block renders **many** independent contexts that shouldn't share one global
registry — most notably, one `Asset` instance per card/row. `details-header` and
`details-renditions` both use this: each resolves its own authored template against the one
asset (or rendition) it currently owns.

- `resolveTokens(template, context)` — resolves a single string, returns the resolved string.
- `resolveTokensInElement(el, context)` — walks all text nodes inside `el` and resolves each
  one in place.

`context` can be an `Asset` instance, a **namespace map**, or any plain object.

### Namespaced accessors — `{{ns.accessor}}`

Pass a namespace map — `{ asset }`, `{ asset, rendition }`, etc. — when a template needs to
pull from more than one "thing." `{{asset.title}}` against `{ asset }` switches to the `asset`
value and resolves `title` against it, using the same resolution order as a direct context
(below). This is how one card template can say exactly what a token is scoped to:

```js
resolveTokensInElement(cardEl, { asset });
```

```
{{asset.title}} · {{asset.file-size}}
```

The namespace switch only fires when `context[ns]` is itself an object — a flat string value
(like the page-wide registry's `'collection.title'` key) is never mistaken for a namespace, so
this is purely additive and doesn't change any existing template's behavior.

Accessor resolution order (applies after any namespace switch resolves down to a single
context object):

1. **Computed getters** — checked first, always available regardless of metadata
2. **`context.getProperty(accessor)`** — if `context` exposes a `getProperty` method (e.g. `Asset`)
3. **`context[accessor]`** — plain object property lookup (this is what the page-wide registry
   uses internally, since its `context` is just a flat key→value map)

`details-renditions` also runs on this engine now. Its column values resolve against the
**current rendition**'s context object, which carries its own `asset` key — so
`{{asset.title}}` switches into the asset exactly like the card example above. The asset side of
that switch still needs domain-specific rules `resolveTokens` itself doesn't know about
(`asset.properties.*` and `asset.renditions['id']` are keyword sub-paths, not real nested
objects, and rendition lookups prefer the configured rendition **definition** over a raw array
find). Rather than teaching the generic engine asset vocabulary, `details-renditions.js` wraps
the asset in a small local object exposing one `getProperty(path)` method — the namespace switch
hands the whole remaining path (e.g. `renditions['web'].url`) to that method in one call, and it
resolves the rest using its own (unchanged) path-walking logic. See `assetResolver()` in
`blocks/details-renditions/details-renditions.js` for the implementation, and `AGENTS.md` →
"Renditions Table Templates" for the full accessor list. One behavior change from folding this
in: `{{ accessor | fallback }}` fallback syntax now works in rendition templates too — it didn't
before.

### Computed getters (Asset)

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

Properties registered in `scripts/asc/configurations.js` under `properties.custom` are also
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

### Authoring examples

**Minimal — title only:**

```
| details-header |
| {{ title }}    |
```

**Full header with fallback:**

```
| details-header                                                           |
| {{ title | Untitled Asset }}                                             |
| {{ file-type }} · {{ file-size }} · {{ modified | date unknown }}        |
```

**UUID in subtitle (for debugging / asset ID display):**

```
| details-header        |
| {{ title }}           |
| ID: {{ uuid }}        |
```

**Custom property:**

```
| details-header                                        |
| {{ title }}                                           |
| {{ brand | Unbranded }} · {{ file-type }} · {{ file-size }} |
```

---

## Value coercion

Both systems share the same coercion step before a value is inserted into the template:

| Value type | Output |
|---|---|
| `null` / `undefined` | `""` (empty — fallback applies if set) |
| String | As-is, trimmed |
| Array | Items joined with `, ` (empty items filtered out) |
| `{ width, height }` object | `"width × height"` |
| Other object | `""` (empty) |

---

## Related files

| File | Purpose |
|---|---|
| `scripts/asc/tokens.js` | Shared implementation — `resolveTokens`, `resolveTokensInElement`, `registerTokens` |
| `scripts/asc.js` | Calls `registerTokens()` with URL params in `ascDecorateMain()` |
| `blocks/collection-controls/collection-controls.js` | Page-registry example — `collection.*` |
| `blocks/sheet-controls/sheet-controls.js` | Page-registry example — `sheet.*` |
| `blocks/details-header/details-header.js` | Direct-resolution example — asset context |
| `blocks/details-renditions/details-renditions.js` | Namespace-map example — `asset.*` via `assetResolver()`'s `getProperty` wrapper |
| `scripts/asc/core/models/asset.js` | `Asset.getProperty()` and computed getters |
| `scripts/asc/core/services/properties/` | Custom property handler registration |
| `scripts/asc/configurations.js` | Register `properties.custom` handlers |
| `AGENTS.md` → "Token Placeholders" | Shorter summary for AI assistant context |
