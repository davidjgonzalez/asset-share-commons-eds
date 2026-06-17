# ASC Event Reference

Complete catalog of all 18+ ASC events, their payload shapes, and code examples.

---

## Event Naming Convention

All ASC events follow: `asc:{noun}:{verb}`

**Dispatch scope**:
- Search events → `document`
- Asset/collection/download events → `document.body`

---

## Search Events

### `asc:search:execute`

**Fired by**: Any search filter block when user changes input (checkbox, radio, date, dropdown)

**Dispatch scope**: `document`

**When**: User selects a search filter option

**Payload**:
```js
{
  detail: {
    formId: 'asc-search-form',   // Form ID
    source: 'filter',             // or 'query-params', 'manual'
  }
}
```

**Handler example**:
```js
document.addEventListener('asc:search:execute', (e) => {
  console.log('Search executing from:', e.detail.source);
});
```

---

### `asc:search:complete`

**Fired by**: SearchService after results are fetched and processed

**Dispatch scope**: `document`

**When**: Search completes (with results or no results)

**Payload**:
```js
{
  detail: {
    results: {
      assets: Asset[],        // Array of hydrated Asset instances
      total: number,          // Total matching assets
      size: number,           // Assets in this batch
      offset: number,         // Current offset (for pagination)
      more: boolean,          // More pages available?
      success: boolean,
    },
    type: 'search',
    formData: Map,            // Raw form field names → values
  }
}
```

**Handler example**:
```js
document.addEventListener('asc:search:complete', (e) => {
  const { assets, total } = e.detail.results;
  console.log(`Found ${total} assets, showing ${assets.length}`);
  
  // Update UI
  updateResultsUI(assets);
});
```

---

### `asc:search:error`

**Fired by**: SearchService if search fails

**Dispatch scope**: `document`

**Payload**:
```js
{
  detail: {
    error: Error,           // The error object
    formData: Map,          // Form data that caused the error
  }
}
```

**Handler example**:
```js
document.addEventListener('asc:search:error', (e) => {
  console.error('Search failed:', e.detail.error.message);
  showErrorMessage('Search failed. Please try again.');
});
```

---

## Asset Events

### `asc:asset:details:open`

**Fired by**: Actions service when user clicks on `[data-asc-action="asset:details:open"]`

**Dispatch scope**: `document.body`

**When**: User clicks an asset to view details

**Payload**:
```js
{
  detail: {
    data: {
      ascAsset: 'uuid-string',    // Asset UUID
      ascCollection: 'col-id',    // Optional collection ID (if in collection context)
    }
  }
}
```

**Handler example**:
```js
document.body.addEventListener('asc:asset:details:open', (e) => {
  const { ascAsset } = e.detail.data;
  console.log('Opening asset:', ascAsset);
  
  // AssetDetails service handles this; custom handlers can log/analytics
  trackEvent('asset_opened', { assetId: ascAsset });
});
```

---

### `asc:asset:details:close`

**Fired by**: AssetDetails service when user closes the details modal

**Dispatch scope**: `document.body`

**Payload**:
```js
{ /* empty detail */ }
```

**Handler example**:
```js
document.body.addEventListener('asc:asset:details:close', () => {
  console.log('Details modal closed');
  // Update URL history if needed
  window.history.replaceState({}, '', window.location.pathname);
});
```

---

### `asc:asset:preload`

**Fired by**: Actions service when user hovers over `[data-asc-preload]` (if `init.preload` enabled)

**Dispatch scope**: `document.body`

**When**: User hovers asset and preload is triggered

**Payload**:
```js
{
  detail: {
    data: {
      ascPreload: '/path/to/asset',  // Path to preload
    }
  }
}
```

---

### `asc:asset:share`

**Fired by**: Actions service when user clicks `[data-asc-action="asset:share"]`

**Dispatch scope**: `document.body`

**When**: User clicks a custom "share" action

**Payload**:
```js
{
  detail: {
    data: {
      ascAsset: 'uuid-string',
    }
  }
}
```

**Handler example**:
```js
document.body.addEventListener('asc:asset:share', async (e) => {
  const { ascAsset } = e.detail.data;
  const asset = await services.search.getAssetById(ascAsset);
  
  // Open custom share dialog
  openShareDialog(asset);
});
```

---

## Collection Events

### `asc:collection:add`

**Fired by**: Actions service when user clicks `[data-asc-action="collection:add"]`

**Dispatch scope**: `document.body`

**When**: User adds an asset to a collection

**Payload**:
```js
{
  detail: {
    data: {
      ascAsset: 'uuid-string',
      ascCollection: 'col-id-or-null',  // null = use active collection
    }
  }
}
```

---

### `asc:collection:remove`

**Fired by**: Actions service when user clicks `[data-asc-action="collection:remove"]`

**Dispatch scope**: `document.body`

**Payload**:
```js
{
  detail: {
    data: {
      ascAsset: 'uuid-string',
      ascCollection: 'col-id',
    }
  }
}
```

---

### `asc:collection:change`

**Fired by**: Collections service after any collection mutation

**Dispatch scope**: `document.body`

**When**: Collection is modified (asset added/removed, renamed, activated, etc.)

