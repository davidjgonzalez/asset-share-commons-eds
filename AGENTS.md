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
| `details-modal` | Modal dialog shell; auto-injected by `AssetDetails` service. Close button floats top-right; the loaded fragment supplies its own header |
| `details-header` | Title + meta-subtitle bar. Authored content is a **token template** — `{{ accessor }}` / `{{ accessor \| fallback }}` resolved against the asset (see Token Placeholders below) |
| `details-preview` | Asset preview **media only** (image / video / PDF). Title/metadata/actions live in sibling blocks, arranged by the section layout |
| `details-property` | Displays a single metadata property (label + value; `pill` variant → badge) |
| `details-metadata` | A panel of property rows (`asc-ui-metadata`). Rows are `Label \| property-key`; `display: list\|grid`; array values (e.g. `tags`) render as `asc-ui-chip` pills |
| `details-renditions` | Renditions as an `asc-ui-table` with **author-configurable columns** (Title \| `{{ }}` value) and a rendition row list. See "Renditions Table Templates" below |
| `details-actions` | Action buttons (`asc-ui-action` circle-icon + label): download, collection-toggle (add/remove), share. `actions` config sets which/order |

### Collections / cart blocks
| Block | Purpose |
|-------|---------|
| `stub` | Cart bar — shows active collection count and link to download sheet |
| `sheet` | Full download sheet page (reads assets + renditions from URL params; also accepts `title` and `description` params) |
| `collections` | Collections index/management page — list, create, delete, activate |
| `collection` | Collection detail/edit page — rename, reorder assets, remove assets, share URL, download |
| `collection-switcher` | Persistent header widget — active collection dropdown, inline create, navigate to /collections |

---

## Section Layouts — Named-Area Grid (`layout: grid`)

A general, author-driven grid paradigm for sections, modeled on CSS `grid-template-areas`.
Lets authors arrange blocks into a 2-D layout from **section metadata**, with each block
declaring which cell it occupies — no per-layout CSS required.

> ⚠️ **Boilerplate modification — `scripts/scripts.js`.** This feature adds an import and one
> call to `decorateMain()`:
>
> ```js
> import decorateGridLayouts from './section-grid.js';
> // …
> export function decorateMain(main) {
>   decorateButtons(main);
>   decorateIcons(main);
>   buildAutoBlocks(main);
>   decorateSections(main);
>   decorateBlocks(main);
>   decorateGridLayouts(main);   // ← ASC addition: must run AFTER decorateBlocks,
>                                //    BEFORE blocks render (loadSection/loadBlock)
> }
> ```
>
> `scripts.js` is boilerplate (not `scripts/asc/`), so **re-apply these two edits after any EDS
> boilerplate upgrade.** The logic itself lives in the user-owned `scripts/section-grid.js`; the
> styling in `styles/sections/grid-layout.css` (imported by `styles.css`). Because `decorateMain`
> also runs for fragments loaded via `loadFragment` (e.g. the asset-details modal), grid layouts
> work inside the modal too.

**Authoring** (section metadata):

| Section Metadata |                    |
|------------------|--------------------|
| layout           | grid               |
| areas            | preview actions    |
|                  | preview metadata   |
| columns          | 1.5fr 1fr          |
| rows             | auto auto (opt)    |
| gap              | 2rem (opt)         |

- `areas` — one line per grid row (lines may also be separated by `/`, `\|`, or `,`). Repeat an
  area name across cells to make a block span them. The example makes `preview` span both rows
  on the left, with `actions` over `metadata` on the right.
- `columns` — optional track sizing. **If omitted, defaults to equal `1fr` columns** (`repeat(N,
  minmax(0,1fr))`) derived from the widest areas row.
- `rows` — optional. **If omitted, defaults to `auto 1fr`** (first row content-sized, the rest
  flexible). A block spanning the full column height (like `preview`) crosses the flexible track,
  so the content rows stay content-sized and the other column's blocks **pack to the top** instead
  of spacing evenly. Set `rows` explicitly to override.
- `gap` — optional. A named token (`xs`|`s`|`m`|`l`|`xl`) maps to the theme `--spacing-*` scale; a
  raw length (e.g. `1.5rem`) passes through.
- Collapses to a single stacked column below 768px (named placement is dropped → source order).

**Block placement** — each block claims a cell with an `area` config row:

```
| details-preview |         |
| area            | preview |
```

