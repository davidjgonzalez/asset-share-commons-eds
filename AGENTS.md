# AGENTS — ASC Developer Reference

This file documents conventions, extension points, and architecture decisions for AI coding assistants and developers working in this repository. It is intentionally comprehensive — use it as the authoritative reference when modifying ASC code.

---

## Ownership Boundary

| Path | Owner | Rule |
|------|-------|------|
| `scripts/configurations.js` | **You** | Edit freely — the single customization entry point |
| `scripts/asc/` | **ASC core** | Do not edit — replace the whole folder on upgrades |
| `blocks/` | **You** | Copy and modify blocks as needed |
| `styles/` | **You** | Add themes, override CSS variables |
| `component-definition.json` | **You** | Universal Editor component library |
| `component-models.json` | **You** | Universal Editor field definitions |
| `component-filters.json` | **You** | Universal Editor containment rules |

Every file inside `scripts/asc/` starts with `// ASC Core — do not edit.` as a guard.

---

## Block Inventory

### Search blocks
| Block | Purpose | Provider-aware? |
|-------|---------|----------------|
| `search-bar` | Keyword text search input | No — emits `fulltext`, handled by all providers |
| `search-property` | Metadata property filter (checkbox / radio / dropdown) | Via QB `property` predicate; OpenAPI maps via `PROPERTY_MAP` |
| `search-path` | DAM path filter (checkbox / radio / dropdown) | Via QB `path` predicate; OpenAPI maps `filter[assetAncestorPath]` |
| `search-date-range` | Date range filter (from/to date inputs) | Via QB `daterange` predicate; OpenAPI maps via `DATE_PROPERTY_MAP` |
| `search-tags` | Tag filter (checkbox / radio / dropdown) | Via QB `tagid` predicate; OpenAPI maps `filter[assetTagIds][]` |
| `search-hidden` | Hidden fixed search parameters | Passed through to provider as-is |
| `search-statistics` | Displays result counts ("Showing N of M assets") | No — reads `asc:search:complete` event |
| `search-results` | Infinite-scroll results grid with sort/layout controls | No — renders assets from `asc:search:complete` |

### Details blocks (used on details fragment pages)
| Block | Purpose |
|-------|---------|
| `details-modal` | Modal dialog shell; auto-injected by `AssetDetails` service |
| `details-preview` | Asset preview (image / video / PDF) |
| `details-property` | Displays a single metadata property |
| `details-download` | Lists renditions as download links |
| `details-actions` | Action buttons: add-to-cart, download, share |

### Collections / cart blocks
| Block | Purpose |
|-------|---------|
| `stub` | Cart bar — shows cart count and link to download sheet |
| `sheet` | Full download sheet page (reads assets + renditions from URL params) |
| `collections` | Lists all named collections |
| `collection` | Single collection view |

---

## Custom Events — Full Reference

All ASC custom events follow `asc:{noun}:{verb}`. Dispatched on `document` unless noted.

| Event | Dispatched by | Listened to by | `detail` shape |
|-------|--------------|----------------|----------------|
| `asc:search:execute` | All search filter blocks, search-results | SearchService | `{ form?, type?, source? }` |
| `asc:search:complete` | SearchService | search-results, search-statistics | `{ results, type, formData }` |
| `asc:search:error` | SearchService | (custom handlers) | `{ error, formData }` |
| `asc:asset:details:open` | Actions service | AssetDetails service | `{ data: { ascAsset } }` |
| `asc:asset:details:close` | Actions service | AssetDetails service, details-modal | — |
| `asc:asset:preload` | Actions service | Init service | `{ data: { ascPreload } }` |
| `asc:asset:share` | Actions service | (custom handler) | `{ data: { ascAsset } }` |
| `asc:collection:add` | Actions service | Collections service | `{ data: { ascAsset, ascCollection } }` |
| `asc:collection:remove` | Actions service | Collections service | `{ data: { ascAsset, ascCollection } }` |
| `asc:collection:update` | Collections service | collections, stub blocks | `{ collectionId, assetId, action }` |
| `asc:blocks:loaded` | Init service | SearchService | `{ blocks }` |

`asc:search:complete` `results` shape:
```js
{
  assets: Asset[],  // hydrated Asset model instances
  total: number,    // total matching assets (for pagination display)
  size: number,     // assets in this batch
  offset: number,   // current offset
  more: boolean,    // more pages available
  success: boolean,
}
```

---

