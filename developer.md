---
layout: page
title: Developer Reference
permalink: /developer
sidebar:
  - label: Architecture
    items:
      - title: Ownership Boundary
        url: "#ownership"
      - title: Page Lifecycle
        url: "#lifecycle"
      - title: Core Layers
        url: "#layers"
  - label: Events
    items:
      - title: Event Reference
        url: "#events"
      - title: Event Scoping
        url: "#event-scoping"
  - label: Data Attributes
    items:
      - title: Attribute Reference
        url: "#data-attrs"
      - title: Actions System
        url: "#actions"
      - title: Action Pages
        url: "#action-pages"
  - label: Content Variables
    items:
      - title: Overview
        url: "#tokens"
      - title: Page-wide Registry
        url: "#tokens-registry"
      - title: Asset & Namespaced Tokens
        url: "#tokens-asset"
  - label: Extension Points
    items:
      - title: Search Provider
        url: "#search-provider"
      - title: Parts
        url: "#parts"
      - title: Custom Property
        url: "#custom-property"
      - title: Custom Block
        url: "#custom-block"
  - label: Reference
    items:
      - title: QueryBuilder Predicates
        url: "/querybuilder"
      - title: Collections & State
        url: "/collections"
      - title: Section Layouts
        url: "/layouts"
---

# Developer Reference

Architecture, events, data attributes, and extension points for building on top of Asset Share Commons.

## Ownership Boundary {#ownership}

| Path | Owner | Rule |
|------|-------|------|
| `scripts/asc/configurations.js` | You | Edit freely — the single customization entry point |
| `scripts/asc.js` | You | ASC lifecycle entry point — add eager/lazy/delayed hooks here |
| `scripts/asc/core/` | Asset Share Commons Core | Do not edit — replace on upgrades. All files begin with `// ASC Core` |
| `blocks/` | You | Copy and modify blocks freely |
| `blocks/action-*/` | You | Action dialog blocks — one per `/actions/*` path |
| `styles/` | You | Add themes, override CSS variables |
| `component-definition.json` / `component-models.json` / `component-filters.json` | You | Universal Editor component library, fields, and containment rules |

> Every file inside `scripts/asc/core/` starts with `// ASC Core — do not edit.` as a signal. You customize exclusively via `scripts/asc/configurations.js` and `scripts/asc.js`.

## Page Lifecycle {#lifecycle}

Edge Delivery Services runs three phases on every page load:

```js
// scripts/scripts.js
loadEager()    // Critical path: theme decoration, first section
loadLazy()     // Remaining sections, header/footer, lazy styles
loadDelayed()  // Runs after 3s: analytics, non-critical work
```

ASC services auto-initialize when `scripts/asc.js` is imported — no explicit init calls needed. `scripts/scripts.js` is EDS boilerplate that ASC modifies in a few specific places (see `CLAUDE.md` in the repo for the exact hooks) — re-apply those edits after any boilerplate upgrade.

