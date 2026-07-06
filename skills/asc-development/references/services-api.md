# Services API Reference

Complete catalog of all 15 ASC services with method signatures and usage examples.

---

## Import Services

```js
import services from '../../scripts/asc/services/services.js';

// Destructure what you need
const { search, collections, renditions, properties } = services;
```

All services are singletons initialized on module import.

---

## Search Service

**Location**: `scripts/asc/services/search/search.js`

Orchestrates asset search against a configurable provider (QueryBuilder or OpenAPI).

### Methods

#### `search.search(formData, type?)`

Execute a search with form data.

```js
const formData = new Map([
  ['fulltext', 'logo'],
  ['1_group.property.0_value', 'jpg'],
]);

const results = await services.search.search(formData);
// results = { assets: [], total, size, offset, more, success }
```

#### `search.getAssetById(uuid)`

Fetch a single asset by UUID.

```js
const asset = await services.search.getAssetById('uuid-123');
// asset = Asset instance
```

#### `search.getProvider()`

Get the currently configured search provider.

```js
const provider = services.search.getProvider();
// provider = QueryBuilderProvider or OpenApiProvider
```

---

## Collections Service

**Location**: `scripts/asc/services/collections/collections.js`

Manage user collections (cart/favorites) stored in localStorage.

### Methods

#### CRUD

```js
// Create
const collection = await services.collections.create('My Collection');

// Read
const all = await services.collections.getAll();
const one = await services.collections.get('col-uuid');
const active = await services.collections.getActive();  // Current collection
const defaultCol = await services.collections.getDefault();

// Update
await services.collections.rename('col-uuid', 'New Name');

// Delete
await services.collections.delete('col-uuid');
```

#### Asset Management

```js
// Add asset to active collection
await services.collections.addAsset('asset-uuid');

// Add asset to specific collection
await services.collections.addAsset('asset-uuid', 'col-uuid');

// Remove
await services.collections.removeAsset('asset-uuid', 'col-uuid');

// Check if asset is in collection
const has = await services.collections.hasAsset('asset-uuid', 'col-uuid');
// has = boolean
```

#### Activation

```js
// Get active collection ID
const activeId = services.collections.getActiveId();

// Set active collection
services.collections.setActive('col-uuid');
```

#### Board Item Updates

```js
// Partially update board position and/or notes for an asset item
services.collections.updateItem('col-uuid', 'asset-uuid', { x: 120, y: 80 });
services.collections.updateItem('col-uuid', 'asset-uuid', { notes: 'Approved for web use' });
```

#### Reordering (programmatic)

```js
// Replace the entire ordered items array (board positions use x/y instead)
services.collections.reorderAssets('col-uuid', ['uuid1', 'uuid2', 'uuid3']);
```

#### User Context

```js
// Switch to a different user (merges anonymous → user)
await services.collections.loginAs('user-id');

// Switch back to anonymous
services.collections.logout();
```

---

## Renditions Service

**Location**: `scripts/asc/services/renditions/renditions.js`

Look up download renditions for assets based on MIME type and availability.

### Methods

#### `renditions.getRenditions(asset)`

Get all available renditions for an asset.

```js
const renditions = services.renditions.getRenditions(asset);
// renditions = [
//   { id: 'thumbnail', label: 'Thumbnail', url: '...' },
//   { id: 'web', label: 'Web', url: '...' },
//   { id: 'original', label: 'Original', url: '...' },
// ]
```

#### `renditions.getRendition(asset, id)`

Get a specific rendition by ID.

```js
const web = services.renditions.getRendition(asset, 'web');
// web = { id: 'web', label: 'Web', url: '...' } or null
```

#### `renditions.getThumbnailUrl(asset)`

Get the best thumbnail URL with fallback to a placeholder.

```js
const thumbUrl = services.renditions.getThumbnailUrl(asset);
// thumbUrl = 'https://aem/.../cq5dam.thumbnail.jpeg'
```

### Asset Model — Computed Rendition Property

#### `asset.renditionsBoundingAspectRatio`

CSS `aspect-ratio` string for the most-portrait (tallest) rendition across all configured renditions and the asset's TIFF dimensions. Use as the initial container AR so every rendition fits without clipping. Bars appear for wider renditions but nothing is cropped. Falls back to `"4 / 3"` when no dimension metadata is available.

```js
// Set initial container AR — fits the tallest rendition without clipping
block.style.setProperty('--preview-ar', asset.renditionsBoundingAspectRatio);
// e.g. "--preview-ar: 1280 / 960"

// Then snap to the actual loaded image's natural dimensions
img.addEventListener('load', () => {
  if (img.naturalWidth && img.naturalHeight) {
    container.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
  }
}, { once: true });
```

---

## Properties Service

**Location**: `scripts/asc/services/properties/properties.js`

