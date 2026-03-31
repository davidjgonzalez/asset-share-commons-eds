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

Every block is authored as a table in da.live. The first row is the block name; subsequent rows are key/value configuration pairs. EDS converts each table into a `.block.{name}` div and calls its `decorate(block)` function.

<div class="callout">
<strong>Provider-agnostic search blocks</strong> — All search filter blocks emit QueryBuilder-style field names. The active search provider translates them to its API format transparently — no block changes needed when switching providers.
</div>

<figure class="screenshot">
  <img src="https://placehold.co/860x380/111111/e91e8c?text=Block+Authoring+in+da.live&font=inter" alt="Block authoring in da.live" loading="lazy" />
  <figcaption>Blocks are authored as simple tables in da.live — no code needed</figcaption>
</figure>

---

## search-bar {#search-bar}

<span class="badge badge--pink">Search</span> Keyword full-text search input. Dispatches `asc:search:execute` on input.

```html
| search-bar   |              |
|--------------|--------------|
| placeholder  | Search DAM…  |
```

| Key | Default | Description |
|-----|---------|-------------|
| `placeholder` | Search assets… | Input placeholder text |

---

## search-property {#search-property}

<span class="badge badge--pink">Search</span> Filter by any JCR metadata property. Supports `checkbox`, `radio`, and `dropdown`.

```html
| search-property  |                               |
|------------------|-------------------------------|
| label            | Asset Type                    |
| property         | jcr:content/metadata/dc:format |
| type             | checkbox                      |
| options          | Image: image/jpeg             |
|                  | Video: video/mp4              |
|                  | Document: application/pdf     |
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

<span class="badge badge--pink">Search</span> Filter by DAM folder path. Maps to QB `path` predicate / OpenAPI `filter[assetAncestorPath]`.

```html
| search-path   |                          |
|---------------|--------------------------|
| label         | Folder                   |
| type          | radio                    |
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

<span class="badge badge--pink">Search</span> Date range filter with from/to date inputs. Maps to QB `daterange` predicate.

```html
| search-date-range  |                                    |
|--------------------|------------------------------------|
| label              | Created Date                       |
| property           | jcr:content/metadata/jcr:created   |
```

| Key | Default | Description |
|-----|---------|-------------|
| `label` | — | Filter heading |
| `property` | — | JCR date property to filter on |

---

## search-tags {#search-tags}

<span class="badge badge--pink">Search</span> Filter by AEM tag. Supports tag path prefix filtering.

```html
| search-tags  |                    |
|--------------|--------------------|
| label        | Tags               |
| root         | /content/cq:tags/  |
```

| Key | Default | Description |
|-----|---------|-------------|
| `label` | — | Filter heading |
| `root` | — | Limit tags to this namespace |

---

## search-sort {#search-sort}

<span class="badge badge--pink">Search</span> Dropdown to change sort field and direction.

```html
| search-sort  |                                       |
|--------------|---------------------------------------|
| options      | Newest: jcr:created desc              |
|              | Oldest: jcr:created asc               |
|              | Title A-Z: jcr:content/jcr:title asc  |
```

| Key | Default | Description |
|-----|---------|-------------|
| `options` | — | One per line: `Label: field direction` |

---

## search-results {#search-results}

<span class="badge badge--pink">Search</span> Renders the asset grid/list. Listens to `asc:search:results` and renders asset teasers. Supports four layout modes.

```html
| search-results  |           |
|-----------------|-----------|
| display         | waterfall |
| limit           | 24        |
```

| Key | Default | Description |
|-----|---------|-------------|
| `display` | `waterfall` | `cards` \| `list` \| `masonry` \| `waterfall` |
| `limit` | `24` | Results per page (also controls infinite-scroll page size) |

**Display modes:**

| Mode | Layout | Thumbnail shape |
|------|--------|-----------------|
| `cards` | Uniform grid | Square crop |
| `list` | Single-column rows with metadata | Thumbnail |
| `masonry` | CSS columns, uniform square crops | Square crop |
| `waterfall` | CSS columns, natural proportions | Natural |

**Drag and drop:** Every asset teaser has `draggable="true"`. Users can drag any result card directly into Finder, Photoshop, Slack, or any OS-level file target. The dragged file is the asset's `original` rendition (falls back to `web`). Requires Chrome or Edge — gracefully degrades to URI copy in Firefox/Safari.

