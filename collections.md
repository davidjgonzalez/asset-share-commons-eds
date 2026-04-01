---
layout: page
title: Collections & State
permalink: /collections
sidebar:
  - label: Collections
    items:
      - title: Overview
        url: "#overview"
      - title: Storage Schema
        url: "#schema"
      - title: API Reference
        url: "#api"
      - title: Events
        url: "#events"
      - title: Login & Merge
        url: "#login"
  - label: Downloads
    items:
      - title: Downloads Service
        url: "#downloads"
      - title: Download Job Schema
        url: "#download-schema"
      - title: Downloads API
        url: "#downloads-api"
      - title: Download Events
        url: "#download-events"
  - label: Storage
    items:
      - title: Storage Service
        url: "#storage"
      - title: localStorage Structure
        url: "#localstorage"
      - title: Cross-tab Sync
        url: "#cross-tab"
  - label: URL Helpers
    items:
      - title: Collection URLs
        url: "#urls"
  - label: Authoring
    items:
      - title: Sheets vs Collections
        url: "#sheets"
---

# Collections & State

Asset Share Commons provides a client-side state management system for asset collections, recently viewed assets, and shareable collection URLs. All state is stored in `localStorage` under the `asc` namespace and is scoped per user.

---

## Overview {#overview}

A **collection** is a named, persistent set of asset UUIDs. Every user gets a **default collection** that cannot be deleted. Additional named collections can be created programmatically.

Key properties:
- Collections are user-scoped (isolated by user ID in localStorage)
- The **active collection** is the target for `Add to Collection` actions when no specific collection is specified
- Anonymous user selections are automatically **merged into the logged-in user's default collection** on login
- Changes in one browser tab propagate to other tabs via the `storage` event

---

## Storage Schema {#schema}

Stored under `localStorage["asc:{userId}"].collections`:

```js
{
  defaultId: "550e8400-e29b-41d4-a716-446655440000",  // permanent — never deleted
  items: {
    "550e8400-e29b-41d4-a716-446655440000": {
      id:         "550e8400-e29b-41d4-a716-446655440000",
      name:       "My Collection",
      createdAt:  "2026-03-31T10:00:00.000Z",
      modifiedAt: "2026-03-31T10:05:00.000Z",
      assetIds:   ["uuid-1", "uuid-2", "uuid-3"]
    },
    "661f9511-f30c-52e5-b827-557766551111": {
      id:         "661f9511-f30c-52e5-b827-557766551111",
      name:       "Campaign Spring 2026",
      createdAt:  "2026-03-31T11:00:00.000Z",
      modifiedAt: "2026-03-31T11:30:00.000Z",
      assetIds:   ["uuid-4", "uuid-5"]
    }
  }
}
```

The active collection ID is stored separately:

```js
localStorage["asc:{userId}"].activeCollectionId  // UUID | null (null → use defaultId)
```

---

## API Reference {#api}

Access via the `services` singleton:

```js
import services from '/scripts/asc/services/services.js';
const { collections } = services;
```

### Collection CRUD

```js
// Create a new named collection
const collection = collections.create('Campaign Spring 2026');
// → { id, name, createdAt, modifiedAt, assetIds: [] }

// Rename a collection
collections.rename(id, 'Campaign Summer 2026');

// Delete a collection (the default collection cannot be deleted)
collections.delete(id);
```

### Getters

Pass `hydrateAssets = true` to add a resolved `assets: Asset[]` array to each collection.

```js
// All collections
const all = await collections.getAll();           // → Collection[]
const all = await collections.getAll(true);       // → Collection[] with assets hydrated

// By ID
const c   = await collections.get(id);            // → Collection | null
const c   = await collections.get(id, true);      // → with assets hydrated

// Default and active collections
const def    = await collections.getDefault();
const active = await collections.getActive();
const id     = collections.getActiveId();         // synchronous — returns UUID

// Set active collection
collections.setActive(id);
```

### Asset Management

`collectionId` is optional — omit to target the **active collection**.

```js
await collections.addAsset(assetId);               // add to active
await collections.addAsset(assetId, collectionId); // add to specific collection

await collections.removeAsset(assetId);
await collections.removeAsset(assetId, collectionId);

const inCollection = await collections.hasAsset(assetId);
const inSpecific   = await collections.hasAsset(assetId, collectionId);
// → boolean
```

### Asset Reordering

```js
// Replace the full ordered asset list for a collection
collections.reorderAssets(collectionId, ['uuid-3', 'uuid-1', 'uuid-2']);
// Dispatches asc:collection:change with action: "reordered"
// IDs not present in the collection are silently ignored
```