![Page lifecycle diagram](https://placehold.co/860x340/111111/e91e8c?text=Page+Lifecycle+Diagram&font=inter)

*Edge Delivery Services three-phase page lifecycle — eager → lazy → delayed*

## Core Layers {#layers}

```
Blocks (UI)          /blocks/
  ↓ uses
Parts (reusable UI)  /scripts/asc/core/parts/
  ↓ uses
Services             /scripts/asc/core/services/
  ↓ uses
Models               /scripts/asc/core/models/
  ↓ uses
Utils                /scripts/asc/core/utils/
```

**Blocks** — entry points; each exports `decorate(block)`.
**Parts** — reusable UI functions (e.g. `assetTeaser`, `collectionToggle`); constructor-style, take `{ block }` for event delegation where relevant.
**Services** — business logic singletons (`search`, `aem`, `collections`, `downloads`, `renditions`, `assetDetails`, `users`, `actionPages`, `storage`, `url`, `properties`, `debug`, `init`).
**Models** — `Asset`, `Rendition`, `User` — wrap raw AEM API responses.
**Utils** — `events.js`, `blocks.js`, `search.js`, `fragments.js`, `images.js`.

---

## Event Reference {#events}

All events follow the `asc:{noun}:{verb}` pattern with colon separators. Dispatched on `document` unless noted.

| Event | Dispatched by | `detail` shape |
|-------|--------------|----------------|
| `asc:search:execute` | Search filter blocks, `search-results` | `{ form?, type?, source? }` |
| `asc:search:complete` | SearchService | `{ results, type, formData }` |
| `asc:search:error` | SearchService | `{ error, formData }` |
| `asc:asset:details:open` | Actions service | `{ data: { ascAsset } }` |
| `asc:asset:details:close` | Actions service | — |
| `asc:asset:preload` | Actions service | `{ data: { ascPreload } }` |
| `asc:collection:add` / `asc:collection:remove` | Actions service | `{ data: { ascAsset, ascCollection? } }` |
| `asc:collection:change` | Collections service | `{ action, id?, collectionId?, assetId?, userId?, source? }` |
| `asc:collection:created` / `asc:collection:deleted` / `asc:collection:activated` | Collections service | `{ collection }` / `{ id }` / `{ id, previous }` |
| `asc:download:started` / `asc:download:complete` / `asc:download:failed` / `asc:download:change` | Downloads service | `{ jobId }` / `{ jobId, downloadUrl }` / `{ jobId, error }` / `{ jobId, status }` |
| `asc:rendition:activate` | `details-renditions` | `{ rendition, asset }` — sticky selection, dispatched on `document.body` |
| `asc:rendition:preview` | `details-renditions` | `{ rendition, asset }` — transient hover; `rendition: null` on mouseleave |
| `asc:share:created` | `action-share` | `{ url, title, collectionId }` |

> **Drag and drop** — Asset teasers and board/sheet rows are `draggable="true"`. The dragged file is the asset's `original` rendition (falls back to `web`). Requires Chrome or Edge — degrades to URI copy in Firefox/Safari.

Full reference (data shapes, every event, board/collection payload formats): see [Collections & State](/collections) and the repo's `AGENTS.md`.

### Event Scoping {#event-scoping}

| Scope | Where events are delegated |
|-------|---------------------------|
| Search events | `document` |
| Cross-block common (collections, downloads, asset details) | `document.body` |
| Block-specific | The block's `.block` element |
| Part events | Parent block element via `delegateEvent()` |

Always use `delegateEvent()` from `scripts/asc/core/utils/events.js` — never bind events directly:

```js
import { delegateEvent } from '../../scripts/asc/core/utils/events.js';

delegateEvent(this.block, 'click', '[data-asc-action]', this.handleAction.bind(this));
```

---

## Data Attribute Reference {#data-attrs}

| Attribute | Value | Description |
|-----------|-------|-------------|
| `data-asc-action` | `"noun:verb@event ..."` | Declarative action wiring |
| `data-asc-asset` | UUID string | Asset reference passed through the DOM |
| `data-asc-collection` | Collection ID | Collection reference — omit to use the active collection |
| `data-asc-preload` | URL path | Path prefetched on hover when `init.preload` is true |
| `data-asc-fieldset` | fieldset ID | Groups a search input with its supporting inputs |

### Actions System {#actions}

Blocks wire up behavior via `data-asc-action` — no direct JS coupling between blocks:

```html
<div
  data-asc-action="asset:details:open@click asset:preload@mouseover"
  data-asc-asset="abc-123-uuid"
>
  <!-- teaser content -->
</div>
```

Multiple actions can be space-separated. The Actions service listens globally, parses `noun:verb@eventType` tuples, and fires a matching `CustomEvent` on `document.body` with all `data-*` attributes collected up the DOM tree as `event.detail.data`.

### Action Pages {#action-pages}

A convention for link-triggered action dialogs — used by the collection Download/Share buttons and any custom `/actions/*` link. The `actionPages` service intercepts clicks on `<a href="/actions/*">`:

```
click on <a href="/actions/download">
  → fetch /actions/download.plain.html          (DA-authored dialog content)
  → create detached <div class="action-download block">
  → loadBlock(blockEl)                          (EDS loads blocks/action-download/action-download.js)
  → decorate(blockEl) builds + shows a <dialog>
```

**Context passing** — before loading the block, the service writes the caller-supplied context to `window.asc.pendingAction`. The block's `decorate()` must read it **before any `await`**:

```js
export default async function decorate(block) {
  const ctx = window.asc?.pendingAction || {};  // capture before first await
  const collection = ctx.collectionId ? await services.collections.get(ctx.collectionId) : null;
  // …
}
```

**Block naming**: `/actions/download` → `blocks/action-download/`; `/actions/foo-bar` → `blocks/action-foo-bar/`.

**DA document structure** (three sections, separated by `---`): first section = header (`h1` → title), middle section(s) = body (headings + lists → form fields or rendition lists), last section = footer (`<p>` links with `#hash` hrefs become action buttons — `#close` is always a cancel button).

Trigger actions programmatically from a block:

```js
import { triggerAction } from '../../scripts/asc.js';
triggerAction('/actions/download', { collectionId: collection.id });
```

Configure the root path in `configurations.js`: `actions: { root: '/actions' }` (default).

---

## Content Variables — Token Templates {#tokens}

{% raw %}Authored content anywhere in the document can use `{{ accessor }}` / `{{ accessor | fallback }}`{% endraw %} placeholders, resolved by `scripts/asc/tokens.js`. When a value is empty/null, the fallback text is used (or the token collapses to `""`); dangling separators (`·`, `,`, `—`) adjacent to an empty token are trimmed automatically.

There are two complementary systems.

### Page-wide registry {#tokens-registry}

`registerTokens(context)` merges a flat `{ 'namespace.key': value }` map into a single, page-wide registry, then (re)scans the **entire document** — `<title>`, `meta[content]`, headings, paragraphs, links, anywhere in `<head>` or `<body>` — for any {% raw %}`{{...}}`{% endraw %} occurrence and re-resolves everything against the merged registry. Safe to call repeatedly from multiple blocks; later values simply overwrite earlier ones for the same key.

Callers today: `ascDecorateMain()` registers every URL search param (so `?fulltext=mountains` becomes {% raw %}`{{fulltext}}`{% endraw %}); `collection-controls` registers `collection.title` / `collection.description` / `collection.count` / `collection.lastUpdated`; `sheet-controls` registers the equivalent `sheet.*` keys.

{% raw %}
```
{{collection.title}}     [H1]
{{collection.description}}
{{collection.count}} assets — Last updated {{collection.lastUpdated}}
```
{% endraw %}

Because the scan covers the whole document, {% raw %}`{{collection.title}}`{% endraw %} also resolves if authored into `<title>` or `meta[name="description"]` — the browser tab title updates once the block registers real data.

### Asset & namespaced tokens {#tokens-asset}

`resolveTokens(template, context)` / `resolveTokensInElement(el, context)` resolve a template against **one** context object — an `Asset` instance, a namespace map (`{ asset, rendition }`), or any plain object. Used by `details-header` and `details-renditions`.

Accessor resolution order: computed getters (`url`, `uuid`, `id`, `filename`, `file-extension`) → `context.getProperty(key)` → `context[key]`.

**Namespaced accessors** — pass a namespace map instead of a single object when a template needs to pull from more than one "thing":

{% raw %}
```js
resolveTokensInElement(cardEl, { asset });
// → template can say {{asset.title}} · {{asset.file-size}}
```
{% endraw %}

`ns.accessor` switches into `context[ns]` and resolves the rest against it — only when `context[ns]` is itself an object, so it never collides with the page-wide registry's flat `'collection.title'`-style keys.

**Property handler accessors** (registered in `configurations.js → properties`): `title`, `description`, `mime-type`, `file-type`, `file-size`, `dimensions`, `width`, `height`, `author`, `keywords`, `tags`, `smart-tags`, `uploaded-date`, `uploaded-by`, `last-modified-date`, `last-modified-by`, `colors`, `history` — plus any raw JCR metadata key and any name registered in `properties.custom`.

{% raw %}
```
| details-header                                          |
| {{title}}                                                |
| {{file-type}} · {{file-size}} · {{dimensions}}          |
```
{% endraw %}

`details-renditions` uses the same engine against the **current rendition**, with `asset.*` reaching the owning asset — see the [renditions table templates](/blocks#details-renditions) for the full accessor list, including the {% raw %}`{{ accessor | fallback }}`{% endraw %} fallback syntax.

---

## Search Provider {#search-provider}

`SearchService` delegates all API calls to a pluggable provider. Two providers ship out of the box:

| Provider key | File | API |
|-------------|------|-----|
| `querybuilder` | `services/search/providers/querybuilder.js` | AEM QueryBuilder |
| `openapi` | `services/search/providers/openapi.js` | DM OpenAPI Search |

Switch in `configurations.js`:

```js
search: {
  provider: 'openapi',
}
```

![Search provider abstraction](https://placehold.co/860x340/111111/9333ea?text=Search+Provider+Abstraction+Diagram&font=inter)

*SearchService delegates to a provider — swap without touching blocks*

> **QueryBuilder predicates reference** — see [QueryBuilder Predicates](/querybuilder) for the full predicate reference, `basePredicates` / search config sheet, and how search block inputs map to API parameters.

### Custom Provider

Implement the `SearchProvider` interface (`services/search/search-provider.js`) and register it:

```js
// scripts/asc/core/services/search/providers/my-provider.js
import SearchProvider from '../search-provider.js';

export default class MyProvider extends SearchProvider {
  async search(formData) { /* → { assets, total, size, offset, more, success } */ }
  buildParams(formData) { /* → URLSearchParams */ }
  async getAssetById(id) { /* → Asset */ }
}
```

Register it in `services/search/search.js`'s `PROVIDERS` map, then activate with `search: { provider: 'my-provider' }`.

---

## Parts {#parts}

Parts are reusable UI components in `scripts/asc/core/parts/`. Each is a **pure function** — `(asset, options?) => string` — with no classes, no event binding.

### assetTeaser

Renders a single asset card or list row for search results, board cards, and similar strips.

```js
import assetTeaser from '../../scripts/asc/core/parts/asset-teaser/asset-teaser.js';

container.insertAdjacentHTML('beforeend', assetTeaser(asset));                 // card mode (default)
container.insertAdjacentHTML('beforeend', assetTeaser(asset, { mode: 'list' })); // list mode
```

> Use `insertAdjacentHTML('beforeend', ...)` when appending teasers to an existing container. Never use `innerHTML +=` — it re-serialises the entire DOM, causing all loaded images to flicker.

### picture

Renders a responsive `<picture>` (or a plain `<img>` when no web renditions are available).

```js
import picture from '../../scripts/asc/core/parts/picture/picture.js';

block.innerHTML = picture(asset);                     // standard
block.innerHTML = picture(asset, { eager: true });     // LCP image — eager load
block.innerHTML = picture(asset, {
  breakpoints: [
    { media: '(min-width: 1024px)', renditionWidth: 840 },
    { media: '(min-width: 768px)',  renditionWidth: 560 },
  ],
});
```

### collectionToggle

Renders an add/remove collection toggle button. Both states are always in the DOM; CSS hides the inactive one via `data-in-collection`. State hydrates asynchronously and updates on every `asc:collection:change`, including active-collection switches.

```js
import collectionToggle from '../../scripts/asc/core/parts/collection-toggle/collection-toggle.js';

container.insertAdjacentHTML('beforeend', collectionToggle(asset));
container.insertAdjacentHTML('beforeend', collectionToggle(asset, {
  addLabel: 'Save to {name}',
  removeLabel: 'Saved ✓',
  collectionId: 'uuid',   // optional — target a specific collection
}));
```

A single global `asc:collection:change` listener (registered at import time) keeps every instance on the page in sync — no per-block wiring needed. Already used inside `assetTeaser`.

#### Rules for Parts

- Pure functions — `(asset, options?) => string`
- No event binding — blocks own event wiring via `data-asc-action` and `delegateEvent()`
- Return HTML strings — blocks own DOM insertion
- CSS class prefix: `.asc-{part-name}`

---

## Custom Property Handler {#custom-property}

Extend asset properties without editing core models:

```js
// scripts/asc/configurations.js
properties: {
  custom: {
    brand: (asset) => asset.getProperty('jcr:content/metadata/myco:brand').data,
    'filesize-human': (asset) => {
      const bytes = asset.getProperty('jcr:content/dam:size').data;
      return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : null;
    },
  },
},
```

Use the custom property name in `details-property`, `details-asset-metadata`, and `searchResults.views`.

---

## Custom Block {#custom-block}

1. Create `blocks/my-block/my-block.js` exporting `default decorate(block)`
2. Create `blocks/my-block/my-block.css` — root selector: `.block.my-block { ... }`
3. Author a table named `my-block` in da.live — EDS loads it automatically, no registration required

```js
// blocks/my-block/my-block.js
export default function decorate(block) {
  block.innerHTML = '<p>Hello from my-block</p>';
}
```

```css
/* blocks/my-block/my-block.css */
.block.my-block {
    /* your styles */
}
```
