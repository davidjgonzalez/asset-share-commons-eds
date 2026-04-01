---
layout: page
title: Block Reference
permalink: /blocks
sidebar:
  - label: Search
    items:
      - title: search-bar
        url: "#search-bar"
      - title: search-property
        url: "#search-property"
      - title: search-path
        url: "#search-path"
      - title: search-date-range
        url: "#search-date-range"
      - title: search-tags
        url: "#search-tags"
      - title: search-sort
        url: "#search-sort"
      - title: search-results
        url: "#search-results"
      - title: search-pagination
        url: "#search-pagination"
      - title: search-hidden
        url: "#search-hidden"
  - label: Asset Details
    items:
      - title: details-modal
        url: "#details-modal"
      - title: details-preview
        url: "#details-preview"
      - title: details-property
        url: "#details-property"
      - title: details-download
        url: "#details-download"
      - title: details-actions
        url: "#details-actions"
      - title: details-similar
        url: "#details-similar"
  - label: Collections
    items:
      - title: collection-switcher
        url: "#collection-switcher"
      - title: collections
        url: "#collections"
      - title: collection
        url: "#collection"
      - title: stub
        url: "#stub"
      - title: sheet
        url: "#sheet"
---

# Block Reference

Every block is authored as a table in da.live. The first row is the block name; subsequent rows are key/value configuration pairs. Edge Delivery Services converts each table into a `.block.{name}` div and calls its `decorate(block)` function.

> **Provider-agnostic search blocks** — All search filter blocks emit QueryBuilder-style field names. The active search provider translates them to its API format transparently — no block changes needed when switching providers.