`scripts/section-grid.js` (called from `decorateMain`, before blocks render) reads the section
metadata into `--grid-areas` / `--grid-columns` / `--grid-cols` / `--grid-rows` / `--grid-gap`
custom properties, and **strips each block's `area` row** (so it never reaches the block's own
config) onto the wrapper as `--grid-area`. `grid-layout.css` turns those into the grid.

### Token Placeholders (`details-header`)

`details-header` treats authored text as a template. Tokens: `{{ accessor }}` or
`{{ accessor | fallback }}`. `accessor` resolves via `Asset.getProperty()` (so `title`,
`file-type`, `file-size`, `dimensions`, `description`, or raw keys like `dc:format`), with
computed getters layered on (`url`, `uuid`, `filename`, `file-extension`). Empty values fall
back to the text after `|`; dangling ` · ` separators are trimmed automatically.

### Renditions Table Templates (`details-renditions`)

The `details-renditions` block lists an asset's renditions as table rows with author-configurable
columns. Authoring (da.live):

```
| details-renditions |                 |
| renditions  | original, web         |   ← optional row list (by name); omit = all,
|             |                       |     "original" first then A→Z
| Name        | name                  |   ← column: Title | value
| File size   | file-size             |
| W x H       | dimensions            |
|             | download, share       |   ← value of action keyword(s) → icon buttons
```

- **Values** resolve against the **current rendition**; the owning asset is reachable via
  `asset.…`. A value is either a bare path (`name`, `file-size`) or contains `{{ }}` tokens for
  mixed text (`{{ width }}×{{ height }}`).
- **Rendition fields / aliases**: `name`, `label`, `url`, `format`, `file-type`, `file-size`
  (formatted), `dimensions`, `width`, `height`, `mimeType`, `filename`.
- **Asset paths**: `asset.properties.title`, `asset.renditions['web'].url`, or a bare term →
  `asset.getProperty('…')`. Well-known asset sub-objects: `properties`, `renditions`.
- **Path syntax**: dot (`a.b`), bracket (`a['b']`, `a[b]`), nesting combine.
- **Action columns**: a column whose value is one or more known action keywords
  (`download`, `share`) renders icon buttons (right-aligned) instead of text — `download` is a
  rendition download link; `share` dispatches `asc:rendition:share`.

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
| `asc:collection:change` | Collections service | collections, stub, collection-switcher blocks | `{ action, id?, collectionId?, assetId?, userId?, source? }` |
| `asc:collection:created` | Collections service | (UI handlers) | `{ collection }` |
| `asc:collection:deleted` | Collections service | (UI handlers) | `{ id }` |
| `asc:collection:activated` | Collections service | (UI handlers) | `{ id, previous }` |
| `asc:download:started` | Downloads service | (UI handlers) | `{ jobId }` |
| `asc:download:complete` | Downloads service | collection block | `{ jobId, downloadUrl }` |
| `asc:download:failed` | Downloads service | collection block | `{ jobId, error }` |
| `asc:download:change` | Downloads service | (UI handlers) | `{ jobId, status }` |
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
| `data-asc-collection` | collection ID string | Collection reference — UUID of the target collection, or omit to use the active collection |
| `data-asc-preload` | URL path | Path prefetched on hover when `init.preload` is true |
| `data-asc-fieldset` | fieldset ID string | Groups a search input with its supporting inputs (for `cleanFormData` dependency logic) |

### Actions system

The Actions service listens to DOM events globally, parses `data-asc-action`, fires a matching `CustomEvent` on `document.body`, and passes all `data-*` attributes collected up the DOM tree as `event.detail.data`:

```html
<!-- fires asc:collection:add on click, passing ascAsset (collection defaults to active) -->
<button data-asc-action="collection:add@click"
        data-asc-asset="uuid-here">Add to Collection</button>

<!-- fires asc:collection:add targeting a specific collection by ID -->
<button data-asc-action="collection:add@click"
        data-asc-asset="uuid-here"
        data-asc-collection="collection-uuid-here">Add to Named Collection</button>

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

### `collectionToggle(asset, options?)`

Renders an add/remove collection toggle button. Both states are rendered simultaneously; CSS hides the inactive one based on `data-in-collection`. State is hydrated asynchronously after render and updated on every `asc:collection:change` event — including active collection switches.

```js
import collectionToggle from '../../scripts/asc/parts/collection-toggle/collection-toggle.js';