---

## Events {#events}

All collection events are dispatched on `document`.

| Event | When | `detail` shape |
|-------|------|----------------|
| `asc:collection:change` | Any mutation or cross-tab sync | `{ action, id?, collectionId?, assetId?, userId?, source? }` |
| `asc:collection:created` | New collection created | `{ collection }` |
| `asc:collection:deleted` | Collection deleted | `{ id }` |
| `asc:collection:activated` | Active collection switched | `{ id, previous }` |

`action` values in `asc:collection:change`:

| Action | Trigger |
|--------|---------|
| `"created"` | `collections.create()` |
| `"deleted"` | `collections.delete()` |
| `"renamed"` | `collections.rename()` |
| `"activated"` | `collections.setActive()` |
| `"assetAdded"` | `collections.addAsset()` |
| `"assetRemoved"` | `collections.removeAsset()` |
| `"reordered"` | `collections.reorderAssets()` |
| `"login"` | `collections.loginAs()` |
| `"logout"` | `collections.logout()` |
| `"external"` | Cross-tab storage event |

Listening example:

```js
document.addEventListener('asc:collection:change', ({ detail }) => {
  if (detail.action === 'assetAdded') {
    updateCartCount();
  }
});
```

---

## Login & Merge {#login}

When a user authenticates, call `loginAs(userId)` to migrate anonymous state:

```js
// In your IMS login callback:
await collections.loginAs(userId);
```

This:
1. Reads all asset IDs from **every anonymous collection**
2. Merges them (deduplicated) into the logged-in user's **default collection**
3. Migrates recently viewed assets from anonymous → user storage
4. Switches the active user context to `userId`
5. Dispatches `asc:collection:change` with `action: "login"`

### Logout

When the user signs out, call `logout()` to return to the anonymous scope:

```js
collections.logout();
// Switches storage context back to anonymous
// Dispatches asc:collection:change with action: "logout"
```

The logged-in user's data remains in localStorage and will be available again on next login.

---

## Downloads Service {#downloads}

`scripts/asc/services/downloads/downloads.js` — manages async AEM bulk-download jobs. Jobs are persisted in user-scoped localStorage and survive page reloads so users can return to check on slow downloads.

**Flow:**
1. Call `downloads.create(assetPaths, renditionIds)` — submits a job to the AEM download framework via HTTP and returns immediately
2. The service polls AEM every ~2 s for up to 15 s
3. If the job finishes within the quick-poll window, the browser download triggers automatically
4. If it takes longer, the job is left as `"running"` and can be resumed later with `downloads.resume(jobId)`
5. Expired jobs (default 7 days) are cleaned up automatically on service init

### Download Job Schema {#download-schema}

Stored under `storage.get(storage.DOWNLOAD_JOBS).jobs`:

```js
{
  id:           "local-uuid",           // crypto.randomUUID()
  collectionId: "collection-uuid",      // source collection (for reference)
  assetPaths:   ["/content/dam/..."],   // JCR paths submitted to AEM
  renditionIds: ["original", "web"],
  status:       "pending",              // "pending" | "running" | "complete" | "failed"
  aemJobId:     "aem-job-id",           // job ID returned by AEM
  downloadUrl:  "/content/dam/...",     // available when status is "complete"
  error:        null,                   // error message when status is "failed"
  createdAt:    "2026-04-01T10:00:00Z",
  updatedAt:    "2026-04-01T10:00:02Z",
  expiresAt:    "2026-04-08T10:00:00Z", // auto-cleaned after jobExpiry ms
}
```

### Downloads API {#downloads-api}

```js
import services from '/scripts/asc/services/services.js';
const { downloads } = services;

// Initiate a bulk download (returns local job immediately; AEM call is async)
const job = await downloads.create(
  ['/content/dam/brand/hero.jpg', '/content/dam/brand/logo.png'],
  ['original'],
  {
    collectionId: 'abc-123',   // optional — for reference only
    autoDownload: true,        // default true — trigger download when ready
  }
);

// Get all jobs for the current user (sorted newest first)
const jobs = downloads.getAll();

// Get a single job
const job = downloads.get(jobId);

// Resume polling for a job that didn't finish in the quick-poll window
const updatedJob = await downloads.resume(jobId);

// Manually trigger the browser download for a completed job
downloads.triggerDownload(jobId);
```

### Download Events {#download-events}

All dispatched on `document`.

| Event | When | `detail` |
|-------|------|---------|
| `asc:download:started` | Job created locally | `{ jobId }` |
| `asc:download:complete` | AEM job finished; download triggered | `{ jobId, downloadUrl }` |
| `asc:download:failed` | AEM or network error | `{ jobId, error }` |
| `asc:download:change` | Any job status update | `{ jobId, status }` |