![Block authoring in da.live](https://placehold.co/860x380/111111/e91e8c?text=Block+Authoring+in+da.live&font=inter)

*Blocks are authored as simple tables in da.live — no code needed*

---

## search-bar {#search-bar}

**Search** · Keyword full-text search input. Dispatches `asc:search:execute` on input.

| Provider | Support |
|----------|---------|
| QueryBuilder | `fulltext` predicate |
| OpenAPI | `q` parameter |

```
| search-bar   |              |
|--------------|--------------|
| placeholder  | Search DAM…  |
```

| Key | Default | Description |
|-----|---------|-------------|
| `placeholder` | Search assets… | Input placeholder text |

---

## search-property {#search-property}

**Search** · Filter by any JCR metadata property. Supports `checkbox`, `radio`, and `dropdown`.

| Provider | Support |
|----------|---------|
| QueryBuilder | `property` predicate — any JCR property path |
| OpenAPI | Partial — only `jcr:content/metadata/dc:format` → `filter[assetFormat][]` and `jcr:content/metadata/cq:tags` → `filter[assetTagIds][]` are mapped. All other property paths are silently ignored. Use `search-tags` for tag filtering with OpenAPI. |

```
| search-property  |                                |
|------------------|--------------------------------|
| label            | Asset Type                     |
| property         | jcr:content/metadata/dc:format |
| type             | checkbox                       |
| options          | Image: image/jpeg              |
|                  | Video: video/mp4               |
|                  | Document: application/pdf      |
```

| Key | Default | Description |
|-----|---------|-------------|
| `label` | — | Filter heading |
| `property` | — | JCR metadata property path |
| `type` | `checkbox` | `checkbox` \| `radio` \| `dropdown` |
| `options` | — | One per line: `Label: value` |
| `and` | `false` | AND vs OR multi-select logic |

---

## search-path {#search-path}

**Search** · Filter by DAM folder path.

| Provider | Support |
|----------|---------|
| QueryBuilder | `path` predicate with `exact`, `flat`, `self` modifiers |
| OpenAPI | `filter[assetAncestorPath]` — first selected path value; `exact`/`flat`/`self` flags are ignored |

```
| search-path   |                           |
|---------------|---------------------------|
| label         | Folder                    |
| type          | radio                     |
| options       | Brand: /content/dam/brand |
|               | Products: /content/dam/products |
```

| Key | Default | Description |
|-----|---------|-------------|
| `label` | — | Filter heading |
| `type` | `checkbox` | `checkbox` \| `radio` \| `dropdown` |
| `options` | — | One per line: `Label: /dam/path` |

---

## search-date-range {#search-date-range}

**Search** · Date range filter with from/to date inputs.

| Provider | Support |
|----------|---------|
| QueryBuilder | `daterange` predicate |
| OpenAPI | `filter[createdAt][from/to]` or `filter[modifiedAt][from/to]` depending on `property` |

Supported `property` values for OpenAPI:

| JCR property | OpenAPI filter key |
|---|---|
| `jcr:content/metadata/jcr:created` | `createdAt` |
| `jcr:content/metadata/dam:assetCreated` | `createdAt` |
| `jcr:content/metadata/jcr:lastModified` | `modifiedAt` |
| `jcr:content/metadata/dam:assetLastModified` | `modifiedAt` |

```
| search-date-range  |                                  |
|--------------------|----------------------------------|
| label              | Created Date                     |
| property           | jcr:content/metadata/jcr:created |
```

| Key | Default | Description |
|-----|---------|-------------|
| `label` | — | Filter heading |
| `property` | — | JCR date property to filter on |

---

## search-tags {#search-tags}

**Search** · Filter by AEM tag.

| Provider | Support |
|----------|---------|
| QueryBuilder | `tagid` predicate |
| OpenAPI | `filter[assetTagIds][]` |

```
| search-tags  |                   |
|--------------|-------------------|
| label        | Tags              |
| root         | /content/cq:tags/ |
```

| Key | Default | Description |
|-----|---------|-------------|
| `label` | — | Filter heading |
| `root` | — | Limit tags to this namespace |

---

## search-sort {#search-sort}

**Search** · Dropdown to change sort field and direction.

```
| search-sort  |                                      |
|--------------|--------------------------------------|
| options      | Newest: jcr:created desc             |
|              | Oldest: jcr:created asc              |
|              | Title A-Z: jcr:content/jcr:title asc |
```

| Key | Default | Description |
|-----|---------|-------------|
| `options` | — | One per line: `Label: field direction` |

---

## search-results {#search-results}

**Search** · Renders the asset grid or list. Listens to `asc:search:complete` and renders asset teasers. Supports four layout modes.

```
| search-results  |           |
|-----------------|-----------|
| display         | waterfall |
| limit           | 24        |
```

| Key | Default | Description |
|-----|---------|-------------|
| `display` | `waterfall` | `cards` \| `list` \| `masonry` \| `waterfall` |
| `limit` | `24` | Results per page — also controls the infinite-scroll page size |

**Display modes:**

| Mode | Layout | Thumbnail shape |
|------|--------|-----------------|
| `cards` | Uniform grid | Square crop |
| `list` | Single-column rows with metadata | Thumbnail |
| `masonry` | CSS columns, uniform square crops | Square crop |
| `waterfall` | CSS columns, natural proportions | Natural |

**Drag and drop:** Every asset teaser has `draggable="true"`. Users can drag any result card directly into Finder, Photoshop, Slack, or any OS-level file target. The dragged file is the asset's `original` rendition (falls back to `web`). Requires Chrome or Edge — gracefully degrades to URI copy in Firefox/Safari.

![search-results four layout modes](https://placehold.co/860x420/111111/e91e8c?text=search-results+%E2%80%94+Four+Layout+Modes&font=inter)

*search-results block — cards, list, masonry, and waterfall modes*

---

## search-pagination {#search-pagination}

**Search** · Previous/next pagination. Syncs with `search-results` via `asc:search:complete`.

```
| search-pagination  |   |
|--------------------|---|
```

No configuration required.

---

## search-hidden {#search-hidden}

**Search** · Injects hidden search predicates as hidden form inputs. Use this block to enforce content-authorable, always-on filters on a specific search page — without editing `configurations.js`.

| Provider | Support |
|----------|---------|
| QueryBuilder | Any predicate name — passed verbatim |
| OpenAPI | Use `filter[*]` param names — passed verbatim |

Each row in the block table is a predicate `name → value` pair.

**QueryBuilder provider** — use exact QB predicate names from the [QueryBuilder reference](/querybuilder):

```
| search-hidden  |                        |
|----------------|------------------------|
| path           | /content/dam/brand     |
| excludepaths   | .*subassets.*          |
| mainasset      | true                   |
```

**OpenAPI provider** — use `filter[*]` param names from the OpenAPI Search API:

```
| search-hidden                  |                        |
|--------------------------------|------------------------|
| filter[assetAncestorPath]      | /content/dam/brand     |
| filter[assetTagIds][]          | my-namespace:my/tag    |
```

> **search-hidden vs basePredicates** — Both inject always-on filters. Use `basePredicates` in `configurations.js` for site-wide defaults; use `search-hidden` for page-specific overrides authored in da.live.

No visible UI is rendered — the block sets `display: none`.

---

## details-modal {#details-modal}

**Asset Details** · The modal shell that loads MIME-type-specific detail templates. Opens when the URL contains `?asset={uuid}`.

```
| details-modal  |   |
|----------------|---|
```

The template to render is determined by `configurations.assetDetails.templates`. The default path is `/details` (authored as `details/index` in da.live).

**Browser history navigation:** Every asset open pushes a history entry so the URL stays shareable and back/forward navigation works naturally:

- Opening an asset → `pushState` adds an entry with `?asset={uuid}`
- Browser back → reopens the previous asset, or closes the modal if there is none
- Browser forward → reopens the next asset
- Close button → `replaceState` removes `?asset` without adding a history entry
- Page loaded with `?asset=uuid` already in the URL (shared link) → `replaceState` marks the current entry; back navigates out of the page rather than closing the modal

---

## details-preview {#details-preview}

**Asset Details** · Renders the asset preview — image, video embed, PDF viewer, or a generic icon fallback.

```
| details-preview  |   |
|------------------|---|
```

Preview type is determined automatically from the asset's MIME type.

![details-preview — image and video preview](https://placehold.co/860x420/111111/9333ea?text=details-preview+%E2%80%94+Image+%26+Video+Preview&font=inter)

*details-preview — supports images, video, PDFs, and generic fallback icons*

---

## details-property {#details-property}

**Asset Details** · Renders a single metadata property value from the currently-open asset.

```
| details-property  |                               |
|-------------------|-------------------------------|
| label             | Title                         |
| property          | jcr:content/metadata/dc:title |
```

| Key | Default | Description |
|-----|---------|-------------|
| `label` | — | Display label |
| `property` | — | JCR property path or custom property name |
| `format` | — | `date` \| `bytes` \| `list` |

---

## details-download {#details-download}

**Asset Details** · Rendition download links for the open asset. Reads rendition definitions from `configurations.renditions`.

```
| details-download  |   |
|-------------------|---|
```

---

## details-actions {#details-actions}

**Asset Details** · Action buttons (Add to Cart, Share link, etc.) in the details modal.

```
| details-actions  |              |
|------------------|--------------|
| actions          | add-to-cart  |
|                  | share-link   |
```

| Key | Default | Description |
|-----|---------|-------------|
| `actions` | `add-to-cart` | Comma-separated action names |

---

## details-similar {#details-similar}

**Asset Details** · Horizontal strip of assets similar to the currently-open asset. Uses the QueryBuilder `similar` predicate to find related assets by shared tags and MIME type.

> **QueryBuilder only** — This block makes a direct QueryBuilder API call. It is not available when using the OpenAPI search provider.

```
| details-similar  |                                     |
|------------------|-------------------------------------|
| title            | You may also like                   |
| description      | Assets with similar tags and format |
| max              | 8                                   |
| show-empty       | false                               |
```

| Key | Default | Description |
|-----|---------|-------------|
| `title` | — | Heading rendered above the strip |
| `description` | — | Subtext rendered below the heading |
| `max` | `8` | Maximum number of similar assets to show |
| `show-empty` | `false` | When `true`, the block stays visible even when no similar assets are found; when `false` the block removes itself from the page |

All keys are optional — a bare `details-similar` table with no rows works fine.

**Behaviour:**
- Compares `dc:tags` and `dc:format` metadata between assets
- Renders up to `max` similar assets as square image-only thumbnails in a horizontally scrollable strip
- Clicking a thumbnail opens that asset in the details modal and pushes a new browser history entry — the back button returns to the previous asset

**Browser history navigation:** Opening an asset from the similar strip (or from any search result) pushes a history entry (`?asset={uuid}`). The browser back and forward buttons navigate between previously-viewed assets, and back past the first asset closes the modal.

![details-similar — horizontal similar assets strip](https://placehold.co/860x240/111111/9333ea?text=details-similar+%E2%80%94+Similar+Assets+Strip&font=inter)

*details-similar — scrollable strip of visually related assets*

---

## collection-switcher {#collection-switcher}

**Collections** · Persistent header widget. Shows the active collection name and asset count as a compact button. Clicking opens a dropdown to switch the active collection, create a new collection inline, or navigate to the collections management page.

```
| collection-switcher  |   |
|----------------------|---|
```

No configuration required. The "Manage collections" link targets `configurations.collections.managePath` (default `/collections`).

**Reactivity:** Re-renders automatically on any `asc:collection:change` event — collection switches, creates, renames, and asset adds/removes all update the badge count and list.

---

## collections {#collections}

**Collections** · Index and management page for all user collections. Place this block on `/collections/index`.

```
| collections  |   |
|--------------|---|
```

No configuration required.

**Features:**
- Grid of collection cards showing name, asset count, and Active / Default badges
- Inline "New Collection" form — no page navigation required
- Per-card actions: **Open** (navigates to the collection detail page), **Set Active**, **Delete**
- The default collection cannot be deleted
- Re-renders on any `asc:collection:change` event

The **Open** link navigates to `configurations.collections.collectionPath?id=<uuid>` (default `/collections/collection?id=<uuid>`).

---

## collection {#collection}

**Collections** · Detail and edit page for a single collection. Place this block on `/collections/collection`. The UUID is read from the `?id=` query parameter — e.g. `/collections/collection?id=abc123`.

```
| collection  |   |
|-------------|---|
```

No configuration required.

**Features:**
- Click-to-edit collection name (inline, no modal)
- Asset list with drag-to-reorder (persisted to localStorage)
- Per-asset remove button
- **Share** — opens a dialog to enter a sheet title and description, then generates a compressed share URL pointing at `configurations.collections.sheetPath` (default `/sheets/index`)
- **Download** — opens a rendition picker; submits an async AEM bulk-download job via the Downloads service; auto-triggers the browser download if the job finishes within ~15 s; otherwise surfaces a resumable pending state
- **Delete** — protected: the default "My Collection" cannot be deleted; navigates to `configurations.collections.managePath` on success
- Active download jobs for the collection are shown in a live status panel

**Share URL format:**

```
/sheets/index?assets=<compressed>&title=<encoded>&description=<encoded>
```

---

## stub {#stub}

**Collections** · Compact summary bar — shows the active collection name, asset count, and a link to the download sheet. Suitable for sidebars or persistent footer areas.

```
| stub  |   |
|-------|---|
```

No configuration required. Listens to `asc:collection:change` and re-renders on any collection mutation.

---

## sheet {#sheet}

**Collections** · Full-page download sheet. Renders collected assets as rows — each with a thumbnail, metadata, per-asset rendition switcher, and a download button.

```
| sheet  |   |
|--------|---|
```

No configuration required. Reads from URL query parameters:

| Parameter | Description |
|-----------|-------------|
| `assets` | Compressed array of asset UUIDs (set by the `collection` share dialog or `stub` block) |
| `renditions` | Compressed array of rendition IDs to pre-select |
| `title` | URL-encoded sheet title (replaces the default "Download Sheet" heading) |
| `description` | URL-encoded description shown below the title |

**Per-asset rendition switcher:** Each row shows pill buttons for every rendition in the selection. Clicking a pill updates the download link for that row without affecting others.

**Drag and drop:** Rows are draggable. Dragging to Finder, Photoshop, or any app copies the currently-selected rendition URL. Chrome/Edge only — degrades to URI copy in Firefox/Safari.

![Sheet block — thumbnails, rendition switcher, drag](https://placehold.co/860x480/111111/22c55e?text=Sheet+%E2%80%94+Thumbnails+%2B+Rendition+Switcher+%2B+Drag&font=inter)

*Sheet block — thumbnail, per-asset rendition pills, download button, and drag-to-app*
