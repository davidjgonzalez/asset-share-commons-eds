# Extension Decision Guide

Read this first. It maps what you want to do in natural language to the right file, mechanism, and implementation approach — so you don't have to guess.

---

## How to Use This Guide

Describe what you want in one sentence. Find the closest match below. Follow the link to the detailed how-to.

---

## Decision Tree by Intent

### "I want to show a new piece of asset metadata..."

| Where? | Mechanism | File to edit | Guide |
|--------|-----------|-------------|-------|
| In search result cards / list / masonry | Register a custom property, add to `searchResults.views` | `scripts/configurations.js` | [→ Custom property](#custom-property) |
| In the asset details panel | Author a `details-property` block on the details fragment page | da.live (no code needed) | [→ Details property block](#details-property-block) |
| In search cards with a custom render function | `searchResults.views.list` `render` escape hatch | `scripts/configurations.js` | [→ Custom render in list view](#custom-render-in-list-view) |
| Everywhere (reusable) | Register a custom property handler | `scripts/configurations.js` | [→ Custom property](#custom-property) |

---

### "I want to add a new search filter..."

| Use case | Mechanism | Guide |
|----------|-----------|-------|
| Filter by a metadata property (checkbox / radio / dropdown) | Copy `search-property` block, configure authoring table | [→ New search filter block](../templates/search-filter.md) |
| Filter by a date range | Copy `search-date-range` block | [→ New search filter block](../templates/search-filter.md) |
| Filter by a DAM path | Copy `search-path` block | [→ New search filter block](../templates/search-filter.md) |
| Filter by tags | Copy `search-tags` block | [→ New search filter block](../templates/search-filter.md) |
| Hidden / pre-seeded filter (no UI) | Copy `search-hidden` block | [→ New search filter block](../templates/search-filter.md) |
| Custom predicate not covered above | Create new block using [search filter template](../templates/search-filter.md) | [→ Extension points: Search hooks](#search-hooks) |
| Modify ALL searches globally (add base filters) | `search.basePredicates` in `configurations.js` | [→ Base predicates](#base-predicates) |
| Pre-process the query before it's sent | `search.preprocessQuery` hook | [→ Search hooks](#search-hooks) |
| Post-process results (filter/sort/transform) | `search.postprocessResults` hook | [→ Search hooks](#search-hooks) |
| Exclude certain assets from all results | `search.accepts` hook | [→ Search hooks](#search-hooks) |
| Switch from QueryBuilder to OpenAPI | `search.provider: 'openapi'` | [→ Search provider switch](#search-provider-switch) |
| Connect to a completely different search API | Custom search provider class | [→ Custom search provider](#custom-search-provider) |

---

### "I want to change how search results look..."

| Use case | Mechanism | Guide |
|----------|-----------|-------|
| Add / remove properties shown on result cards | `searchResults.views.cards` | [→ Result views](#result-views) |
| Add / remove columns in list view | `searchResults.views.list` | [→ Result views](#result-views) |
| Change masonry view metadata | `searchResults.views.masonry` | [→ Result views](#result-views) |
| Change quick-action download rendition | `searchResults.views.quickActions.downloadRendition` | [→ Result views](#result-views) |
| Custom result card with different HTML structure | New block or modified `search-results` | [→ New result item block](../templates/result-item.md) |
| Custom result card for specific asset types | `assetDetails.templates` + `search.accepts` combination | [→ Extension points](#asset-details-routing) |

---

### "I want to change the asset details panel..."

| Use case | Mechanism | Guide |
|----------|-----------|-------|
| Add a new metadata field to the details panel | Author a `details-property` block | da.live authoring — no code |
| Different panel layout for images vs. videos | `assetDetails.templates` routing function | [→ Asset details routing](#asset-details-routing) |
| Different panel layout for a specific brand/folder | `assetDetails.templates` routing function | [→ Asset details routing](#asset-details-routing) |
| New action button (e.g. "Open in Adobe Express") | Author `details-actions` with `share` action; handle `asc:asset:share` event | [→ Details actions](#details-actions) |
| Add a "similar assets" section | Author `details-similar` block on details page | da.live authoring — no code |
| Show a custom rendition (smart crop, preset) | Add to `renditions.definitions` | [→ Rendition definitions](#rendition-definitions) |
| Hide a rendition from the download list | `visible: false` on rendition definition | [→ Rendition definitions](#rendition-definitions) |
| Build a fully custom details layout | Create new details fragment page + new details block | [→ New details block](../templates/details-block.md) |

---

### "I want to change how downloads work..."

| Use case | Mechanism | Guide |
|----------|-----------|-------|
| Add a new downloadable rendition | `renditions.definitions` | [→ Rendition definitions](#rendition-definitions) |
| Add a DM smart crop rendition | `type: 'asset-delivery'`, `params: 'smartcrop=Name'` | [→ Rendition definitions](#rendition-definitions) |
| Add a legacy DM / Scene7 rendition | `type: 'url'`, `url: '${dm.apiServer}is/image/${dm.file}'` | [→ Rendition definitions](#rendition-definitions) |
| Change the AEM download endpoint | `downloads.initiateUrl` | [→ Downloads config](#downloads-config) |
| Change download polling speed / timeout | `downloads.quickPollTimeout`, `downloads.pollInterval` | [→ Downloads config](#downloads-config) |

---

### "I want to change the look and feel..."

| Use case | Mechanism | Guide |
|----------|-----------|-------|
| Match the colors of our brand site | `asc-theme-from-website` skill | [→ Theme from website skill](../../asc-theme-from-website/SKILL.md) |
| Apply a custom color theme | Create `styles/themes/{name}.css`; set `theme.default` | [→ Theme creation](#theme-creation) |
| Switch between dark / light theme | `theme.default: 'dark'` or `'default'` | [→ Theme creation](#theme-creation) |
| Change spacing, border-radius, shadows globally | Edit `--spacing-*`, `--border-radius-*` in `styles/tokens.css` | [→ Token overrides](#token-overrides) |
| Style a specific block differently | Edit `blocks/{name}/{name}.css` | Direct CSS edit |

---

### "I want to add new functionality..."

| Use case | Mechanism | Guide |
|----------|-----------|-------|
| Listen for when the user opens an asset | Handle `asc:asset:details:open` event | [→ Cross-block communication](cross-block-communication.md) |
| Listen for search completion (e.g. analytics) | Handle `asc:search:complete` event | [→ Event reference](asc-event-reference.md) |
| Add a modal / dialog triggered by a button | Create block with native `<dialog>` | [→ Modals and dialogs](modals-and-dialogs.md) |
| Load a page fragment into a modal | `loadFragment()` + `dialog.showModal()` | [→ Fragments](fragments.md) |
| Add something to the collection cart | Dispatch `asc:collection:add` or use `data-asc-action` | [→ Cross-block communication](cross-block-communication.md) |
| Create a new block type entirely | Follow CDD workflow + block template | [→ New block template](../templates/search-filter.md) |
| Intercept collection changes | Handle `asc:collection:change` event | [→ Event reference](asc-event-reference.md) |

---

## Extension Points — Detailed Reference

### Custom Property

**Use when**: You need to display a metadata field that isn't in the built-in property list, or override an existing property's display logic.

**Built-in properties**: `title`, `thumbnail`, `file-type`, `file-size`, `file-extension`, `dimensions`, `width`, `height`, `modified`, `created`, `description`, `filename`, `mime-type`

**File**: `scripts/configurations.js`

```js
properties: {
  custom: {
    // Key = property name used everywhere (details-property, searchResults.views, etc.)
    // Value = function(asset, options) => display string | null
    'brand': (asset) => asset.getProperty('jcr:content/metadata/myco:brand'),

    'approval-status': (asset) => {
      const s = asset.getProperty('jcr:content/metadata/dam:status');
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
    },

    // Composed from multiple fields
    'dimensions-label': (asset) => {
      const w = asset.getProperty('tiff:ImageWidth');
      const h = asset.getProperty('tiff:ImageLength');
      return (w && h) ? `${w} × ${h} px` : null;
    },
  },
},
```

Once registered, use the key anywhere:
- In `details-property` blocks: `| property | brand |`
- In `searchResults.views.cards`: `['thumbnail', 'title', 'brand', 'file-size']`
- In `searchResults.views.list`: `{ property: 'brand', label: 'Brand', width: '120px' }`
- In code: `asset.getProperty('brand')`

**What NOT to do**: Do not modify `scripts/asc/services/properties/properties.js`. The `properties.custom` config is merged in automatically.

---

### Details Property Block

**Use when**: You want to show a metadata field on the asset details panel with no code changes.

**Approach**: Author in da.live. No JS or CSS needed.

```
Table row authored in da.live:

| label    | Brand                            |
| property | brand                            |   ← any registered property name
| default  | Unknown                          |   ← shown when property is empty
```

The `details-property` block reads `data-asc-asset` from its parent `<main>` element (set by the asset details modal), fetches the asset, and calls `asset.getProperty(config.property)`.

---

### Custom Render in List View

**Use when**: A property name alone isn't enough — you need custom HTML in a list column.

**File**: `scripts/configurations.js`

```js
searchResults: {
  views: {
    list: [
      { property: 'thumbnail', width: '48px' },
      { property: 'title', width: '1fr' },
      // ↓ Escape hatch: render function receives (asset, services)
      {
        label: 'Status',
        width: '80px',
        render: (asset) => {
          const s = asset.getProperty('jcr:content/metadata/dam:status');
          const color = s === 'approved' ? 'green' : 'orange';
          return `<span style="color:${color}">${s ?? '—'}</span>`;
        },
      },
    ],
  },
},
```

---

### Result Views

**Use when**: You want to control which properties appear in cards, masonry, or list views.

**File**: `scripts/configurations.js`

```js
searchResults: {
  views: {
    // Array of property name strings (in display order)
    cards: ['thumbnail', 'title', 'brand', 'file-type', 'file-size'],

    // Keep minimal — properties overlay on hover in masonry
    masonry: ['thumbnail', 'title'],

    // Array of column objects for the list view
    list: [
      { property: 'thumbnail', width: '48px'  },
      { property: 'title',     width: '1fr'   },
      { property: 'brand',     label: 'Brand', width: '120px' },
      { property: 'file-type', label: 'Type',  width: '100px' },
      { property: 'modified',  label: 'Date',  width: '120px' },
    ],

    // Rendition used by the quick-download button on cards / masonry
    quickActions: {
      downloadRendition: 'web',  // Any rendition id from renditions.definitions
    },
  },
},
```

---

### Base Predicates

**Use when**: You want to restrict all searches globally — e.g. only show approved assets, only search within a specific DAM folder.

**File**: `scripts/configurations.js` → `search.basePredicates`

```js
search: {
  provider: 'querybuilder',
  basePredicates: {
    // Only show approved assets (dam:status = 'approved')
    'property': 'jcr:content/metadata/dam:status',
    'property.value': 'approved',

    // Restrict to a specific folder
    'path': '/content/dam/brand',

    // Exclude sub-asset folders
    'excludepaths': '.*subassets.*',

    // Only assets modified in the last 30 days
    'relativedaterange.property': 'jcr:content/jcr:lastModified',
    'relativedaterange.lowerBound': '-30d',
  },
},
```

These predicates are merged into every query. Form-submitted predicates from search filter blocks override them if they share the same key.

---

### Search Hooks

**Use when**: You need to transform the query or results at runtime — conditionally, based on user context, or for analytics.

**File**: `scripts/configurations.js` → `search.*`

```js
search: {
  // Called with the raw QB params Map before sending to AEM.
  // Return a modified Map or the same Map.
  preprocessQuery: (query) => {
    // Example: inject a user-specific filter
    const userId = getCurrentUserId();
    if (userId) query.set('property.value', userId);
    return query;
  },

  // Called with the raw results array from AEM before Asset objects are created.
  // Return a modified array.
  postprocessResults: (results) => {
    // Example: sort by a custom metadata field
    return results.sort((a, b) => {
      const aVal = a['jcr:content']?.metadata?.['myco:sortOrder'] ?? 999;
      const bVal = b['jcr:content']?.metadata?.['myco:sortOrder'] ?? 999;
      return aVal - bVal;
    });
  },

  // Called once per Asset after it's created. Return true to include, false to exclude.
  // Runs after postprocessResults.
  accepts: (asset) => {
    // Example: exclude assets with no renditions
    return asset.mimeType && asset.staticRenditions.length > 0;
  },
},
```

---

### Search Provider Switch

**Use when**: Your AEM instance has Dynamic Media with OpenAPI enabled (AEMaaCS only).

**File**: `scripts/configurations.js`

```js
search: {
  provider: 'openapi',
  url: '/adobe/assets/search',   // AEMaaCS endpoint (usually not needed — auto-configured)
},
aem: {
  host: 'https://author-pXXXX-eYYYY.adobeaemcloud.com',
  deliveryHost: 'https://delivery-pXXXX-eYYYY.adobeaemcloud.com',
},
```

The OpenAPI provider translates QB-style form fields from search filter blocks into OpenAPI filter params automatically. See `AGENTS.md → Search Provider Abstraction` for the full translation map.

---

### Custom Search Provider

**Use when**: You need to connect ASC to a search API other than AEM QueryBuilder or AEM OpenAPI (e.g. Elasticsearch, Algolia, Coveo).

**Step 1**: Create the provider in `scripts/asc/services/search/providers/my-provider.js`:

```js
// NOTE: This goes inside scripts/asc/ which is normally ASC Core.
// A custom provider is the one valid reason to add a file here.
import SearchProvider from '../search-provider.js';
import Asset from '../../../models/asset.js';

export default class MyProvider extends SearchProvider {
  // Called for every search. Must return the standard results shape.
  async search(formData) {
    const params = this.buildParams(formData);
    const response = await fetch(`https://my-search-api.example.com/search?${params}`);
    const data = await response.json();

    // Transform results into Asset instances
    const assets = data.hits.map((hit) => new Asset(transformHit(hit)));

    return {
      assets,
      total: data.total,
      size: assets.length,
      offset: data.offset ?? 0,
      more: (data.offset ?? 0) + assets.length < data.total,
      success: true,
    };
  }

  // Build API-specific URL params from QB-style form data
  buildParams(formData) {
    const params = new URLSearchParams();
    const q = formData.get('fulltext');
    if (q) params.set('q', q);
    // ... map other QB fields to your API's params
    return params;
  }

  // Fetch a single asset by UUID (used by details modal deep-links)
  async getAssetById(id) {
    const response = await fetch(`https://my-search-api.example.com/asset/${id}`);
    const hit = await response.json();
    return new Asset(transformHit(hit));
  }
}

function transformHit(hit) {
  // Transform your API response into the JCR data shape expected by Asset constructor
  return {
    'jcr:path': hit.path,
    'jcr:uuid': hit.id,
    'jcr:content': {
      'cq:name': hit.filename,
      metadata: {
        'dc:title': hit.title,
        'dc:format': hit.mimeType,
        'dam:size': hit.sizeBytes,
        'jcr:created': hit.createdAt,
        'jcr:lastModified': hit.modifiedAt,
      },
    },
  };
}
```

**Step 2**: Register it in `scripts/asc/services/search/search.js`:

```js
// Add to the PROVIDERS map:
const PROVIDERS = {
  querybuilder: QueryBuilderProvider,
  openapi: OpenApiProvider,
  'my-provider': MyProvider,          // ← add this
};
```

**Step 3**: Activate in `scripts/configurations.js`:

```js
search: { provider: 'my-provider' },
```

---

### Rendition Definitions

**Use when**: You want to add, remove, or reconfigure downloadable renditions that appear in the `details-download` block.

**File**: `scripts/configurations.js` → `renditions.definitions`

The `definitions` array is evaluated top-to-bottom for each asset. **First-match-per-id wins** — so you can have conditional renditions that fall back.

```js
renditions: {
  definitions: [
    // ── Hidden internal rendition (thumbnail used by teasers, not shown to users) ──
    {
      id: 'thumbnail',
      label: 'Thumbnail',
      type: 'static',
      name: /^cq5dam\.thumbnail\.319\.319\./,
      visible: false,              // ← hides from download list
    },

    // ── Static rendition — matches a node in jcr:content/renditions/* ─────────
    {
      id: 'web',
      label: 'Web',
      type: 'static',
      name: /^cq5dam\.web\./,     // RegExp matched against rendition node name
      accepts: (asset) => asset.mimeType?.startsWith('image/'),
    },
    {
      id: 'original',
      label: 'Original',
      type: 'static',
      name: 'original',           // Exact string match
    },

    // ── DM with OpenAPI (AEMaaCS + Dynamic Media) — named smart crop ──────────
    {
      id: 'smart-crop-hero',
      label: 'Hero Crop',
      type: 'asset-delivery',
      params: 'smartcrop=Hero',   // ?smartcrop=Hero appended to delivery URL
      accepts: (asset) => asset.mimeType?.startsWith('image/'),
    },

    // ── DM with OpenAPI — image preset ────────────────────────────────────────
    {
      id: 'web-preset',
      label: 'Web Optimized',
      type: 'asset-delivery',
      params: 'imagePreset=web&format=webp',
      accepts: (asset) => asset.mimeType?.startsWith('image/'),
    },

    // ── Legacy DM / Scene7 IS-IR — URL template ───────────────────────────────
    // ${dm.*} variables resolve from dam:scene7* metadata on the asset
    {
      id: 'dm-large',
      label: 'Large (DM)',
      type: 'url',
      url: '${dm.apiServer}is/image/${dm.file}?$large$',
      accepts: (asset) => !!asset.getProperty('dam:scene7File'),
    },

    // ── Conditional: different thumbnail for videos vs. images ─────────────────
    {
      id: 'thumbnail',            // Same id — first-match wins
      label: 'Thumbnail',
      type: 'static',
      name: /^cq5dam\.thumbnail\.140\./,
      accepts: (asset) => asset.mimeType?.startsWith('video/'),
      visible: false,
    },
  ],
},
```

**Available `type` values**:

| Type | Resolves URL from | When to use |
|------|-------------------|-------------|
| `static` | JCR rendition nodes (`jcr:content/renditions/*`) | Any AEM instance |
| `url` | Template string with `${asset.*}` and `${dm.*}` tokens | Legacy DM / Scene7 |
| `asset-delivery` | AEM Asset Delivery API (`/adobe/dynamicmedia/deliver/{uuid}/`) | AEMaaCS + DM with OpenAPI |

---

### Asset Details Routing

**Use when**: You want different details panel layouts for different asset types or metadata values.

**File**: `scripts/configurations.js` → `assetDetails.templates`

```js
assetDetails: {
  // Receives the Asset; return the fragment page path to load as the modal content.
  templates: (asset) => {
    // Route by MIME type
    if (asset.mimeType?.startsWith('video/'))        return '/details/video';
    if (asset.mimeType?.startsWith('image/'))        return '/details/image';
    if (asset.mimeType === 'application/pdf')        return '/details/pdf';

    // Route by metadata
    const brand = asset.getProperty('jcr:content/metadata/myco:brand');
    if (brand === 'acme')                            return '/details/acme';

    // Default
    return '/details';
  },
},
```

Each path (`/details`, `/details/video`, etc.) is a da.live page containing `details-*` blocks. The modal loads it as a fragment and injects `data-asc-asset` on the `<main>` element so all blocks can read the current asset.

---

### Details Actions

**Use when**: You want to add a custom action button to the asset details panel (e.g. "Open in Lightroom", "Add to project", "Send for approval").

**Step 1**: Author the `details-actions` block with the `share` action enabled:

```
| actions | collection-toggle download share |
```

**Step 2**: Add an event listener in `scripts/delayed.js` or a custom block to handle `asc:asset:share`:

```js
document.body.addEventListener('asc:asset:share', (event) => {
  const { ascAsset } = event.detail.data;
  // ascAsset is the UUID string. Fetch the Asset from cache or service:
  const asset = window.asc?.cache?.assets?.get(ascAsset);

  // Do something with the asset
  openCustomShareDialog(asset);
  // — or —
  window.open(`https://my-app.example.com/assets/${ascAsset}`);
});
```

For a fully custom action not covered by `collection-toggle`, `download`, or `share`, copy and modify the `details-actions` block to add your own button and event.

---

### Downloads Config

**Use when**: You need to change polling behaviour or the AEM download endpoint.

**File**: `scripts/configurations.js`

```js
downloads: {
  // POST to initiate; GET with ?jobId=<id> to poll
  initiateUrl: '/content/dam.downloads.initiateDownload.json',

  // Fast-poll window — how long to wait for auto-download (ms)
  quickPollTimeout: 15000,

  // How often to poll while waiting (ms)
  pollInterval: 2000,

  // How long to keep jobs in localStorage before pruning (ms)
  jobExpiry: 7 * 24 * 60 * 60 * 1000,
},
```

---

### Theme Creation

**Use when**: You want a custom color palette.

**Step 1**: Create `styles/themes/my-theme.css`:

```css
/* Override ONLY --color-* tokens. Never override structural tokens. */
.theme-my-theme {
  --color-bg:             #f5f5f0;
  --color-fg:             #1a1a1a;
  --color-card:           #ffffff;
  --color-card-fg:        #1a1a1a;
  --color-primary:        #c44b0a;
  --color-primary-fg:     #ffffff;
  --color-secondary:      #eeece8;
  --color-secondary-fg:   #1a1a1a;
  --color-muted:          #f0ede8;
  --color-muted-fg:       #6b6560;
  --color-accent:         #fce8dd;
  --color-accent-fg:      #c44b0a;
  --color-destructive:    #dc2626;
  --color-destructive-fg: #ffffff;
  --color-border:         #ddd8d0;
  --color-input:          #ffffff;
  --color-ring:           #c44b0a;
}
```

**Step 2**: Activate in `scripts/configurations.js`:

```js
theme: {
  default: 'my-theme',
},
```

Full token reference: [css-guidelines.md](css-guidelines.md)

---

### Token Overrides

**Use when**: You want to change spacing, border radius, shadows, or typography globally — not just colors.

**File**: `styles/tokens.css` (directly edit; this is user-owned)

```css
:root {
  /* Spacing scale */
  --spacing-xs:   0.25rem;
  --spacing-s:    0.5rem;
  --spacing-m:    1rem;     /* ← change these */
  --spacing-l:    1.5rem;
  --spacing-xl:   2rem;

  /* Border radius */
  --border-radius-s:    4px;
  --border-radius-m:    8px;    /* ← more rounded? change here */
  --border-radius-l:    16px;
  --border-radius-full: 9999px;

  /* Shadows */
  --shadow-sm:  0 1px 3px rgb(0 0 0 / 12%);
  --shadow-md:  0 4px 12px rgb(0 0 0 / 10%);
  --shadow-lg:  0 8px 24px rgb(0 0 0 / 12%);
}
```

⚠ Do **not** override structural tokens inside `styles/themes/*.css` — themes are for colors only.

---

## What NOT to Do

| Don't | Instead |
|-------|---------|
| Edit files in `scripts/asc/` | Use `configurations.js` hooks; copy blocks to `blocks/` |
| Add properties directly to `scripts/asc/services/properties/properties.js` | Use `configurations.properties.custom` |
| Hardcode QB field names in block code | Use `config.parameter(key)` from `readBlockConfig` |
| Bind events manually in a Part | Use `data-asc-action` attributes on the returned HTML |
| Use `--text-color` or `--background-color` | Use `--color-fg` and `--color-bg` (ASC semantic tokens) |
| Create a new service for a simple property lookup | Register a property handler in `configurations.js` |
| Override `window.asc.services.*` directly | Use configuration hooks; or copy the service if truly necessary |