### Configuration

In `configurations.js`:

```js
downloads: {
  // AEM servlet path — POST to initiate, GET ?jobId=<id> to poll
  initiateUrl: '/content/dam.downloads.initiateDownload.json',

  // Fast-poll window in ms before leaving job as "running" (default: 15 s)
  quickPollTimeout: 15000,

  // Poll interval in ms (default: 2 s)
  pollInterval: 2000,

  // Job TTL in ms — older jobs are auto-removed on service init (default: 7 days)
  jobExpiry: 7 * 24 * 60 * 60 * 1000,
},
```

---

## Storage Service {#storage}

`scripts/asc/services/storage/storage.js` — the underlying persistence layer.

### Key constants

| Constant | Key | Scope |
|----------|-----|-------|
| `COLLECTIONS` | `"collections"` | user |
| `ACTIVE_COLLECTION_ID` | `"activeCollectionId"` | user |
| `RECENTLY_VIEWED` | `"recentlyViewed"` | user |
| `DOWNLOAD_JOBS` | `"downloadJobs"` | user |
| `THEME` | `"theme"` | global |
| `SHARED_LINKS` | `"sharedLinks"` | global |

### API

```js
import storage from '/scripts/asc/services/storage/storage.js';

// User-scoped reads/writes
storage.get(key)           // → value | null
storage.set(key, value)
storage.remove(key)

// Global (not user-scoped)
storage.getGlobal(key)
storage.setGlobal(key, value)
storage.removeGlobal(key)

// Recently viewed assets (user-scoped, capped at 50, deduplicated)
storage.addRecentlyViewed(uuid)
storage.getRecentlyViewed()    // → string[]

// Theme (global)
storage.getTheme()             // → string | null
storage.setTheme(name)

// Shared links (global, deduplicated by URL)
storage.addSharedLink(url, label?)
storage.getSharedLinks()       // → { url, label, receivedAt }[]
```

### localStorage Structure {#localstorage}

```
localStorage
  ├── asc                → { currentUserId, theme, sharedLinks }
  ├── asc:anonymous      → { user, collections, activeCollectionId, recentlyViewed }
  └── asc:user123        → { user, collections, activeCollectionId, recentlyViewed }
```

### Cross-tab Sync {#cross-tab}

Storage changes in one tab fire a native `window.storage` event in other tabs. The Collections service listens via `storage.onExternalChange()` and dispatches `asc:collection:change` with `source: "external"`:

```js
// Listen to external (cross-tab) changes only
document.addEventListener('asc:collection:change', ({ detail }) => {
  if (detail.source === 'external') {
    rerender();  // another tab made changes — refresh the UI
  }
});
```

---

## Collection URLs {#urls}

Asset UUIDs can be encoded into a shareable URL using native browser compression (`CompressionStream('deflate')`). The result is URL-safe base64.

```js
import url from '/scripts/asc/services/url/url.js';

// Build a shareable URL for a list of asset IDs
const shareUrl = await url.toCollectionUrl(assetIds);
// → "https://example.com/sheet?assets=eJyr..."

// Custom param name or base URL
const shareUrl = await url.toCollectionUrl(assetIds, {
  param: 'assets',           // default
  base: 'https://example.com/sheet',
});

// Read asset IDs back from a URL
const assetIds = await url.fromCollectionUrl(window.location.search);
// → ["uuid-1", "uuid-2", ...]

// Custom param name
const assetIds = await url.fromCollectionUrl(window.location.search, 'assets');
```

The `sheet` block uses these helpers to receive a list of assets via URL and render a download page.

---

## Sheets vs Collections {#sheets}

These are two distinct concepts that are easy to confuse:

| | **Collections** | **Sheets** |
|---|---|---|
| **What it is** | A locally-managed set of asset UUIDs | A curated EDS page authored in da.live |
| **Storage** | `localStorage` (client-side only) | Edge Delivery Services document |
| **Created by** | End users (dynamically) | Content authors (statically) |
| **Persistence** | Per browser / device | Permanent URL |
| **Shareable** | Via encoded URL (`?assets=…`) | Via page URL |
| **Renditions** | User chooses on download sheet | Author-defined |
| **AEM Collections** | No relation | No relation |

> **Note:** Neither "Collections" nor "Sheets" in ASC EDS corresponds to [AEM Assets Collections](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/manage/manage-collections). AEM Collections are server-side; ASC EDS collections are client-side localStorage only.