## Data Attributes — Full Reference

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `data-asc-action` | `noun:verb@eventType [...]` | Declarative event binding via Actions service. Space-separated for multiple. |
| `data-asc-asset` | UUID string | Asset identity — propagated through the DOM tree for event handlers |
| `data-asc-collection` | collection ID string | Collection reference (e.g. `"cart"`) |
| `data-asc-preload` | URL path | Path prefetched on hover when `init.preload` is true |
| `data-asc-fieldset` | fieldset ID string | Groups a search input with its supporting inputs (for `cleanFormData` dependency logic) |

### Actions system

The Actions service listens to DOM events globally, parses `data-asc-action`, fires a matching `CustomEvent` on `document.body`, and passes all `data-*` attributes collected up the DOM tree as `event.detail.data`:

```html
<!-- fires asc:collection:add on click, passing ascAsset and ascCollection -->
<button data-asc-action="collection:add@click"
        data-asc-asset="uuid-here"
        data-asc-collection="cart">Add to Cart</button>

<!-- fires two events from one element -->
<article data-asc-action="asset:details:open@click asset:preload@mouseover"
         data-asc-asset="uuid-here">...</article>
```

---

## Search Provider Abstraction

Search blocks emit **QueryBuilder-native field names** (e.g. `{n}_group.daterange.lowerBound`). Both providers read this form data — the QueryBuilder provider passes it as-is; the OpenAPI provider's `buildParams()` performs a two-pass QB→OpenAPI translation.

### Form field naming convention

All search block inputs carry `form="asc-search-form"` so `SearchService.collectFormData()` picks them up. Field names follow the QB group naming pattern:

```
{groupNum}_group.{predicateName}.{paramKey}
```

Where `groupNum` is the block's DOM position (1-based), `predicateName` is the QB predicate (e.g. `daterange`, `tagid`, `property`, `path`), and `paramKey` is the predicate parameter.

### OpenAPI provider predicate mapping

`OpenApiProvider.buildParams()` performs a two-pass scan:

**Pass 1** — groups all `{n}_group.*` form entries by group number and predicate name.

**Pass 2** — maps known predicates:

| QB predicate | OpenAPI filter param | Notes |
|-------------|----------------------|-------|
| `daterange.lowerBound` + `.property` | `filter[createdAt\|modifiedAt][from]` | Property mapped via `DATE_PROPERTY_MAP` |
| `daterange.upperBound` + `.property` | `filter[createdAt\|modifiedAt][to]` | Same mapping |
| `tagid.N_value` | `filter[assetTagIds][]` | Each selected tag appended |
| `property.N_value` + `.property=dc:format` | `filter[assetFormat][]` | Via `PROPERTY_MAP` |
| `path.N_value` | `filter[assetAncestorPath]` | Direct mapping |
| `fulltext` | `q` | Top-level, not a predicate group |

`DATE_PROPERTY_MAP` and `PROPERTY_MAP` are static getters on `OpenApiProvider` — extend them there to support additional JCR property → OpenAPI filter mappings.

### Adding a custom search provider

```js
// scripts/asc/services/search/providers/my-provider.js
import SearchProvider from '../search-provider.js';

export default class MyProvider extends SearchProvider {
  async search(formData) {
    // formData: Map of all form field names → values (QB-style)
    // Must return: { assets: Asset[], total, size, offset, more, success }
  }

  buildParams(formData) {
    // Return URLSearchParams for this provider's API
    return new URLSearchParams({ ... });
  }

  async getAssetById(id) { ... }
}
```

Register in `scripts/asc/services/search/search.js`:
```js
const PROVIDERS = {
  querybuilder: QueryBuilderProvider,
  openapi: OpenApiProvider,
  'my-provider': MyProvider,
};
```

Activate in `scripts/configurations.js`:
```js
search: { provider: 'my-provider' }
```

---

## Parts — Interface Specification

Parts are **plain exported functions** that return HTML strings. They are not blocks — they have no `decorate()` and are never loaded independently by EDS.

```js
// scripts/asc/parts/my-part/my-part.js
// ASC Core — do not edit. Customize via scripts/configurations.js
import { loadCSS } from '../../../aem.js';

loadCSS('/scripts/asc/parts/my-part/my-part.css');

/**
 * @param {Asset}  asset
 * @param {object} [options]
 * @returns {string} HTML string
 */
export default function myPart(asset, options = {}) {
  return `<div class="asc-my-part" data-asc-asset="${asset.uuid}">...</div>`;
}
```

Rules:
- **No classes, no constructors** — a Part is a function, not a class.
- **No event binding inside the Part** — all events use `data-asc-action` on the HTML, handled globally by the Actions service.
- **CSS class prefix**: `.asc-{part-name}` (not `.block.*`).
- Each Part loads its own CSS via `loadCSS()` at import time.

