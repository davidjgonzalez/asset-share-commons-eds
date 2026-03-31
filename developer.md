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
---

# Developer Reference

Architecture, events, data attributes, and extension points for building on top of Asset Share Commons.

## Ownership Boundary {#ownership}

| Path | Owner | Rule |
|------|-------|------|
| `scripts/configurations.js` | You | Edit freely — the single customization entry point |
| `scripts/asc/` | Asset Share Commons Core | Do not edit — replace on upgrades. All files begin with `// ASC Core` |
| `blocks/` | You | Copy and modify blocks freely |
| `styles/` | You | Add themes, override CSS variables |

> Every file in `scripts/asc/` starts with `// ASC Core — do not edit.` as a signal. You customize exclusively via `scripts/configurations.js`.

## Page Lifecycle {#lifecycle}

Edge Delivery Services runs three phases on every page load:

```js
// scripts/scripts.js
loadEager()    // Critical path: theme decoration, first section
loadLazy()     // Remaining sections, header/footer, lazy styles
loadDelayed()  // Runs after 3s: analytics, non-critical work
```

Asset Share Commons services are imported in `scripts/scripts.js` and initialize themselves as singletons on module import. The search service auto-executes on pages with search blocks.

![Page lifecycle diagram](https://placehold.co/860x340/111111/e91e8c?text=Page+Lifecycle+Diagram&font=inter)

*Edge Delivery Services three-phase page lifecycle — eager → lazy → delayed*

## Core Layers {#layers}

```
Blocks (UI)          /blocks/
  ↓ uses
Parts (reusable UI)  /scripts/asc/parts/
  ↓ uses
Services             /scripts/asc/services/
  ↓ uses
Models               /scripts/asc/models/
  ↓ uses
Utils                /scripts/asc/utils/
```

**Blocks** — entry points; each exports `decorate(block)`.
**Parts** — reusable UI components (e.g. `AssetTeaser`); constructor receives `{ block }`.
**Services** — business logic singletons (search, collections, renditions, etc.).
**Models** — `Asset`, `Rendition`, `User` — wrap raw API responses.
**Utils** — `events.js`, `blocks.js`, `search.js`, `fragments.js`.

---

## Event Reference {#events}

All events follow the `asc:{noun}:{verb}` pattern with colon separators.

| Event | Dispatched on | Payload | Description |
|-------|--------------|---------|-------------|
| `asc:search:execute` | `document` | `{ query, filters }` | Trigger a search run |
| `asc:search:results` | `document` | `{ assets, total, page }` | Search results available |
| `asc:search:loading` | `document` | `{ loading }` | Search in-flight state |
| `asc:asset:details:open` | `document.body` | `{ uuid }` | Open asset details modal |
| `asc:asset:details:close` | `document.body` | — | Close asset details modal |
| `asc:asset:preload` | `document.body` | `{ uuid }` | Preload asset data (hover) |
| `asc:collection:add` | `document.body` | `{ uuid }` | Add asset to collection |
| `asc:collection:remove` | `document.body` | `{ uuid }` | Remove asset from collection |
| `asc:collection:change` | `document.body` | `{ collection }` | Collection state updated |
| `asc:rendition:download` | block element | `{ uuid, rendition }` | User triggered download |
| `asc:asset:drag:start` | block element | `{ uuid, renditionId, url }` | User started dragging an asset (fired by search-results and sheet blocks) |

> **Drag and drop** — Asset teasers and sheet rows are `draggable="true"`. The `dragstart` handler sets `dataTransfer` with `DownloadURL` (Chrome/Edge drag-to-Finder), `text/uri-list`, and `text/plain` fallbacks. The dragged URL is the `original` rendition in search results, and the currently-selected rendition in the sheet.

### Event Scoping {#event-scoping}

| Scope | Where events are delegated |
|-------|---------------------------|
| Search events | `document` |
| Cross-block common | `document.body` |
| Block-specific | The block's `.block` element |
| Part events | Parent block element via `delegateEvent()` |

Always use `delegateEvent()` from `scripts/asc/utils/events.js` — never bind events directly:

```js
import { delegateEvent } from '/scripts/asc/utils/events.js';

// Inside a Part constructor:
delegateEvent(this.block, 'click', '[data-asc-action]', this.handleAction.bind(this));
```

---

## Data Attribute Reference {#data-attrs}

| Attribute | Value | Description |
|-----------|-------|-------------|
| `data-asc-action` | `"noun:verb@event ..."` | Declarative action wiring |
| `data-asc-asset` | UUID string | Asset reference passed through DOM |
| `data-asc-collection` | Collection ID | Collection reference |
| `data-asc-rendition` | Rendition name | Rendition reference for download actions |

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

Multiple actions can be space-separated. The action system in `scripts/asc/utils/actions.js` parses `noun:verb@event` tuples and dispatches the matching Asset Share Commons event.

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

> **QueryBuilder predicates reference** — see [QueryBuilder Predicates](/querybuilder) for the full predicate reference, `basePredicates` configuration, and how search block inputs map to API parameters.

### Custom Provider

Implement the `SearchProvider` interface and register it:

```js
// scripts/configurations.js
import MyProvider from './my-search-provider.js';

search: {
  provider: MyProvider,   // pass a class, not a string
}
```

A provider must implement:

```js
class MyProvider {
  // Returns { assets: Asset[], total: number }
  async search({ query, filters, page, limit }) { ... }

  // Returns Asset
  async getAsset(uuid) { ... }
}
```

---

## Parts {#parts}

Parts are reusable UI components in `scripts/asc/parts/`. Each is a pure function `(asset, options?) => string` — no classes, no event binding.

### assetTeaser

Renders a single asset card or list row for use in search results, collections, and similar strips.

```js
import assetTeaser from '/scripts/asc/parts/asset-teaser/asset-teaser.js';

// card mode (default)
container.insertAdjacentHTML('beforeend', assetTeaser(asset));

// list mode
container.insertAdjacentHTML('beforeend', assetTeaser(asset, { mode: 'list' }));
```

| Option | Default | Description |
|--------|---------|-------------|
| `mode` | `'card'` | `'card'` \| `'list'` |

The teaser renders with `data-asc-action="asset:details:open@click asset:preload@mouseover"` and `data-asc-asset="{uuid}"` wired automatically — no extra event binding needed.

> Use `insertAdjacentHTML('beforeend', ...)` when appending teasers to an existing container. Never use `innerHTML +=` — it re-serialises the entire DOM, causing all loaded images to flicker.

---

### picture

Renders a responsive `<picture>` element (or plain `<img>` when no web renditions are available) for a given asset. Used on detail pages where full rendition data is loaded.

```js
import picture from '/scripts/asc/parts/picture/picture.js';

block.innerHTML = picture(asset);

// LCP image — load eagerly
block.innerHTML = picture(asset, { eager: true });

// Custom breakpoints
block.innerHTML = picture(asset, {
  breakpoints: [
    { media: '(min-width: 1024px)', renditionWidth: 840 },
    { media: '(min-width: 768px)',  renditionWidth: 560 },
  ],
});
```

| Option | Default | Description |
|--------|---------|-------------|
| `alt` | asset title | Alt text for the `<img>` |
| `eager` | `false` | Sets `loading="eager"` and `fetchpriority="high"` for LCP images |
| `breakpoints` | auto | Array of `{ media, renditionWidth }` — auto-generates `<source>` elements if omitted |
| `imgAttributes` | `{}` | Extra attributes merged onto the `<img>` element |

When no JCR web renditions are present (e.g. search result assets), falls back to a plain `<img>` pointing at the thumbnail URL.

---

#### Rules for Parts

- Pure functions — `(asset, options?) => string`
- No event binding — blocks own event wiring via `data-asc-action` and `delegateEvent()`
- Return HTML strings — blocks own DOM insertion

---

## Custom Property Handler {#custom-property}

Extend asset properties without editing core models:

```js
// scripts/configurations.js
properties: {
  custom: {
    // Simple value extraction
    'brand': (asset) => asset.getProperty('jcr:content/metadata/myco:brand'),

    // Computed / formatted value
    'filesize-human': (asset) => {
      const bytes = asset.getProperty('jcr:content/dam:assetLastModified');
      return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : null;
    },
  },
},
```

Use the custom property name in any `details-property` block.

---

## Custom Block {#custom-block}

To add a new block:

1. Create `blocks/my-block/my-block.js` exporting `default decorate(block)`
2. Create `blocks/my-block/my-block.css` — root selector: `.block.my-block { ... }`
3. Author a table named `my-block` in da.live — Edge Delivery Services will load it automatically

```js
// blocks/my-block/my-block.js
export default function decorate(block) {
  // block is the .block.my-block element
  block.innerHTML = '<p>Hello from my-block</p>';
}
```

```css
/* blocks/my-block/my-block.css */
.block.my-block {
    /* your styles */
}
```

Edge Delivery Services auto-discovers blocks — no registration required.