Get asset properties (title, thumbnail, MIME type, dimensions, etc.).

### Methods

#### `asset.getProperty(name)`

Get a property value from an asset. Used by Asset instances:

```js
const title = asset.getProperty('title');           // dc:title
const thumb = asset.getProperty('thumbnail');       // Thumbnail URL
const mime = asset.getProperty('mime-type');        // Full MIME type
const ext = asset.getProperty('file-extension');    // e.g. 'jpg'
const size = asset.getProperty('file-size');        // Formatted: "1.2 MB"
const dims = asset.getProperty('dimensions');       // { width, height }
const modified = asset.getProperty('modified');     // Date string
const custom = asset.getProperty('brand');          // Custom property
```

#### Built-in Properties

| Name | Returns | Source |
|------|---------|--------|
| `title` | String | `dc:title` |
| `thumbnail` | URL | JCR rendition |
| `file-type` | Label | Inferred from MIME |
| `file-size` | Formatted | File size metadata |
| `file-extension` | String | Node name |
| `dimensions` | `{ width, height }` | Image metadata |
| `width` / `height` | Integer | Image metadata |
| `mime-type` | String | JCR metadata |
| `modified` | Date string | `lastModified` |
| `created` | Date string | JCR metadata |
| `description` | String | `dc:description` |
| `filename` | String | Node filename |

#### Custom Properties

Define in `configurations.js`:

```js
properties: {
  custom: {
    'brand': (asset) => asset.data.metadata['myco:brand'],
    'approval-status': (asset) => {
      const status = asset.data.metadata['dam:status'];
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : null;
    },
  }
}
```

Then use:

```js
const brand = asset.getProperty('brand');
```

---

## AEM Service

**Location**: `scripts/asc/services/aem/aem.js`

AEM connection details and auth headers.

### Methods

#### `aem.host`

Get the AEM host URL.

```js
const host = services.aem.host;
// host = 'https://author.aem.com'
```

#### `aem.getAuthHeaders()`

Get Authorization headers for AEM API calls.

```js
const headers = services.aem.getAuthHeaders();
// headers = { Authorization: 'Bearer token...' } or {}
```

#### `aem.apiUrl(path)`

Build a full AEM API URL.

```js
const url = services.aem.apiUrl('/content/dam/my-asset');
```

---

## Asset Details Service

**Location**: `scripts/asc/services/asset-details/asset-details.js`

Open/close asset details modals, handle URL-based deep linking.

### Methods

#### `assetDetails.open(uuid)`

Open asset details modal for a UUID.

```js
await services.assetDetails.open('uuid-123');
// Modal opens; `?asset=uuid-123` added to URL
```

#### `assetDetails.close()`

Close the details modal.

```js
services.assetDetails.close();
// Modal closes; `?asset` removed from URL
```

#### `assetDetails.openFromUrl()`

Open details if `?asset={uuid}` is in the URL (called on page load).

```js
// Called internally; usually no need to call manually
```

---

## Downloads Service

**Location**: `scripts/asc/services/downloads/downloads.js`

Manage asynchronous AEM bulk-download jobs.

### Methods

#### `downloads.create(assetPaths, renditionIds, options?)`

Create a new bulk-download job.

```js
const jobId = await services.downloads.create(
  ['/content/dam/asset1', '/content/dam/asset2'],
  ['web', 'original'],
  { collectionId: 'col-uuid', autoDownload: true }
);
```

#### `downloads.get(jobId)`, `downloads.getAll()`

Retrieve job status.

```js
const job = services.downloads.get('job-uuid');
// job = {
//   id: 'local-job-uuid',
//   status: 'running' | 'complete' | 'failed',
//   downloadUrl: 'https://...',
//   error: null or error message,
//   createdAt, updatedAt, expiresAt,
// }

const allJobs = services.downloads.getAll();
// allJobs = sorted newest first
```

#### `downloads.resume(jobId, autoDownload?)`

Resume polling for a job that didn't finish quickly.

```js
await services.downloads.resume('job-uuid', true);
// Resume polling; auto-trigger browser download when complete
```

#### `downloads.triggerDownload(jobId)`

Manually trigger browser download for a completed job.

```js
services.downloads.triggerDownload('job-uuid');
```

---

## Users Service

**Location**: `scripts/asc/services/users/users.js`

Detect IMS/SSO login status and provide auth context.

### Methods

#### `users.getUser()`

Get current user info if logged in.

```js
const user = await services.users.getUser();
// user = { id: 'user-123', email: 'user@example.com' } or null
```

#### `users.isLoggedIn()`

Check if user is authenticated.

```js
const loggedIn = await services.users.isLoggedIn();
// loggedIn = boolean
```

#### `users.getAuthHeaders()`

Get auth headers for authenticated API calls (delegates to AEM service).

```js
const headers = services.users.getAuthHeaders();
```

---

## URL Service

