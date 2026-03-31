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
---

# Developer Reference

Architecture, events, data attributes, and extension points for building on top of ASC EDS.

## Ownership Boundary {#ownership}

| Path | Owner | Rule |
|------|-------|------|
| `scripts/configurations.js` | You | Edit freely — the single customization entry point |
| `scripts/asc/` | ASC Core | Do not edit — replace on upgrades. All files begin with `// ASC Core` |
| `blocks/` | You | Copy and modify blocks freely |
| `styles/` | You | Add themes, override CSS variables |

<div class="callout">
Every file in <code>scripts/asc/</code> starts with <code>// ASC Core — do not edit.</code> as a signal. You customize exclusively via <code>scripts/configurations.js</code>.
</div>

## Page Lifecycle {#lifecycle}

EDS runs three phases on every page load:

```js
// scripts/scripts.js
loadEager()    // Critical path: theme decoration, first section
loadLazy()     // Remaining sections, header/footer, lazy styles
loadDelayed()  // Runs after 3s: analytics, non-critical work
```

ASC services are imported in `scripts/scripts.js` and initialize themselves as singletons on module import. The search service auto-executes on pages with search blocks.

<figure class="screenshot">
  <img src="https://placehold.co/860x340/111111/e91e8c?text=Page+Lifecycle+Diagram&font=inter" alt="Page lifecycle diagram" loading="lazy" />
  <figcaption>EDS three-phase page lifecycle — eager → lazy → delayed</figcaption>
</figure>

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

Multiple actions can be space-separated. The action system in `scripts/asc/utils/actions.js` parses `noun:verb@event` tuples and dispatches the matching ASC event.

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

<figure class="screenshot">
  <img src="https://placehold.co/860x340/111111/9333ea?text=Search+Provider+Abstraction+Diagram&font=inter" alt="Search provider abstraction" loading="lazy" />
  <figcaption>SearchService delegates to a provider — swap without touching blocks</figcaption>
</figure>

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

Parts are reusable UI components in `scripts/asc/parts/`. The only shipping part is `AssetTeaser`.

### AssetTeaser

Renders a single asset card in search results or the stub.

```js
import AssetTeaser from '/scripts/asc/parts/AssetTeaser.js';

const teaser = new AssetTeaser({ block: this.block });
teaser.asset = asset;                 // set Asset model
container.innerHTML = teaser.html();  // render HTML string
```

#### Rules for Parts

- Constructor receives `{ block }` — the parent block element
- Never bind events directly; always use `delegateEvent(this.block, ...)`
- `html()` returns an HTML string; the block owns DOM insertion

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
3. Author a table named `my-block` in da.live — EDS will load it automatically

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

EDS auto-discovers blocks — no registration required.
