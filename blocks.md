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
      - title: stub
        url: "#stub"
      - title: sheet
        url: "#sheet"
      - title: collections
        url: "#collections"
      - title: collection
        url: "#collection"
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

## stub {#stub}

**Collections** · Mini cart icon + count in the site navigation. Listens to `asc:collection:change`.

```
| stub  |   |
|-------|---|
```

---

## sheet {#sheet}

**Collections** · Full-page download sheet. Renders all collected assets as rows — each with a thumbnail, metadata, per-asset rendition switcher, and a download button.

```
| sheet  |   |
|--------|---|
```

No configuration required. Assets and renditions are passed via URL query parameters set by the `stub` block.

**Per-asset rendition switcher:** Each row shows pill buttons for every rendition in the selection. Clicking a pill updates the download link for that asset without affecting other rows.

**Drag and drop:** Rows are draggable. Dragging a row to Finder, Photoshop, or any OS app copies the currently-selected rendition for that asset. Chrome/Edge only — degrades to URI copy in Firefox/Safari.

**Thumbnail fallback:** If AEM hasn't generated a thumbnail yet, a file-type emoji icon is shown instead.

![Sheet block — thumbnails, rendition switcher, drag](https://placehold.co/860x480/111111/22c55e?text=Sheet+%E2%80%94+Thumbnails+%2B+Rendition+Switcher+%2B+Drag&font=inter)

*Sheet block — thumbnail, per-asset rendition pills, download button, and drag-to-app*

---

## collections {#collections}

**Collections** · Index page listing all saved collections.

```
| collections  |   |
|--------------|---|
```

---

## collection {#collection}

**Collections** · Single collection page showing saved assets.

```
| collection  |   |
|-------------|---|
```