Usage in a block:
```js
import assetTeaser from '../../scripts/asc/parts/asset-teaser/asset-teaser.js';

export default async function decorate(block) {
  const assets = /* ... */;
  block.querySelector('[data-asc-results]').innerHTML =
    assets.map((asset) => assetTeaser(asset)).join('');
}
```

The `Part` base class in `scripts/asc/parts/part.js` exists as documentation only — do not extend it.

---

## Search Utility — Shared Helpers

`scripts/asc/utils/search.js` exports helpers used by all search filter blocks:

### `readBlockConfig(block, transform, defaults)`
Wraps the EDS `readBlockConfig` and adds search-specific context:
- `form` — the search form ID (`"asc-search-form"`)
- `group` — the block's DOM position index (used for QB group numbering)
- `field` — the full QB field name for this block's predicate
- `parameter(key, index?)` — builds a fully-qualified QB parameter name
- `fieldset` — the fieldset ID for dependency grouping
- `initial` — initial values parsed from the current URL's query params

### `addSearchEventListeners(block, config)`
Wires all interactive inputs in a filter block (checkboxes, radios, date inputs, selects) to dispatch `asc:search:execute` on change. **All search filter blocks must use this** instead of writing their own change listeners.

```js
import { readBlockConfig, addSearchEventListeners } from '../../scripts/asc/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {}, { name: 'myfilter', ... });
  block.innerHTML = html(config);
  addSearchEventListeners(block, config);
}
```

---

## How To: Add a Custom Property

Custom properties extend what `asset.getProperty('name')` returns. Used in `details-property` blocks.

In `scripts/configurations.js`:
```js
properties: {
  custom: {
    'brand': (asset) => asset.getProperty('jcr:content/metadata/myco:brand'),
    'approval-status': (asset, options) => {
      const status = asset.getProperty('jcr:content/metadata/dam:status');
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : null;
    },
  }
}
```

Then in a `details-property` block, set `property = brand`.

---

## Rendition System

The renditions system is the client-side equivalent of ASC v1's `AssetRenditionDispatcher`. It resolves download URLs for each asset based on definitions in `configurations.js`. Three rendition types map to the AEM delivery patterns:

| Type | AEM v1 equivalent | When to use |
|------|------------------|-------------|
| `static` | `StaticRenditionDispatcher` | JCR rendition nodes (`jcr:content/renditions/*`); works on any AEM |
| `url` | `ExternalRedirectRenderer` | **Legacy DM / Scene7 IS/IR protocol** (`is/image/` URLs); AEM 6.5 or classic DM |
| `asset-delivery` | `AssetDeliveryRenditionDispatcher` | **DM with OpenAPI** — plain transforms, smart crops (`?smartcrop=`), named presets (`?imagePreset=`); AEMaaCS only |

**Key distinction — two different DM delivery systems:**

| | Legacy DM (Scene7 / IS-IR) | DM with OpenAPI (Next Gen) |
|---|---|---|
| **AEM version** | AEM 6.5 or AEMaaCS with classic DM | AEMaaCS only |
| **Rendition type** | `url` with `${dm.*}` variables | `asset-delivery` with `params` |
| **URL pattern** | `{dm.apiServer}is/image/{dm.file}:CropName` | `{deliveryHost}/adobe/dynamicmedia/deliver/{uuid}/file.jpg?smartcrop=CropName` |
| **Asset identifier** | `dam:scene7File` metadata property | UUID |
| **Smart crop syntax** | `:CropName` (IS/IR path segment) | `?smartcrop=CropName` (query param) |
| **Named preset syntax** | `?$presetName$` | `?imagePreset=presetName` |

### Template variables for `type: 'url'`

| Variable | Resolves to | JCR metadata path |
|----------|------------|-------------------|
| `${asset.path}` | JCR path | — |
| `${asset.name}` | Node name (filename) | — |
| `${asset.id}` | UUID | — |
| `${asset.extension}` | File extension | — |
| `${asset.title}` | Display title | `dc:title` |
| `${dm.name}` | Scene7 asset name | `dam:scene7Name` |
| `${dm.id}` | Scene7 asset ID | `dam:scene7ID` |
| `${dm.file}` | Scene7 file path | `dam:scene7File` |
| `${dm.folder}` | Scene7 folder | `dam:scene7Folder` |
| `${dm.domain}` | Scene7 domain | `dam:scene7Domain` |
| `${dm.apiServer}` | Scene7 API server URL | `dam:scene7APIServer` |

### `accepts` filter