// Default — labels use {name} token replaced with the active collection name
container.insertAdjacentHTML('beforeend', collectionToggle(asset));

// Custom labels
container.insertAdjacentHTML('beforeend', collectionToggle(asset, {
  addLabel: 'Save to {name}',
  removeLabel: 'Saved to {name} ✓',
}));

// Target a specific collection
container.insertAdjacentHTML('beforeend', collectionToggle(asset, { collectionId: 'uuid' }));
```

| Option | Default | Description |
|--------|---------|-------------|
| `addLabel` | `'Add to {name}'` | Add button label; `{name}` is replaced with the active collection name |
| `removeLabel` | `'Remove from {name}'` | Remove button label |
| `collectionId` | active collection | Target a specific collection instead of the active one |

The Part registers a single global `asc:collection:change` listener at import time that keeps all `.asc-collection-toggle` instances on the page in sync — no per-block wiring needed.

---

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

## Property System

`asset.getProperty(name)` dispatches through the properties service. Built-in properties:

| Name | Returns |
|------|---------|
| `title` | `dc:title` |
| `thumbnail` | Thumbnail URL string |
| `file-type` | Human label: "JPEG", "PDF", etc. |
| `file-size` | Formatted: "1.2 MB" |
| `file-extension` | Extension string |
| `dimensions` | `{ width, height }` object |
| `width` / `height` | Individual pixel values |
| `mime-type` | Raw MIME type string |
| `modified` | `lastModified.toLocaleDateString()` |
| `created` | `created.toLocaleDateString()` |
| `description` | `dc:description` |
| `filename` | Node filename |

All built-in names are also valid in `searchResults.views` (see below).

### Adding a custom property

```js
// scripts/configurations.js
properties: {
  custom: {
    'brand': (asset) => asset.getProperty('jcr:content/metadata/myco:brand'),
    'approval-status': (asset) => {
      const s = asset.getProperty('jcr:content/metadata/dam:status');
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
    },
  }
}
```

Custom property names can then be used in `details-property` blocks and in `searchResults.views`.

---

## Search Result Views — `searchResults.views`

Controls which properties are displayed in each view mode. Configured in `scripts/configurations.js`.

```js
searchResults: {
  views: {
    // Cards view: ordered array of property names
    cards: ['thumbnail', 'title', 'file-type', 'file-size'],

    // Masonry view: keep minimal — meta overlays on hover
    masonry: ['thumbnail', 'title'],

    // List view: columns with label and width
    list: [
      { property: 'thumbnail',  width: '48px'  },
      { property: 'title',      width: '1fr'   },
      { property: 'file-type',  label: 'Type',  width: '120px' },
      { property: 'file-size',  label: 'Size',  width: '90px'  },
      { property: 'modified',   label: 'Date',  width: '120px' },
      // Any registered custom property:
      { property: 'brand',      label: 'Brand', width: '120px' },
      // Escape hatch for complex rendering:
      { label: 'Status', width: '80px', render: (asset) => asset.getProperty('dam:status') || '—' },
    ],
  },
},
```

**Rules:**
- `thumbnail` always renders as `<img>` in the preview area; all other properties go in the meta section
- For `list`, `label` defaults to a sensible built-in name if omitted
- The `render` function on a list column receives `(asset, services)` and should return an HTML string; it bypasses the property system entirely

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

## UI Kit (`.asc-ui-*`)

Reusable, theme-driven UI primitives shared across blocks, parts, and templates.
**Before writing new block CSS, reuse a kit primitive.** Full catalog with copy-paste
markup: [`docs/UI_KIT.md`](docs/UI_KIT.md). Visual gallery (themed, with per-element
code/usage): [`/ui-kit.html`](ui-kit.html). Styles: [`styles/ui-kit.css`](styles/ui-kit.css)
(each primitive tagged `@kit <name>` for grepping).

Primitives: `asc-ui-card`, `asc-ui-badge`, `asc-ui-chip`, `asc-ui-empty-state`,
`asc-ui-skeleton`, `asc-ui-spinner`, `asc-ui-segmented`, `asc-ui-switch`, `asc-ui-field`,
`asc-ui-search`, `asc-ui-control`/`asc-ui-dropdown`, `asc-ui-collection-card`,
`asc-ui-asset-row`, `asc-ui-table`, `asc-ui-masonry`, `asc-ui-icon-btn`, plus the
typography helpers. Foundational `.btn`, form fields, `.asc-panel`, and `.asc-dialog`
live in `styles.css` (documented below).

When a block needs a primitive to look different, add a variant *to the kit* (and document
it) rather than overriding it inside the block.

---

## Button Utilities (`.btn`)

Global utility classes defined in `styles/styles.css`. Use these for all component buttons — not EDS editorial `a.button:any-link`.

```html
<!-- Variants -->
<button class="btn btn--primary">Save</button>
<button class="btn btn--secondary">Cancel</button>
<button class="btn btn--ghost">Dismiss</button>
<button class="btn btn--danger">Delete</button>