**Payload**:
```js
{
  detail: {
    action: 'created' | 'deleted' | 'renamed' | 'activated' | 'assetAdded' | 'assetRemoved' | 'reordered' | 'login' | 'logout' | 'external',
    id: 'collection-uuid',
    collectionId: 'collection-uuid',     // For asset events
    assetId: 'asset-uuid',               // For asset events
    userId: 'user-id',                   // When user logs in/out
    source: 'internal' | 'external',     // external = cross-tab sync
  }
}
```

**Handler example**:
```js
document.body.addEventListener('asc:collection:change', (e) => {
  const { action, id, assetId } = e.detail;
  
  if (action === 'assetAdded') {
    console.log(`Asset ${assetId} added to collection ${id}`);
    // Update UI (e.g. toggle button state)
  } else if (action === 'renamed') {
    console.log(`Collection ${id} renamed`);
    // Refresh collection name displays
  }
});
```

**Note**: The `collectionToggle` Part listens to this event automatically and re-hydrates its state on all instances. No extra wiring needed.

---

### `asc:collection:created`

**Fired by**: Collections service after new collection created

**Dispatch scope**: `document.body`

**Payload**:
```js
{
  detail: {
    collection: {
      id: 'uuid',
      name: 'My Collection',
      createdAt: 'ISO-8601',
      assetIds: [],
    }
  }
}
```

---

### `asc:collection:deleted`

**Fired by**: Collections service after collection deleted

**Payload**:
```js
{
  detail: {
    id: 'collection-uuid',
  }
}
```

---

### `asc:collection:activated`

**Fired by**: Collections service when active collection changes

**Dispatch scope**: `document.body`

**Payload**:
```js
{
  detail: {
    id: 'new-collection-uuid',
    previous: 'old-collection-uuid-or-null',
  }
}
```

---

## Download Events

### `asc:download:started`

**Fired by**: Downloads service when a bulk-download job is initiated

**Dispatch scope**: `document.body`

**When**: User clicks "Download collection" or similar

**Payload**:
```js
{
  detail: {
    jobId: 'local-job-uuid',
  }
}
```

---

### `asc:download:complete`

**Fired by**: Downloads service when AEM download job completes

**Dispatch scope**: `document.body`

**When**: Bulk download is ready; browser download triggers automatically

**Payload**:
```js
{
  detail: {
    jobId: 'local-job-uuid',
    downloadUrl: 'https://aem/path/to/download',
  }
}
```

**Handler example**:
```js
document.body.addEventListener('asc:download:complete', (e) => {
  const { jobId } = e.detail;
  console.log('Download ready:', jobId);
  // Show notification or update UI
});
```

---

### `asc:download:failed`

**Fired by**: Downloads service if AEM job fails

**Dispatch scope**: `document.body`

**Payload**:
```js
{
  detail: {
    jobId: 'local-job-uuid',
    error: 'Error message',
  }
}
```

---

### `asc:download:change`

**Fired by**: Downloads service for any job status update

**Dispatch scope**: `document.body`

**Payload**:
```js
{
  detail: {
    jobId: 'local-job-uuid',
    status: 'pending' | 'running' | 'complete' | 'failed',
  }
}
```

---

## Internal Events (Service-Only)

These are dispatched by ASC services and generally not listened to by custom code:

### `asc:blocks:loaded`

**Fired by**: Init service after all blocks are decorated

**Dispatch scope**: `document`

**When**: Page initialization complete

**Used by**: SearchService to detect if search blocks exist and run initial search

---

## Event Listening Best Practices

### Use Correct Scope

```js
// Search events
document.addEventListener('asc:search:complete', ...);

// Asset/collection/download events
document.body.addEventListener('asc:collection:change', ...);
```

### Handle Missing Data

```js
document.body.addEventListener('asc:asset:details:open', (e) => {
  const { ascAsset, ascCollection } = e.detail?.data ?? {};
  
  if (!ascAsset) {
    console.warn('No asset ID in event');
    return;
  }
  
  // Process asset
});
```

### Use Declarative for Simple Cases

Instead of listening imperative code for common actions:

```html
<!-- Instead of manual listener: -->
<button data-asc-action="collection:add@click" data-asc-asset="uuid">
  Add to collection
</button>
```

### Document Custom Events

If you dispatch custom events in your blocks, add them to this reference and document the payload shape.

---

## Quick Reference Table

| Event | Scope | Fired by | Payload | Use for |
|-------|-------|----------|---------|---------|
| `asc:search:execute` | document | Filter blocks | `{ formId, source }` | Analytics, custom filtering |
| `asc:search:complete` | document | SearchService | `{ results, type, formData }` | Update results UI |
| `asc:search:error` | document | SearchService | `{ error, formData }` | Show error messages |
| `asc:asset:details:open` | document.body | Actions service | `{ data: { ascAsset, ascCollection } }` | Analytics |
| `asc:asset:details:close` | document.body | AssetDetails | `{}` | URL cleanup |
| `asc:asset:share` | document.body | Actions service | `{ data: { ascAsset } }` | Custom share handlers |
| `asc:collection:add` | document.body | Actions service | `{ data: { ascAsset, ascCollection } }` | Custom add handlers |
| `asc:collection:change` | document.body | Collections | `{ action, id, assetId, ... }` | Update collection UI |
| `asc:download:started` | document.body | Downloads | `{ jobId }` | Show loading state |
| `asc:download:complete` | document.body | Downloads | `{ jobId, downloadUrl }` | Show success message |