<figure class="screenshot">
  <img src="https://placehold.co/860x420/111111/e91e8c?text=search-results+%E2%80%94+Four+Layout+Modes&font=inter" alt="search-results four layout modes" loading="lazy" />
  <figcaption>search-results block — cards, list, masonry, and waterfall modes</figcaption>
</figure>

---

## search-pagination {#search-pagination}

<span class="badge badge--pink">Search</span> Previous/next pagination. Syncs with `search-results` via `asc:search:results` event.

```html
| search-pagination  |   |
|--------------------|---|
```

No configuration required.

---

## details-modal {#details-modal}

<span class="badge badge--purple">Details</span> The modal shell that loads MIME-type-specific detail templates. Opens on `?asset={uuid}` URL param.

```html
| details-modal  |   |
|----------------|---|
```

The modal template to render is determined by `configurations.assetDetails.templates`. The default template path is `/details/default`.

---

## details-preview {#details-preview}

<span class="badge badge--purple">Details</span> Renders the asset preview (image, video embed, PDF viewer, or generic icon).

```html
| details-preview  |   |
|------------------|---|
```

Preview type is determined by the asset's MIME type automatically.

<figure class="screenshot">
  <img src="https://placehold.co/860x420/111111/9333ea?text=details-preview+%E2%80%94+Image+%26+Video+Preview&font=inter" alt="details-preview block" loading="lazy" />
  <figcaption>details-preview — supports images, video, PDFs, and generic fallback icons</figcaption>
</figure>

---

## details-property {#details-property}

<span class="badge badge--purple">Details</span> Renders a single metadata property value from the open asset.

```html
| details-property  |                                  |
|-------------------|----------------------------------|
| label             | Title                            |
| property          | jcr:content/metadata/dc:title    |
```

| Key | Default | Description |
|-----|---------|-------------|
| `label` | — | Display label |
| `property` | — | JCR property path or custom property name |
| `format` | — | `date` \| `bytes` \| `list` |

---

## details-download {#details-download}

<span class="badge badge--purple">Details</span> Rendition download links for the open asset. Reads rendition definitions from `configurations.renditions`.

```html
| details-download  |   |
|-------------------|---|
```

---

## details-actions {#details-actions}

<span class="badge badge--purple">Details</span> Action buttons (Add to Cart, Share link, etc.) in the details modal.

```html
| details-actions  |              |
|------------------|--------------|
| actions          | add-to-cart  |
|                  | share-link   |
```

| Key | Default | Description |
|-----|---------|-------------|
| `actions` | `add-to-cart` | Comma-separated action names |

---

## stub {#stub}

<span class="badge badge--green">Collections</span> Mini cart icon + count in the site navigation. Listens to `asc:collection:change`.

```html
| stub  |   |
|-------|---|
```

---

## sheet {#sheet}

<span class="badge badge--green">Collections</span> Full-page download sheet. Renders all collected assets as rows — each with a thumbnail, metadata, per-asset rendition switcher, and a download button.

```html
| sheet  |   |
|--------|---|
```

No configuration required. Assets and renditions are passed via URL query parameters (set by the `stub` block).

**Per-asset rendition switcher:** Each row shows pill buttons for every rendition in the selection. Clicking a pill updates the download link for that asset without affecting other rows.

**Drag and drop:** Rows are draggable. Dragging a row to Finder, Photoshop, or any OS app copies the currently-selected rendition for that asset. Chrome/Edge only — degrades to URI copy in Firefox/Safari.

**Thumbnail fallback:** If AEM hasn't generated a thumbnail (or the asset is still processing), a file-type emoji icon is shown instead.

<figure class="screenshot">
  <img src="https://placehold.co/860x480/111111/22c55e?text=Sheet+%E2%80%94+Thumbnails+%2B+Rendition+Switcher+%2B+Drag&font=inter" alt="Sheet block — per-asset rendition switcher" loading="lazy" />
  <figcaption>Sheet block — thumbnail, per-asset rendition pills, download button, and drag-to-app</figcaption>
</figure>

---

## collections {#collections}

<span class="badge badge--green">Collections</span> Index page listing all saved collections.

```html
| collections  |   |
|--------------|---|
```

---

## collection {#collection}

<span class="badge badge--green">Collections</span> Single collection page showing saved assets.

```html
| collection  |   |
|-------------|---|
```