<!-- Size modifier -->
<button class="btn btn--primary btn--sm">Small</button>

<!-- Icon button (square, circular) -->
<button class="btn btn--ghost btn--icon" aria-label="Close">✕</button>
```

| Class | Appearance |
|-------|-----------|
| `.btn` | Base: `inline-flex`, padded, border-radius, transitions |
| `.btn--primary` | `--color-primary` background, `--color-primary-fg` text |
| `.btn--secondary` | Transparent + `--color-border` border |
| `.btn--ghost` | Transparent, no border |
| `.btn--danger` | `--color-destructive` background |
| `.btn--sm` | Smaller padding and `--body-font-size-xs` |
| `.btn--icon` | Fixed 36×36px square, `--border-radius-full` |

Focus: automatic `outline` using `--color-ring` via `:focus-visible`.

---

## Modal Pattern (native `<dialog>`)

Use the native `<dialog>` element for all modals. Add `class="asc-dialog"` for the shared base styles.

```js
// Open
const dialog = document.createElement('dialog');
dialog.className = 'asc-dialog my-block__dialog';
dialog.setAttribute('aria-labelledby', 'my-dialog-title');
dialog.innerHTML = `
  <h2 id="my-dialog-title" class="asc-dialog__title">Dialog Title</h2>
  <div class="asc-dialog__body">...</div>
  <footer class="asc-dialog__footer">
    <button class="btn btn--secondary" data-close-dialog>Cancel</button>
    <button class="btn btn--primary">Confirm</button>
  </footer>`;
document.body.append(dialog);

// Show
dialog.showModal();

// Close on backdrop click
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

// Close on [data-close-dialog]
dialog.addEventListener('click', (e) => { if (e.target.closest('[data-close-dialog]')) dialog.close(); });
```

`::backdrop` is styled globally in `styles/styles.css` with a semi-transparent overlay.

---

## How To: Add a Custom Theme

Themes override only the `--color-*` semantic tokens (and optionally `--body-font-family`). **Never** override structural tokens like spacing, border-radius, or shadow in a theme file.

Built-in themes: `default` (Violet Studio), `dark` (Deep Ocean), `studio` (Unsplash). `warm` and `vault` are removed.

1. Create `styles/themes/my-theme.css`:
```css
.theme-my-theme {
  /* ── Required color roles ─────────────────────────────────────────── */
  --color-bg:             #f5f5f0;
  --color-fg:             #1a1a1a;
  --color-card:           #ffffff;
  --color-card-fg:        #1a1a1a;
  --color-primary:        #c44b0a;   /* Action color */
  --color-primary-fg:     #ffffff;   /* Text ON primary */
  --color-secondary:      #eeece8;
  --color-secondary-fg:   #1a1a1a;
  --color-muted:          #f0ede8;   /* Subtle backgrounds */
  --color-muted-fg:       #6b6560;   /* Secondary text */
  --color-accent:         #fce8dd;   /* Hover tints */
  --color-accent-fg:      #c44b0a;
  --color-destructive:    #dc2626;
  --color-destructive-fg: #ffffff;
  --color-border:         #ddd8d0;
  --color-input:          #ffffff;
  --color-ring:           #c44b0a;   /* Focus outline */

  /* ── Optional overrides ──────────────────────────────────────────── */
  --body-font-family: Georgia, serif;

  /* For dark themes, override the select chevron to a light color: */
  /* --select-arrow: url("data:image/svg+xml,..."); */
}
```

### Semantic token reference

| Token | Role |
|-------|------|
| `--color-bg` | Page background |
| `--color-fg` | Default text |
| `--color-card` / `--color-card-fg` | Card surface / text |
| `--color-popover` / `--color-popover-fg` | Dropdown/tooltip surface / text |
| `--color-primary` / `--color-primary-fg` | Primary action (buttons, links, badges) / text on primary |
| `--color-secondary` / `--color-secondary-fg` | Secondary surface / text |
| `--color-muted` / `--color-muted-fg` | Subtle background / secondary text |
| `--color-accent` / `--color-accent-fg` | Hover tint backgrounds / text |
| `--color-destructive` / `--color-destructive-fg` | Danger/delete actions / text |
| `--color-border` | All borders and dividers |
| `--color-input` | Form input backgrounds |
| `--color-ring` | Focus outline color |

2. In `scripts/configurations.js`:
```js
theme: { default: 'my-theme' }
```

The `scripts/scripts.js` `loadEager()` function reads this value, adds `theme-{name}` to `<body>`, and loads `styles/themes/{name}.css`.

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

## Collections Service

`scripts/asc/services/collections/collections.js` — singleton exported from `services.js` as `services.collections`.

### Storage schema

Stored under `storage.get('collections')` (user-scoped):

```js
{
  defaultId: "uuid",     // permanent default collection — never deleted
  items: {
    "uuid": {
      id:         string,  // crypto.randomUUID()
      name:       string,
      createdAt:  ISO string,
      modifiedAt: ISO string,
      assetIds:   string[]
    }
  }
}
```

The **active collection** ID is stored separately under `storage.get(storage.ACTIVE_COLLECTION_ID)`. `null` means use `defaultId`.

### API

```js
import services from '../../scripts/asc/services/services.js';
const { collections } = services;