**Location**: `scripts/asc/services/url/url.js`

URL utilities for encoding/decoding asset lists for sharing.

### Methods

#### `url.compressArray(array)`, `url.decompressToArray(compressed)`

Low-level compression for URL encoding. Used by the collection share dialog to encode the `?sheet=` payload — prefer these when building new share flows.

```js
const encoded = await services.url.compressArray(['a', 'b', 'c']);
const decoded = await services.url.decompressToArray(encoded);
```

---

## Storage Service

**Location**: `scripts/asc/services/storage/storage.js`

User-scoped and global localStorage management.

### Methods

#### User-Scoped

```js
// Get/set/remove
storage.get('key');
storage.set('key', value);
storage.remove('key');

// Recently viewed assets
storage.addRecentlyViewed('uuid');
storage.getRecentlyViewed();  // → ['uuid1', 'uuid2', ...]

// Theme
storage.getTheme();
storage.setTheme('dark');

// Shared links
storage.addSharedLink('https://...', 'label');
storage.getSharedLinks();  // → [{ url, label, receivedAt }, ...]
```

#### Global (Shared)

```js
storage.getGlobal('key');
storage.setGlobal('key', value);
storage.removeGlobal('key');
```

#### Cross-Tab Sync

```js
// Listen for changes from other tabs
storage.onExternalChange((key) => {
  console.log('Storage changed in another tab:', key);
});

// Merge user data (used by loginAs)
storage.mergeUserData('from-user-id', 'to-user-id');
```

---

## Fragment Service

**Location**: `scripts/asc/utils/fragments.js` (not a service singleton, but important utility)

Load EDS fragment pages dynamically.

### Methods

#### `loadFragment(path)`

Load a fragment page.

```js
import { loadFragment } from '../../scripts/asc/utils/fragments.js';

const fragment = await loadFragment('/details');
// fragment = <main> element with all blocks decorated
```

---

## Events Service

**Location**: `scripts/asc/utils/events.js` (utility, not a service)

Helpers for event delegation.

### Methods

#### `delegateEvent(element, selector, event, handler)`

Delegate events to child elements.

```js
import { delegateEvent } from '../../scripts/asc/utils/events.js';

delegateEvent(block, '.my-button', 'click', (e) => {
  console.log('Button clicked:', e.target);
});
```

---

## Blocks Service

**Location**: `scripts/asc/utils/blocks.js` (utility)

Block decoration helpers.

### Methods

#### `decorateBlocksRecursively(element)`

Decorate all blocks within an element (used by `loadFragment`).

```js
import { decorateBlocksRecursively } from '../../scripts/asc/utils/blocks.js';

decorateBlocksRecursively(fragment);
```

---

## Init Service

**Location**: `scripts/asc/services/init/init.js`

Page initialization and configuration.

### Methods

#### `init.loadConfiguration()`

Load and merge all configurations.

```js
const config = await services.init.loadConfiguration();
```

#### `init.applyConfiguration(config)`

Apply configuration to all services.

```js
services.init.applyConfiguration(userConfigs);
```

---

## Search Provider Pattern

All search providers (QueryBuilder, OpenAPI, custom) implement:

```js
class SearchProvider {
  async search(formData) {
    // formData: Map of QB field names → values
    // Return: { assets: [], total, size, offset, more, success }
  }

  buildParams(formData) {
    // Return URLSearchParams for this provider's API
  }

  async getAssetById(uuid) {
    // Fetch single asset by UUID
    // Return: Asset-like object
  }
}
```

---

## Service Usage Patterns

### Pattern 1: Get Search Results and Render

```js
export default function decorate(block) {
  document.addEventListener('asc:search:complete', (e) => {
    const { assets } = e.detail.results;
    block.innerHTML = assets.map(a => assetTeaser(a)).join('');
  });
}
```

### Pattern 2: Add Asset to Collection

```js
const button = block.querySelector('button');
button.addEventListener('click', async () => {
  const assetId = block.dataset.assetId;
  await services.collections.addAsset(assetId);  // Adds to active collection
});
```

### Pattern 3: Fetch Single Asset

```js
const asset = await services.search.getAssetById('uuid-123');
const title = asset.getProperty('title');
```

### Pattern 4: Get Download URLs

```js
const asset = await services.search.getAssetById('uuid-123');
const renditions = services.renditions.getRenditions(asset);

renditions.forEach((r) => {
  console.log(`${r.label}: ${r.url}`);
});
```

### Pattern 5: Custom Property in Block

```js
// In configurations.js
properties: {
  custom: {
    'my-custom': (asset) => asset.data.metadata['my:field'] || '—',
  }
}

// In block
const custom = asset.getProperty('my-custom');
```

---

All services are initialized on import and configured via `scripts/configurations.js`. See [SKILL.md](../SKILL.md) for the configuration extension guide.