Controls which asset types a rendition applies to:
- Omit → all assets
- MIME glob string: `'image/*'`, `'video/*'`, `'application/pdf'`
- Function: `(asset) => asset.getProperty('dam:scene7File') != null`

### `visible` flag

`visible: false` hides a rendition from the download list while keeping it available via `services.renditions.getRendition(asset, id)`. Use for the `thumbnail` rendition, which is used internally by teasers but shouldn't appear as a download option.

### How To: Add a Custom Rendition

```js
// scripts/configurations.js
renditions: {
  definitions: [
    // ── Static (any AEM) ──────────────────────────────────────────────────
    { id: 'thumbnail', label: 'Thumbnail', type: 'static', name: /^cq5dam\.thumbnail\./, visible: false },
    { id: 'web',       label: 'Web',       type: 'static', name: /^cq5dam\.web\./,       accepts: 'image/*' },
    { id: 'original',  label: 'Original',  type: 'static', name: 'original' },

    // ── Legacy DM / Scene7 IS-IR protocol (AEM 6.5 or classic DM) ────────
    // Variables resolve from dam:scene7* metadata on the asset.
    {
      id: 'dm-web-preset',
      label: 'Web',
      type: 'url',
      url: '${dm.apiServer}is/image/${dm.file}?$web$',
      accepts: (asset) => !!asset.getProperty('dam:scene7File'),
    },
    {
      id: 'dm-smart-crop-small',        // ":Small" IS/IR syntax
      label: 'Smart Crop — Small',
      type: 'url',
      url: '${dm.apiServer}is/image/${dm.file}:Small',
      accepts: (asset) => !!asset.getProperty('dam:scene7File'),
    },

    // ── DM with OpenAPI / Asset Delivery (AEMaaCS only) ──────────────────
    // Requires aem.deliveryHost. Uses UUID — no dam:scene7* metadata needed.
    {
      id: 'web-optimized',
      label: 'Web Optimized',
      type: 'asset-delivery',
      params: 'format=webp&preferwebp=true&width=1200&quality=85',
      accepts: 'image/*',
    },
    {
      id: 'smart-crop-small',           // "?smartcrop=" OpenAPI syntax
      label: 'Smart Crop — Small',
      type: 'asset-delivery',
      params: 'smartcrop=Small',
      accepts: 'image/*',
    },
    {
      id: 'dm-preset-web',              // Named image preset
      label: 'Web Preset',
      type: 'asset-delivery',
      params: 'imagePreset=web',
      accepts: 'image/*',
    },
  ],
}
```

### Service API

```js
import services from '../../scripts/asc/services/services.js';

services.renditions.getRenditions(asset);          // all renditions for asset
services.renditions.getRendition(asset, 'web');    // single rendition by id
services.renditions.getThumbnailUrl(asset);        // best thumbnail URL (with fallback)
```

---

## How To: Add a Custom Theme

1. Create `styles/themes/my-theme.css`:
```css
.theme-my-theme {
  --background-color: #f5f5f0;
  --text-color: #1a1a1a;
  --link-color: #c44b0a;
  /* Override any CSS variable from styles/tokens.css */
}
```

2. In `scripts/configurations.js`:
```js
theme: { default: 'my-theme' }
```

The `scripts/scripts.js` `loadEager()` function reads this value, adds `theme-{name}` to `<body>`, and loads `styles/themes/{name}.css`. Built-in themes: `default`, `dark`, `warm`, `studio`, `vault`.

---

## Universal Editor

The project ships three JSON files at the project root for Universal Editor support:

| File | Purpose |
|------|---------|
| `component-definition.json` | Component library (palette) — three groups: Search, Asset Details, Collections |
| `component-models.json` | Sidebar field definitions for each block |
| `component-filters.json` | Containment rules — what blocks can go in which sections |

To activate page-level filters (e.g. `asc-details-page`), add `data-aue-filter="asc-details-page"` to the `<main>` element of the page template.

---

## Block Event Scoping Summary

| Scope | Delegate to | Use case |
|-------|-------------|----------|
| Search events | `document` | `asc:search:execute`, `asc:search:complete` |
| Cross-block / service events | `document.body` | `asc:asset:details:open`, `asc:collection:add`, etc. |
| Block-local events | The block's `.block` element | Events that only affect one block instance |

---

## CSS Conventions (see `docs/CSS_CONVENTION.md` for full guide)

- Root selector: `.block.<block-name> { ... }` — never a bare class
- CSS nesting for children and modifiers
- All colors, spacing, radius, shadow via CSS variables from `styles/tokens.css`
- Mobile-first: `@media (width >= 768px)` syntax
- Part CSS scoped to `.asc-{part-name}` prefix