// CRUD
collections.create(name)           // → Collection (not hydrated)
collections.delete(id)             // default collection is protected
collections.rename(id, name)

// Getters  (hydrateAssets=true adds an `assets: Asset[]` array)
await collections.getAll(hydrateAssets?)          // → Collection[]
await collections.get(id, hydrateAssets?)         // → Collection | null
await collections.getDefault(hydrateAssets?)      // → Collection
await collections.getActive(hydrateAssets?)       // → Collection
      collections.getActiveId()                   // → string (UUID)
      collections.setActive(id)

// Asset management (collectionId defaults to active collection)
await collections.addAsset(assetId, collectionId?)
await collections.removeAsset(assetId, collectionId?)
await collections.hasAsset(assetId, collectionId?)   // → boolean

// Asset reordering
      collections.reorderAssets(collectionId, newAssetIds) // replace full ordered array

// Login / merge / logout
await collections.loginAs(userId)  // merges anonymous → user, switches context
      collections.logout()         // switches back to anonymous scope
```

### Events dispatched on `document`

| Event | When | `detail` shape |
|-------|------|----------------|
| `asc:collection:change` | Any mutation or cross-tab sync | `{ action, id?, collectionId?, assetId?, userId?, source? }` |
| `asc:collection:created` | New collection created | `{ collection }` |
| `asc:collection:deleted` | Collection deleted | `{ id }` |
| `asc:collection:activated` | Active collection changed | `{ id, previous }` |

`action` values in `asc:collection:change`: `"created"`, `"deleted"`, `"renamed"`, `"activated"`, `"assetAdded"`, `"assetRemoved"`, `"reordered"`, `"login"`, `"logout"`, or `"external"` (cross-tab).

---

## Downloads Service

`scripts/asc/services/downloads/downloads.js` — singleton. Manages asynchronous AEM bulk-download jobs with localStorage persistence.

### Storage schema

Stored under `storage.get(storage.DOWNLOAD_JOBS)` (user-scoped):

```js
{
  jobs: {
    "local-uuid": {
      id:           string,    // local UUID
      collectionId: string,    // source collection ID
      assetPaths:   string[],  // JCR asset paths
      renditionIds: string[],  // rendition IDs to download
      status:       string,    // 'pending' | 'running' | 'complete' | 'failed'
      aemJobId:     string,    // job ID returned by AEM download framework
      downloadUrl:  string,    // URL to trigger on completion
      error:        string,    // error message (if failed)
      createdAt:    ISO,
      updatedAt:    ISO,
      expiresAt:    ISO,       // auto-cleaned after jobExpiry ms (default 7 days)
    }
  }
}
```

### API

```js
import services from '../../scripts/asc/services/services.js';
const { downloads } = services;

// Initiate an async AEM download job (returns immediately; polling runs in background)
await downloads.create(assetPaths, renditionIds, { collectionId?, autoDownload?: true });

