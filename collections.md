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
  - label: Sharing
    items:
      - title: Share URL Format
        url: "#share-url"
      - title: Branded vs. Standalone (Chrome)
        url: "#chrome"
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
      - title: Published Collections
        url: "#published"
---

# Collections & State

Asset Share Commons provides a client-side state management system for asset collections, board layout (position, notes, free-floating text), and shareable sheet URLs. All state is stored in `localStorage` under a per-user namespace.

---

## Overview {#overview}

A **collection** is a named, persistent board of items — asset references plus optional section headings — with positions, notes, and free text. Every user gets a **default collection** that cannot be deleted. Additional named collections can be created programmatically or from the `collections` / `collection-switcher` UI.

Key properties:
- Collections are user-scoped (isolated by user ID in localStorage)
- The **active collection** is the target for `Add to Collection` actions when no specific collection is specified
- Anonymous user data is automatically **merged into the logged-in user's default collection** on login
- Changes in one browser tab propagate to other tabs via the `storage` event
- The [`board`](/blocks#board) block renders a collection (interactive, editable) or a shared sheet (read-only) from the same canvas UI

---

## Storage Schema {#schema}

Stored under `storage.get('collections')` (user-scoped):

```js
{
  defaultId: "550e8400-e29b-41d4-a716-446655440000",  // permanent — never deleted
  items: {
    "550e8400-e29b-41d4-a716-446655440000": {
      id:         "550e8400-e29b-41d4-a716-446655440000",
      name:       "My Collection",
      createdAt:  "2026-03-31T10:00:00.000Z",
      modifiedAt: "2026-03-31T10:05:00.000Z",
      items: [
        // Asset item — board position and notes are both optional
        { type: 'asset', id: 'uuid-1', mimeType: 'image/jpeg', x: 120, y: 40, notes: 'Hero shot' },
        { type: 'asset', id: 'uuid-2' },
        // Section item — a heading/body card placed on the board
        { type: 'section', id: 'sec-1', title: 'Q3 Hero Options', body: 'Pick one for the homepage' },
      ],
    },
  },
}
```

The active collection ID is stored separately:

```js
localStorage["asc:{userId}"].activeCollectionId  // UUID | null (null → use defaultId)
```

> **Board position (`x`/`y`) and `notes`** are per-item, set via drag/drop and the notes UI on the `board` block (`mode: interactive`) and persisted through `collections.updateItem()`.

---

## API Reference {#api}

Access via the `services` singleton:

```js
import services from '../../scripts/asc/core/services/services.js';
const { collections } = services;
```

### Collection CRUD

```js
collections.create('Campaign Spring 2026');   // → Collection (not hydrated)
collections.rename(id, 'Campaign Summer 2026');
collections.delete(id);                       // the default collection is protected
```

### Getters

Pass `hydrateAssets = true` to add a resolved `assets: Asset[]` array to each collection.

```js
await collections.getAll(hydrateAssets?);          // → Collection[]
await collections.get(id, hydrateAssets?);         // → Collection | null
await collections.getDefault(hydrateAssets?);      // → Collection
await collections.getActive(hydrateAssets?);       // → Collection
      collections.getActiveId();                   // synchronous — → UUID
      collections.setActive(id);
```

### Asset Management

`collectionId` is optional — omit to target the **active collection**.

```js
await collections.addAsset(assetId, collectionId?);
await collections.removeAsset(assetId, collectionId?);
await collections.hasAsset(assetId, collectionId?);   // → boolean
```

### Board Items — position, notes, sections

```js
// Partial update of an asset item's board position and/or notes
collections.updateItem(collectionId, assetId, { x?, y?, notes? });

// Replace the full ordered asset list (programmatic use — the board itself uses x/y, not order)
collections.reorderAssets(collectionId, newAssetIds);

// Section cards (free-floating headings on the board)
await collections.addSection(collectionId, { title?, body? });      // → SectionItem
      collections.updateSection(collectionId, sectionId, { title, body });
await collections.removeSection(collectionId, sectionId);
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

`action` values in `asc:collection:change`: `"created"`, `"deleted"`, `"renamed"`, `"activated"`, `"assetAdded"`, `"assetRemoved"`, `"reordered"`, `"login"`, `"logout"`, or `"external"` (cross-tab).

```js
document.addEventListener('asc:collection:change', ({ detail }) => {
  if (detail.action === 'assetAdded') updateCartCount();
});
```

---

## Login & Merge {#login}

When a user authenticates, call `loginAs(userId)` to migrate anonymous state:

```js
await collections.loginAs(userId);
```

This reads every anonymous collection, merges (deduplicated) into the logged-in user's default collection, migrates recently-viewed assets, switches the active user context, and dispatches `asc:collection:change` with `action: "login"`.

```js
collections.logout();
// Switches storage context back to anonymous; dispatches action: "logout"
```

The logged-in user's data remains in localStorage and is available again on next login.

---

## Share URL Format {#share-url}

The **Share** action on `collection-controls` (via the `action-share` block) encodes the full board state as a single compressed JSON payload appended to the configured `sheetPath` (default `/sheets/`):

```
{sheetPath}?sheet={compressArray([JSON.stringify(payload)])}
```

Payload structure:

```js
{
  title:        string,
  description?: string,
  expiresAt?:   ISO string,          // optional expiry — board/sheet-controls show an error/empty state past this
  items:        string[],            // encoded asset and section items
  textElements?: { x, y, w, h, content }[],  // free-floating text from the board
}
```

Item encoding within `items[]`:

| Item | Encoding |
|------|----------|
| Asset, no position/notes | `"uuid"` |
| Asset, with board position | `"uuid@x,y"` |
| Asset, with notes | `"uuid@x,y\|\|\|notes text"` or `"uuid\|\|\|notes text"` |
| Section heading | `"~title\|\|\|body"` |

Both the [`board`](/blocks#board) block (`source: sheet`) and the [`sheet-controls`](/blocks#sheet-controls) block independently decode this same payload — one for the canvas, one for the header. Use `services.url.compressArray` / `decompressToArray` (native `CompressionStream('deflate')`, URL-safe base64) if you need to build or read this payload programmatically.

The generated URL also carries an explicit `&chrome=none` or `&chrome=full`, set by the "Share as a standalone page" switch on the [`action-share`](/blocks#action-share) dialog. See [Branded vs. Standalone Shares](#chrome) below.

```js
import services from '../../scripts/asc/core/services/services.js';

const encoded = await services.url.compressArray([JSON.stringify(payload)]);
const [json]  = await services.url.decompressToArray(encoded);
```

---

## Downloads Service {#downloads}

`scripts/asc/core/services/downloads/downloads.js` — manages async AEM bulk-download jobs. Jobs are persisted in user-scoped localStorage and survive page reloads so users can return to check on slow downloads.

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
import services from '../../scripts/asc/core/services/services.js';
const { downloads } = services;

// Initiate a bulk download (returns local job immediately; AEM call is async)
const job = await downloads.create(
  ['/content/dam/brand/hero.jpg', '/content/dam/brand/logo.png'],
  ['original'],
  { collectionId: 'abc-123', autoDownload: true },   // both optional
);

downloads.getAll();               // → all jobs for the current user, newest first
downloads.get(jobId);             // → single job
await downloads.resume(jobId);    // resume polling for a job that didn't finish quickly
downloads.triggerDownload(jobId); // manually trigger the browser download for a completed job
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

```js
// configurations.js
downloads: {
  binariesUrl: '/content/dam.downloadbinaries.json',  // AEM Assets download framework endpoint
  actionPath: '/actions/download',                     // DA fragment providing the dialog's intro content

  // Legacy async-polling variant (still available as services.downloads):
  // initiateUrl: '/content/dam.downloads.initiateDownload.json',
  // quickPollTimeout: 15000,
  // pollInterval: 2000,
  // jobExpiry: 7 * 24 * 60 * 60 * 1000,
},
```

---

## Storage Service {#storage}

`scripts/asc/core/services/storage/storage.js` — the underlying persistence layer.

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
import storage from '../../scripts/asc/core/services/storage/storage.js';

// User-scoped
storage.get(key); storage.set(key, value); storage.remove(key);

// Global (not user-scoped)
storage.getGlobal(key); storage.setGlobal(key, value); storage.removeGlobal(key);

// Recently viewed assets (user-scoped, capped at 50, deduplicated)
storage.addRecentlyViewed(uuid);
storage.getRecentlyViewed();    // → string[]

// Theme (global)
storage.getTheme(); storage.setTheme(name);

// Shared links (global, deduplicated by URL)
storage.addSharedLink(url, label?);
storage.getSharedLinks();       // → { url, label, receivedAt }[]
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
document.addEventListener('asc:collection:change', ({ detail }) => {
  if (detail.source === 'external') rerender();  // another tab made changes
});
```

---

## Collection URLs {#urls}

Low-level compression helpers, used by the sharing flow above:

```js
import services from '../../scripts/asc/core/services/services.js';

const encoded = await services.url.compressArray(['uuid1', 'uuid2']);
const values  = await services.url.decompressToArray(encoded);

// Legacy helpers — still available but not used by the board/sheet share flow
const shareUrl  = await services.url.toCollectionUrl(assetIds, { param: 'assets', base: 'https://example.com/sheet' });
const assetIds  = await services.url.fromCollectionUrl(window.location.search, 'assets');
```

---

## Sheets vs Collections {#sheets}

These are two distinct concepts that are easy to confuse:

| | **Collections** | **Sheets** |
|---|---|---|
| **What it is** | A locally-managed board of asset/section items | A curated, read-only board rendered from a shared URL |
| **Storage** | `localStorage` (client-side only) | Encoded entirely in the URL — no server storage |
| **Created by** | End users (dynamically, via the board) | Generated by the Share action on a collection |
| **Persistence** | Per browser / device | As long as the URL is kept (optional `expiresAt`) |
| **Shareable** | Not directly — share a sheet link instead | Via the `?sheet=` URL |
| **Editing** | `board` in `interactive` mode | `board` in `view` mode — read-only |
| **AEM Collections** | No relation | No relation |

> **Note:** Neither "Collections" nor "Sheets" in ASC EDS corresponds to [AEM Assets Collections](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/manage/manage-collections). AEM Collections are server-side; ASC EDS collections are client-side localStorage only.

---

## Published Collections {#published}

A **published** collection is different from either of the above: something curated once, with a permanent, linkable URL, that any visitor can browse without having built it themselves (think "Spring 2026 Campaign" or "Press Kit"). Personal collections and one-off sheet links are both inherently client-side/URL-based; a published collection needs to be discoverable and stay put, which means it should be a page, not a client-side state blob. Two ways to build one, and neither needs anything "created" server-side beyond the page itself:

- **Saved search**: a page built from [`search-hidden`](/blocks#search-hidden) predicates plus [`search-results`](/blocks#search-results), so it stays current on its own as matching assets are added or retagged. Best when "everything tagged X" really is what the collection means.
- **Authored list**: a page built from [`board`](/blocks#board) with `source: authored`, defined by a fixed set of asset IDs typed directly onto the page. For when you want exactly these items and nothing else. Always read-only; edit the page's authored list to change what's in it. `mode: sheet-url` is a variant of this: instead of a hand-typed ID list, the page authors an already-generated share URL (from the normal Share flow on some collection), so the same board/sheet decoding logic in [Share URL Format](#share-url) applies.

[`share-directory`](/blocks#share-directory) is a curated index of links to pages like these. Add a row per published collection you create. It resolves a preview thumbnail automatically for most link types; see the block reference for exactly which ones.

---

## Branded vs. Standalone Shares {#chrome}

Any share, sheet, or board page can render two ways: **branded**, with the full site header, footer, search, and collections navigation (the visitor is still "inside" the wider asset library), or **standalone**, with none of that (the page reads as its own discrete microsite, with no way to wander back into the rest of the site through the UI). This is a presentational choice, not an access-control one: it hides navigation, not AEM/DAM permissions. Someone can still edit the URL by hand; nothing about this restricts what they can technically reach.

Resolution order (`scripts/asc/chrome.js`):

1. `?chrome=full` on the URL: force branded, overriding everything else
2. `?chrome=none` on the URL: force standalone, overriding everything else
3. `<meta name="chrome" content="none">`, authored in a page's `<head>`, for a fixed/published collection page (see [Published Collections](#published) above)
4. A `.sheet` block, or a `?sheet=` URL param: an ad hoc personal share, which has always defaulted to standalone
5. Otherwise, branded (today's default for everything else)

The [`action-share`](/blocks#action-share) dialog's "Share as a standalone page" switch makes step 4's default an explicit, per-share choice rather than a fixed rule, by appending `&chrome=none` or `&chrome=full` to the generated URL (see [Share URL Format](#share-url)). For a published collection page, add `<meta name="chrome" content="none">` to its `<head>` to opt that one page into standalone mode. A press kit is a natural fit, since external media shouldn't need to navigate the rest of the internal library.

Every standalone page gets one small floating link (bottom-right) to flip to the other mode, so nothing is a dead end. If you author a custom "back to search" / "back to shares" style link into a share page's own content, add a `data-asc-nav-link` attribute to it: it'll be hidden along with the header/footer in standalone mode, the same as any other way back into the site a standalone page isn't supposed to have.