// Retrieve jobs
downloads.getAll()         // → job[]  (sorted newest first)
downloads.get(jobId)       // → job | null

// Resume polling for a job that didn't finish within the quick-poll window
await downloads.resume(jobId, autoDownload?)

// Trigger a browser download for a completed job
downloads.triggerDownload(jobId)
```

### Events dispatched on `document`

| Event | When | `detail` shape |
|-------|------|----------------|
| `asc:download:started` | Job created locally | `{ jobId }` |
| `asc:download:complete` | AEM job finished, URL available | `{ jobId, downloadUrl }` |
| `asc:download:failed` | AEM job failed or fetch error | `{ jobId, error }` |
| `asc:download:change` | Any job status update | `{ jobId, status }` |

### Configuration (`configurations.downloads`)

| Key | Default | Description |
|-----|---------|-------------|
| `initiateUrl` | `/content/dam.downloads.initiateDownload.json` | AEM download servlet path |
| `quickPollTimeout` | `15000` | Fast-poll window in ms before leaving job as 'running' |
| `pollInterval` | `2000` | Poll interval in ms |
| `jobExpiry` | `604800000` (7 days) | Job TTL in ms — older jobs are auto-removed |

---

## Storage Service

`scripts/asc/services/storage/storage.js` — singleton. Provides user-scoped and global localStorage management.

### Key constants (available as `storage.KEY_NAME`)

| Constant | Key | Scope |
|----------|-----|-------|
| `COLLECTIONS` | `"collections"` | user |
| `ACTIVE_COLLECTION_ID` | `"activeCollectionId"` | user |
| `RECENTLY_VIEWED` | `"recentlyViewed"` | user |
| `THEME` | `"theme"` | global |
| `SHARED_LINKS` | `"sharedLinks"` | global |

### API

```js
import storage from '../../scripts/asc/services/storage/storage.js';

// User-scoped
storage.get(key)          // → value | null
storage.set(key, value)
storage.remove(key)

// Global (shared across users)
storage.getGlobal(key)
storage.setGlobal(key, value)
storage.removeGlobal(key)

// Domain helpers
storage.addRecentlyViewed(uuid)      // prepends, deduplicates, caps at 50
storage.getRecentlyViewed()          // → string[]
storage.getTheme()                   // → string | null
storage.setTheme(name)
storage.addSharedLink(url, label?)   // prepends, deduplicates by URL
storage.getSharedLinks()             // → { url, label, receivedAt }[]

// Cross-tab sync
storage.onExternalChange(callback)   // fires callback on StorageEvent for asc:* keys
storage.mergeUserData(fromId, toId)  // merges recentlyViewed (used by loginAs)
```

### localStorage structure

```
asc        → { currentUserId, theme, sharedLinks }
asc:anonymous → { user, collections, activeCollectionId, recentlyViewed }
asc:user123   → { user, collections, activeCollectionId, recentlyViewed }
```

---

## URL Service

`scripts/asc/services/url/url.js` — singleton. URL helpers for asset lists.

```js
import url from '../../scripts/asc/services/url/url.js';

// Build a shareable URL encoding a list of asset UUIDs
const shareUrl = await url.toCollectionUrl(assetIds, { param: 'assets', base?: string });

// Decode asset UUIDs from a URL
const assetIds = await url.fromCollectionUrl(window.location.search, 'assets');

// Low-level compression
const encoded = await url.compressArray(['uuid1', 'uuid2']);
const values  = await url.decompressToArray(encoded);
```

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
- **Colors**: use `--color-*` semantic tokens from `styles/styles.css` `:root` (e.g. `--color-primary`, `--color-muted-fg`, `--color-border`). Do not use `--background-color`, `--text-color`, etc. — those are backward-compat aliases for EDS boilerplate only.
- **Spacing, radius, shadow, transitions**: `--spacing-*`, `--border-radius-*`, `--shadow-*`, `--transition-*` from `styles/tokens.css`
- **Typography**: `--body-font-size-s/xs`, `--heading-font-size-s/m/l/xl` — do not use `--font-size-sm` or `--radius-md` (old names, removed)
- Mobile-first: `@media (width >= 768px)` syntax
- Part CSS scoped to `.asc-{part-name}` prefix
- Themes in `styles/themes/` override `--color-*` tokens only — never structural tokens
