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
      - title: search-active-filters
        url: "#search-active-filters"
      - title: search-results
        url: "#search-results"
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
      - title: details-metadata
        url: "#details-metadata"
      - title: details-renditions
        url: "#details-renditions"
      - title: details-rendition-metadata
        url: "#details-rendition-metadata"
      - title: details-similar
        url: "#details-similar"
      - title: details-map
        url: "#details-map"
      - title: details-video
        url: "#details-video"
  - label: Collections & Board
    items:
      - title: collection-switcher
        url: "#collection-switcher"
      - title: collections
        url: "#collections"
      - title: collections-actions
        url: "#collections-actions"
      - title: collection-controls
        url: "#collection-controls"
      - title: sheet-controls
        url: "#sheet-controls"
      - title: board
        url: "#board"
      - title: teaser
        url: "#teaser"
      - title: stub
        url: "#stub"
  - label: Actions
    items:
      - title: action-download
        url: "#action-download"
      - title: action-share
        url: "#action-share"
  - label: Layout & Content
    items:
      - title: hero
        url: "#hero"
      - title: columns
        url: "#columns"
      - title: content
        url: "#content"
      - title: fragment
        url: "#fragment"
      - title: header / footer
        url: "#header-footer"
---

# Block Reference

Every block is authored as a table in da.live. The first row is the block name; subsequent rows are key/value configuration pairs. Edge Delivery Services converts each table into a `.block.{name}` div and calls its `decorate(block)` function.

> **Provider-agnostic search blocks** — All search filter blocks emit QueryBuilder-style field names. The active search provider translates them to its API format transparently — no block changes needed when switching providers. See the [Search Provider](/developer#search-provider) reference for the translation rules.

![Block authoring in da.live](https://placehold.co/860x380/111111/e91e8c?text=Block+Authoring+in+da.live&font=inter)

*Blocks are authored as simple tables in da.live — no code needed*

---

## search-bar {#search-bar}

**Search** · Full-text search input, plus optional view / sort / order controls in the same toolbar. Dispatches `asc:search:execute` on input and persists view/sort choices to `localStorage` (`asc.search-results.display`, `asc.orderby`, `asc.orderby.sort`).

| Provider | Support |
|----------|---------|
| QueryBuilder | `fulltext` predicate |
| OpenAPI | `q` parameter |

```
| search-bar  |                                             |
|-------------|---------------------------------------------|
| placeholder | Search DAM…                                  |
| view        | Masonry : masonry                            |
|             | Cards : cards                                 |
|             | List : list                                   |
| sort        | Relevance : @jcr:score                        |
|             | Created : @jcr:content/metadata/dc:created    |
| order       | Descending : desc                             |
|             | Ascending : asc                               |
```

| Key | Default | Description |
|-----|---------|-------------|
| `placeholder` | Search assets… | Input placeholder text |
| `redirect` | `search.page` config | Cross-page redirect target when used from a page with no `search-results` block (e.g. the site header), appends `?fulltext=<value>` |
| `view` | Masonry, Cards, List | Display-mode options; each line is `Label : value`. First option is the default. |
| `sort` | Relevance, Created, Title | Sort-field options; `Label : @jcr:path` pairs. First option is the default. |
| `order` | Descending, Ascending | Sort-direction options. First option is the default. |

Priority for the active sort/order on load: **URL param > localStorage > first authored option.** The display mode (view) is different: it is stored in `localStorage` only and never appears in the URL, so switching views doesn't change the shareable link.

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
| title            | Asset Type                     |
| property         | jcr:content/metadata/dc:format |
| type             | checkbox                       |
| options          | Image : image/jpeg             |
|                  | Video : video/mp4               |
|                  | Document : application/pdf      |
```

| Key | Default | Description |
|-----|---------|-------------|
| `title` | — | Filter heading (rendered as a `<legend>` or label above the options) |
| `property` | `jcr:content/metadata/dc:format` | JCR metadata property path |
| `type` | `checkbox` | `checkbox` \| `radio` \| `dropdown` |
| `options` | — | One per line: `Label : value` |
| `and` | `false` | AND vs OR multi-select logic |
| `operation` | `equals` | QueryBuilder `property.operation` |

---

## search-path {#search-path}

**Search** · Filter by DAM folder path.

| Provider | Support |
|----------|---------|
| QueryBuilder | `path` predicate with `exact`, `flat` modifiers (`path.self` is deprecated by AEM and never emitted) |
| OpenAPI | `filter[assetAncestorPath]` — first selected path value; `exact`/`flat` flags are ignored |

```
| search-path   |                                  |
|---------------|----------------------------------|
| title         | Folder                           |
| type          | radio                            |
| options       | Brand : /content/dam/brand       |
|               | Products : /content/dam/products |
```

| Key | Default | Description |
|-----|---------|-------------|
| `title` | — | Filter heading |
| `type` | `checkbox` | `checkbox` \| `radio` \| `dropdown` |
| `options` | — | One per line: `Label : /dam/path` |
| `exact` | `false` | Exact path only vs. full subtree |
| `flat` | `false` | Direct children only |

**Field names:** radio/dropdown emit `{n}_group.path=<value>`; checkboxes emit `{n}_group.1_path=<v1>`, `{n}_group.2_path=<v2>`, … plus `{n}_group.p.or=true`.

---

## search-date-range {#search-date-range}

**Search** · Date range filter with from/to date inputs.

| Provider | Support |
|----------|---------|
| QueryBuilder | `daterange` predicate |
| OpenAPI | `filter[createdAt][from/to]` or `filter[modifiedAt][from/to]` depending on `property` |

```
| search-date-range  |                                            |
|--------------------|--------------------------------------------|
| title              | Modified Date                              |
| property           | jcr:content/metadata/dam:assetLastModified |
```

| Key | Default | Description |
|-----|---------|-------------|
| `title` | — | Filter heading |
| `property` | `jcr:content/metadata/dam:assetLastModified` | JCR date property to filter on |
| `name` | `daterange` | QB predicate name — rarely changed |

Both "From" and "To" inputs are optional at query time — omitting either end leaves that bound open.

---

## search-tags {#search-tags}

**Search** · Filter by AEM tag.

| Provider | Support |
|----------|---------|
| QueryBuilder | `tagid` predicate |
| OpenAPI | `filter[assetTagIds][]` |

```
| search-tags  |                                       |
|--------------|---------------------------------------|
| title        | Tags                                  |
| property     | jcr:content/metadata/cq:tags          |
| type         | checkbox                              |
| options      | Approved : dam:status/approved        |
|              | Landscape : properties:orientation/landscape |
```

| Key | Default | Description |
|-----|---------|-------------|
| `title` | — | Filter heading |
| `property` | `jcr:content/metadata/cq:tags` | Tag property path |
| `type` | `checkbox` | `checkbox` \| `radio` \| `dropdown` |
| `options` | — | One per line: `Label : namespace:tag/path` |
| `and` | `false` | `true` → all selected tags must match |

---

## search-active-filters {#search-active-filters}

**Search** · Displays currently-active filter selections as dismissible pills, plus a **Clear all** button. Removing a pill re-runs the search.

```
| search-active-filters  |   |
|------------------------|---|
```

No configuration required — reads active state directly from every filter input on the page. On load, the block automatically **teleports itself into the sticky site header** (`header .nav-wrapper`) so pills stay visible while scrolling, waiting via `MutationObserver` if the header hasn't loaded yet.

The full-text `search-bar` input is intentionally excluded from the pill list.

---

## search-results {#search-results}

**Search** · Renders the asset grid or list. Listens to `asc:search:complete` and renders asset teasers. Supports four layout modes: the active mode is controlled by `search-bar`'s view control and persisted in `localStorage` (never the URL); sort/order are also controlled by `search-bar`.

![search-results layout modes](https://placehold.co/860x420/111111/e91e8c?text=search-results+%E2%80%94+Cards%2C+List%2C+Masonry&font=inter)

*search-results block: cards, list, and masonry modes*

```
| search-results  |     |
|-----------------|-----|
| limit           | 24  |
```

| Key | Default | Description |
|-----|---------|-------------|
| `limit` | `24` | Results per page, also controls the infinite-scroll page size |
| `no-more-results-text` | `No more results` | Text shown in the badge once every result has loaded |

**Viewport fill:** search-results auto-loads additional pages as needed until the viewport is filled or there are no more results, not just one page at a time. It also keeps loading further as you scroll, well before you reach the current bottom, so there's no visible pop-in. Once every matching result has loaded, a small "No more results" badge appears below the last row.

**Display modes** (chosen via `search-bar`'s `view` options, or restored from `localStorage`):

| Mode | Layout | Thumbnail shape |
|------|--------|-----------------|
| `cards` | Uniform grid | Square crop |
| `list` | Single-column rows with metadata columns | Thumbnail |
| `masonry` | JS-managed flex columns, load-more never reflows existing items | Natural |

Card/list/masonry columns are controlled by `configurations.searchResults.views`, see the [Quick Start](/quickstart#custom-properties) config example.

**Drag and drop:** Every asset teaser has `draggable="true"`. Users can drag any result card directly into Finder, Photoshop, Slack, or any OS-level file target. Requires Chrome or Edge, gracefully degrades to URI copy in Firefox/Safari.

**Quick actions:** hovering a card reveals Download / Copy URL / Copy Image buttons, sharing the same rendition-picker popover as [board](#board) cards. Copy Image writes the actual image bytes to the clipboard (falls back to copying the URL as text if the browser or the delivery host's CORS policy blocks it). See [Renditions](/renditions#configuration) for the `usecase` field these popovers use to label each option by destination instead of raw format/size.

---

## search-hidden {#search-hidden}

**Search** · Author-set predicates that are always merged into every search on the page, regardless of what the visitor searches or filters for. This is the mechanism behind a [saved-search published collection](/collections#published). Zero-render: it merges its rows into the query and produces no visible output of its own.

```
| search-hidden |                                     |
|----------------|-------------------------------------|
| path           | /content/dam/marketing              |
| tagid          | properties:orientation/landscape    |
```

Each row is `predicate-name | value`, passed through to the query verbatim, using the same names the [provider-agnostic search blocks](#search-bar) emit. Not provider-agnostic itself: QueryBuilder-style `N_group.*` grouping syntax (small, ordinary numbers like `1_group.p.or`) is rewritten to a page-unique, high group-number range so it can never collide with the numbers the filter blocks auto-assign themselves, but on the `openapi` provider those keys pass through unchanged and have no special meaning.

Merged directly into the active provider's `basePredicates` rather than emitted as hidden form inputs, so it can never collide with the filter blocks' own form-field namespace, and a visitor's real filters still win.

---

## details-modal {#details-modal}

**Asset Details** · The modal shell that loads MIME-type-specific detail templates. Opens when the URL contains `?asset={uuid}`. Auto-injected by the `AssetDetails` service. You don't author this block directly on a details page, but the **details fragment page itself** is where the other `details-*` blocks below are assembled.

![details-modal — the asset details dialog shell]({{ '/assets/images/blocks/details-modal.jpg' | relative_url }})

*details-modal — the dialog shell that assembles the details-* blocks below for the open asset*

**Header bar.** The template needs no header block. Start it with a section holding only a heading and a paragraph, using {% raw %}`{{asset.*}}`{% endraw %} tokens (see [Content Variables](/developer#tokens-asset)):

{% raw %}
```
## {{asset.title}}
{{asset.file-type}} · {{asset.file-size}} · {{asset.dimensions}}
```
{% endraw %}

The template to render is determined by `configurations.assetDetails.templates`, a function that receives the `Asset` and returns a fragment path (default `/details`).

**Browser history navigation:** every asset open pushes a history entry so the URL stays shareable and back/forward navigation works naturally.

---

## details-preview {#details-preview}

**Asset Details** · Unified media previewer for all rendition types. Detects the selected rendition's MIME type (and filename extension as fallback) and routes to a matching sub-renderer: image, video, PDF, or Office. Enables cross-type rendition switching, e.g. a video asset can display its JPEG poster rendition.

![details-preview — image and video preview]({{ '/assets/images/blocks/details-preview.jpg' | relative_url }})

*details-preview — supports images, video, PDFs, Office documents, and generic fallback icons*

```
| details-preview  |         |
|-------------------|--------|
| renditions        | original |
| height            | 600px  |
| client-id         |        |
```

| Key | Default | Description |
|-----|---------|-------------|
| `renditions` | `original` | Comma-delimited priority list, walked in order to pick the initial display rendition |
| `height` | `600px` | Viewer height for video/PDF/Office |
| `client-id` | (none) | Adobe PDF Embed API key, optional; falls back to a native `<iframe>` |

Responds to `asc:rendition:activate` (sticky, click) and `asc:rendition:preview` (transient hover).

---

## details-property {#details-property}

**Asset Details** · Renders a single metadata property value from the currently-open asset. Use `pill` display for a badge-style value.

```
| details-property  |                               |
|-------------------|-------------------------------|
| label             | Title                         |
| property          | dc:title                      |
```

| Key | Default | Description |
|-----|---------|-------------|
| `label` | — | Display label |
| `property` | — | Property name from the [accessor list](/developer#tokens) or a raw JCR path |
| `display` | — | `pill` for a badge-style value |

---

## details-metadata {#details-metadata}

**Asset Details** · A panel of asset property rows, rendered as a definition list (`asc-ui-metadata`). Each row is `Label | property`. Multi-value properties (tags, keywords, smart-tags) render as `asc-ui-chip` pills with a "View more" expander past 10 items.

![details-metadata: asset property definition list]({{ '/assets/images/blocks/details-asset-metadata.jpg' | relative_url }})

*details-metadata: definition-list panel of asset properties, with multi-value chip pills*

```
| details-metadata   |                     |
|--------------------|---------------------|
| display            | list                |
| Title              | dc:title            |
| Description        | dc:description      |
| Format             | file-type           |
| File size          | file-size           |
| Uploaded           | uploaded-date       |
| Uploaded by        | uploaded-by         |
| Modified           | last-modified-date  |
| Author             | author              |
| Keywords           | keywords            |
| Tags               | tags                |
```

| Key | Default | Description |
|-----|---------|-------------|
| `display` | `list` | `list` \| `grid`. Grid puts the label above the value in a responsive cell layout. |

Any property registered in `configurations.properties.custom` also works here. Rows whose value resolves empty are omitted automatically.

---

## details-renditions {#details-renditions}

**Asset Details** · Lists an asset's renditions as an `asc-ui-table` (default) or card grid. Author-configurable columns; highlights the `original` rendition as active on load and dispatches `asc:rendition:activate`.

![details-renditions — card grid of rendition options]({{ '/assets/images/blocks/details-renditions.jpg' | relative_url }})

*details-renditions — card display mode, showing every configured and auto-detected rendition*

{% raw %}
```
| details-renditions |                                                              |
|---------------------|-------------------------------------------------------------|
| renditions          | original, web                                                |
| display             | cards                                                        |
| instructions        | Select a format below. <strong>Web</strong> is recommended.  |
| Name                | name                                                          |
| File size           | file-size                                                     |
| Dimensions          | {{ width }}×{{ height }}                                     |
|                     | download, share                                               |
```
{% endraw %}

| Key | Default | Description |
|-----|---------|-------------|
| `renditions` | every visible rendition | Optional row list by name; omit for every visible rendition (`original` first, then A→Z) |
| `display` | table | `cards` for a card grid |
| `instructions` | — | Inline HTML (`<strong>`, `<em>`, `<code>`, `<br>`) shown above the table/cards |
| `show-all` | `false` | When `true` **and** `renditions` names a curated subset, adds a "Show all formats" disclosure below the curated list, expanding to every remaining rendition (resolved the same way as omitting `renditions` entirely) on click. Lets a details page default to a short, destination-labeled list while still surfacing the full technical set for anyone who needs it. |

**Columns** (table mode) are `Title | value` rows:
- **Values** resolve through the shared token engine against the current rendition: a bare path (`name`, `file-size`) or {% raw %}`{{ }}` tokens for mixed text (`{{ width }}×{{ height }}`), both with optional `{{ accessor | fallback }}`{% endraw %}.
- **Rendition fields**: `name`, `label`, `url`, `format`, `file-type`, `file-size` (lazily fetched via `HEAD` request if absent from metadata), `dimensions`, `width`, `height`, `mimeType`, `filename`, `downloadUrl`, `type`, `path`, `usecase`.
- **Asset paths**: `asset.properties.title`, `asset.renditions['web'].url`, or a bare term resolved via `asset.getProperty('…')`.
- **Action columns**: a column whose value is one or more of `download`, `copy-url`, `share`, `preview` renders icon buttons instead of text.

See [Content Variables](/developer#tokens) for the full token syntax.

---

## details-rendition-metadata {#details-rendition-metadata}

**Asset Details** · Displays metadata for the *active* rendition (defaults to `original`). Updates live on `asc:rendition:activate` (click) and `asc:rendition:preview` (hover).

```
| details-rendition-metadata |            |
|------------------------------|----------|
| Rendition                    | label    |
| Format                       | file-type |
| File size                    | file-size |
| Dimensions                   | dimensions |
```

Available fields: `label`/`id`/`name`, `file-type`, `format`, `file-size`, `width`/`height`/`dimensions`, `url`, `type`, `usecase`, `description`.

---

## details-similar {#details-similar}

**Asset Details** · Horizontal strip of assets similar to the currently-open asset. Uses the QueryBuilder `similar` predicate to find related assets by shared tags and MIME type.

![details-similar — horizontal similar assets strip]({{ '/assets/images/blocks/details-similar.jpg' | relative_url }})

*details-similar — scrollable strip of visually related assets*

> **QueryBuilder only.** This block makes a direct QueryBuilder API call and is not available when using the OpenAPI search provider.

```
| details-similar  |                                     |
|-------------------|-------------------------------------|
| title              | You may also like                   |
| description        | Assets with similar tags and format |
| max                | 8                                    |
| show-empty         | false                                |
```

| Key | Default | Description |
|-----|---------|-------------|
| `title` | — | Heading rendered above the strip |
| `description` | — | Subtext rendered below the heading |
| `max` | `8` | Maximum number of similar assets to show |
| `show-empty` | `false` | When `true`, the block stays visible even with no matches; when `false` it removes itself |

---

## details-map {#details-map}

**Asset Details** · Interactive Leaflet map centered on the asset's GPS capture location. Hides itself completely when coordinates are absent or invalid. Loads Leaflet 1.9.4 and OpenStreetMap tiles from a CDN — no API key required.

```
| details-map  |                                        |
|---------------|----------------------------------------|
| latitude      | jcr:content/metadata/exif:GPSLatitude  |
| longitude     | jcr:content/metadata/exif:GPSLongitude |
| label         | Location                               |
| zoom          | 10                                      |
```

| Key | Default | Description |
|-----|---------|-------------|
| `latitude` | `jcr:content/metadata/exif:GPSLatitude` | JCR path to the latitude field |
| `longitude` | `jcr:content/metadata/exif:GPSLongitude` | JCR path to the longitude field |
| `label` | Location | Marker label |
| `zoom` | `10` | Initial Leaflet zoom level |

Falls back to coordinates text + a Google Maps link if Leaflet fails to load.

---

## details-video {#details-video}

**Asset Details** · Embeds a video asset using a native `<video>` element, with an unsupported-format fallback and download link. Responds to `asc:rendition:activate` / `asc:rendition:preview` for rendition switching.

```
| details-video |          |
|----------------|---------|
| height         | 600px   |
| controls       | true    |
| autoplay       | false   |
| muted          | false   |
| loop           | false   |
| playsinline    | true    |
| preload        | metadata|
| poster         |         |
```

All rows are optional. `preload` accepts `auto` \| `metadata` \| `none`.

---

## collection-switcher {#collection-switcher}

**Collections** · Persistent header widget. Shows the active collection name and asset count as a compact button. Clicking opens a dropdown to switch the active collection, create a new collection inline, or navigate to the collections management page.

```
| collection-switcher  |   |
|----------------------|---|
```

No configuration required. The "Manage collections" link targets `configurations.collections.managePath` (default `/collections/`).

**Reactivity:** Re-renders automatically on any `asc:collection:change` event.

### Adding collection-switcher to the site header

The header block loads `/nav` as a fragment with **three sections** separated by horizontal rules (`---`), mapping to `nav-brand`, `nav-sections`, and `nav-tools`. Add `collection-switcher` (and, if you want it, `search-active-filters`) to **section 3**:

```
Your Logo
---
Home | Products | About
---
| collection-switcher | |
```

> **Custom nav path** — if your site uses a nav document at a path other than `/nav`, set `nav: /path/to/nav` in the page metadata.

---

## collections {#collections}

**Collections** · Index and management page for all user collections. Place this block on `/collections/`.

```
| collections  |   |
|--------------|---|
```

No configuration required. Page title and intro copy are authored above this block in da.live.

**Features:**
- Grid of collection cards: a mosaic of up to 4 lazy-loaded asset thumbnails, name, description (when set), total asset count, and last-updated date
- The default collection is named **My Favorites**, always comes first, and is marked with a star
- Inline "New collection" form — no page navigation required
- Per-card **Open** and **Delete** actions; the default collection cannot be deleted
- Re-renders on any `asc:collection:change` event

The **Open** action navigates to `configurations.collections.collectionPath?id=<uuid>` (default `/collections/collection?id=<uuid>`).

---

## collections-actions {#collections-actions}

**Collections** · The primary action for the collections index page: a single **New Collection** button that opens the same creation dialog as the [`collections`](#collections) block.

```
| collections-actions  |   |
|----------------------|---|
```

No configuration required. Place it in the same header row as the page title using the named-area section grid (`_area: collections-actions`), so the button sits beside the heading and above the `collections` grid. See [Layouts](/layouts).

---

## collection-controls {#collection-controls}

**Collections** · Header for a single collection's page — editable name, asset count, and action buttons (Share / Download / past-shares / edit). Header text (`h1`/`p`) is a **token template**, resolved against the hydrated collection:

{% raw %}
```
{{collection.title}}
{{collection.description}}
{{collection.count}} assets — Last updated {{collection.lastUpdated}}

| collection-controls |
| past-shares          | Past Shares | ghost     |
| edit                 | Edit        | ghost     |
| share                | Share       | secondary |
| download             | Download    | primary   |
```
{% endraw %}

Each row is `action | label | variant`. Pair `collection-controls` (header) with [`board`](#board) (`source: collection`, `mode: interactive`) in the same page — see [Board page patterns](#board) below.

For a stats line in its own spot (for example its own grid area under the title), author a plain `content` block paragraph with the same tokens: {% raw %}`{{collection.count}} assets, last updated {{collection.lastUpdated}}`{% endraw %}. No dedicated block is needed.

Reads the `?id=` URL parameter. Reacts to `asc:collection:change`, re-registering its {% raw %}`{{collection.*}}`{% endraw %} tokens on rename or item add/remove.

---

## sheet-controls {#sheet-controls}

**Collections** · Header for a shared, read-only sheet page — Download / Copy Link buttons. Header text is a **token template**, resolved against the decoded `?sheet=` payload:

{% raw %}
```
{{sheet.title}}
{{sheet.description}}
{{sheet.count}} assets — Expires {{sheet.expiresAt|Never}}

| sheet-controls |
| download        | Download  | primary   |
| copy-link       | Copy Link | secondary |
```
{% endraw %}

Pair `sheet-controls` (header) with [`board`](#board) (`source: sheet`, `mode: view`) in the same page.

---

## board {#board}

**Collections** · Reusable, header-less canvas — pan/zoom, client-side search, optional details-page routing override. Renders a **collection** or a shared **sheet** depending on `source`.

![Board — pan/zoom canvas with cards](https://placehold.co/860x480/111111/22c55e?text=Board+%E2%80%94+Pan%2FZoom+Canvas&font=inter)

*Board canvas — drag, rubber-band select, notes, and free-floating text in interactive mode*

```
| board  |                    |
|--------|--------------------|
| source | collection         |
| mode   | interactive        |
| search-properties  | title, file-type |
| notes  | true               |
```

| Property | Values | Default | Notes |
|----------|--------|---------|-------|
| `source` | `collection` \| `sheet` \| `authored` | `sheet` | Where to load assets from |
| `mode` | `view` \| `interactive` \| `sheet-url` | `view` | `view` = pan/zoom + search only; `interactive` = drag, rubber-band select, text elements, notes, "Align to grid", + Text button; `sheet-url` = read a pre-encoded share URL authored on the page itself instead of the visited URL's own `?sheet=` param (see below), always read-only regardless of this setting |
| `notes` | `true` \| `false` | `true` | When `false`, hides notes UI entirely |
| `search-properties` | Comma-separated property names | — | Properties to make client-side searchable. Omit to hide the search input. |
| `details` | Path prefix | — | Override the default ASC details modal: clicking a card navigates to `{details}?asset={uuid}` instead |
| `items` | Newline- or comma-separated asset IDs | — | Only used with `source: authored`, see below |
| `sheet-url` | A full share URL | — | Only used with `mode: sheet-url`, see below |

**Source: collection** — reads `?id=`, hydrates via `services.collections.get(id, true)`, persists pan/zoom to `localStorage` per collection ID.

**Source: sheet** — reads `?sheet=`, decompresses the payload, and checks `expiresAt` before rendering (expired sheets show a notice instead of the canvas).

**Source: authored**: a fixed, site-owner-curated list of asset IDs, typed directly into the `items` config (one per line, or comma-separated), for a "Press Kit" or a hand-picked campaign set, as opposed to a personal collection or a one-off `?sheet=` link. Always renders read-only regardless of `mode`. There's no separate collection to keep in sync: the page you author *is* the collection, and editing its `items` list is how you change what's in it. See [Published Collections](/collections#published) for when to reach for this instead of `source: sheet`.

**Mode: sheet-url**: for a `source: authored`-style page that should still be defined by a *query*, not a fixed ID list. Instead of reading `?sheet=` from the URL the visitor actually used to reach the page, `sheet-url` authors a specific share URL (generated the normal way, from the Share dialog on some collection) directly into the page. Decoded identically to a normal `?sheet=` link, same payload format, same expiry handling; the only difference is where the encoded value comes from. Always renders read-only.

**Card placement:** a card with no saved position is placed automatically, in the shortest column of an eight-column grid, using its own height. Portrait and landscape cards are never placed on top of each other or on top of existing cards and text. Documents and other assets with no dimension metadata are measured once their preview loads and moved if they turned out taller than expected. Positions are saved for collections, so a card stays where it was placed. Shared and authored boards place the same way without saving.

**Fit on load:** the board fits all of its cards in view when it opens, and again if its container changes size, for example when the section it is in is revealed or the page is narrower than the board. Once a visitor pans or zooms, their view is left alone; "Fit to view" brings everything back.

**Custom card renderer:** set `board.itemRenderer` in `configurations.js` to replace the default card markup (`scripts/asc/board-item.js` documents the contract that keeps drag, select, remove, notes, and search working).

**Client-side search:** appears as the last toolbar item when `search-properties` is set. Non-matching cards dim; matches get a highlight ring; the viewport auto-fits to matches on every keystroke.

### Page patterns

**Collection page**: `collection-controls` (header) + `board` (`source: collection`, `mode: interactive`) in two sections. **Sheet page**: `sheet-controls` (header) + `board` (`source: sheet`, `mode: view`), optionally with a `details` override for a scoped details template. **Published collection page**: no header block needed; `board` with `source: authored` (or `mode: sheet-url`) alongside plain authored `h1`/`p` copy. See [Published Collections](/collections#published).

---

## teaser {#teaser}

**Collections & Board** · A single curated teaser linking to a published share: the "here's what we've put together" front door, distinct from search (assumes you already know what you're looking for) and from a visitor's own personal collections (nobody has built one yet on a first visit). One block per share — place several side by side in a section and arrange them with the section's own `style: grid` metadata to build a directory; the block itself only ever renders one card.

![teaser: a curated share, rendered as a card](https://placehold.co/860x480/111111/22c55e?text=teaser+%E2%80%94+Curated+Share&font=inter)

*Teaser (Hero) full-width above a grid of regular Teaser (Horizontal Card) blocks*

Authoring is free-form rich text, not fixed fields — type it into one table cell exactly like any other rich-text block:

```
| Teaser (Hero)                                                |
| ## ![](/media_spring-2026.jpg)Spring 2026 Campaign           |
| Curated hero shots for the spring launch                     |
| [View the collection](/search?tagid=campaigns:spring-2026)   |
```

Rows/cells aren't meaningful on their own — DA wraps a cell's content in a div either way, so spreading the same content across separate rows (image alone in its own row, one row per paragraph, CTA in its own row) authors identically.

- **Cover image** (optional) — a pasted image, or a link/bare path that looks like one, as long as it's in the very first paragraph/heading: either inline (pasted at the start of the opening heading, as above) or alone in its own leading paragraph. A DAM path resolves through the search index to a real asset's web-optimized thumbnail rather than being used as a raw `<img src>`.
- **Body** — everything else renders as authored: whatever headings/paragraphs/formatting you type.
- **CTA** — the last paragraph that's just a single link (the standard EDS "lone link becomes a button" convention) is the thing being teased. Its href drives everything below.

The visual layout comes from the block name itself, not a config row — the standard DA "Block (Variant)" convention:

| Variant | Effect |
|---------|--------|
| `Teaser` | Plain vertical tile (default) |
| `Teaser (Hero)` | The one "headline" tile: biggest thumb + title, capped at 600px tall |
| `Teaser (Horizontal Card)` | Wide teaser, thumb-left/body-right |
| `Teaser (Horizontal Card, Right Image)` / `Teaser (Hero, Right Image)` | Either horizontal format, mirrored — thumb-right/body-left |
| `Teaser (Text Only)` | No thumbnail at all, just the rich text — skips image resolution entirely |

**Automatic thumbnails.** With no cover image authored, the CTA link is resolved to figure out what it points to, and that also supplies the preview:
- A `?sheet=` link: the compressed payload *is* the asset list, so up to 15 thumbnails are decoded straight out of the URL, no fetch needed.
- A link to the search page with query params: a real (silent) search is run and the results' thumbnails are used.
- Any other same-site link: fetches the target page's own `.plain.html` and reads its blocks directly. A `board` with `source: authored` (its authored ID list) or `mode: sheet-url` (its authored share URL, decoded the same way as a `?sheet=` link) both work. Falls back to a plain link icon if neither applies and no cover image was authored.

An **eyebrow label** ("Live Search" / "Curated Set") shows which kind of share it is: a search link stays current on its own, a `?sheet=` or `source: authored` link is a fixed, hand-picked set.

---

## stub {#stub}

**Collections** · Compact summary bar — shows the active collection/cart state and a link to the download sheet. Suitable for sidebars or persistent footer areas.

```
| stub  |   |
|-------|---|
```

No configuration required. Re-renders on `asc:collection:change`.

---

## action-download {#action-download}

**Actions** · The download dialog triggered by `<a href="/actions/download">` links (e.g. `collection-controls`' Download button). Not authored directly on a page — instead, author its dialog content as a DA fragment at `/actions/download` (title, description, rendition list, footer buttons).

Bundles the selected renditions into a zip in the browser and triggers the download, with per-file progress and a list of any files that failed.

**Authoring the dialog.** Create a page at `/actions/download` in DA, with sections separated by `---`. The position of each section decides its role:

```
# Download assets                     <- first section: the h1 is the dialog title
Zip the {{asset-count}} assets you selected. Pick the sizes you need below.   <- other content here is the description

---

## Choose renditions                  <- middle section (optional): label for the checkbox group
- original                            <- optional list of rendition ids to offer
- web

---

[Cancel](#close)                      <- last section: #hash links become buttons
[Download](#download)
```

- **Title:** the first `h1` of the first section. Without it the dialog says "Download".
- **Description:** any other content in the first section appears under the title. `{{asset-count}}` inserts how many assets were selected.
- **Renditions:** without a middle section the dialog lists every visible rendition from `renditions.definitions`. A heading plus a list of rendition ids limits the choices and sets the group label.
- **Buttons:** the last section is required, so a page with one section has no buttons. A `#close` link is the cancel button and any other `#hash` link is the download button.
- **Publishing:** preview and publish the page after editing. The dialog reads the published `/actions/download.plain.html`.

See [Action Pages](/developer#actions) for the general convention and context passing.

---

## action-share {#action-share}

**Actions** · The share dialog triggered by `<a href="/actions/share">` links. Generates a compressed share URL for the current collection/board state (pointing at `configurations.collections.sheetPath`, default `/sheets/`) and records it to a local share history shown in the collection page's past-shares panel.

Author its dialog content as a DA fragment at `/actions/share`, as a pipe-delimited field list (`id | type | label | placeholder | suffix`):

```
| title       | text     | Sheet Title  | Sheet title                                        |
| description | textarea | Description  | Optional context or usage guidance for recipients… |
| expires     | number   | Expires in   | No expiry                                          | days |
| chromeless  | switch   | Share as a standalone page (no site navigation)     |
```

The `switch` field type controls whether the generated link opens branded (with the full site header/footer/nav) or standalone (none of it, reads as a discrete microsite). It defaults **on**: every generated share link has always opened standalone by default, and the switch just makes that an explicit, overridable per-share choice instead of a fixed rule, by appending `&chrome=none` or `&chrome=full` to the generated URL. See [Branded vs. Standalone Shares](/collections#chrome) for the full mechanism.

---

## hero {#hero}

**Layout** · The standard EDS auto-block — no `decorate()` logic of its own. Any image + heading combination at the top of a page's first section is automatically promoted into a `hero` block by EDS's `buildAutoBlocks`; style it via `blocks/hero/hero.css`.

---

## columns {#columns}

**Layout** · Multi-column content layout. Adds a `columns-{n}-cols` class based on the number of columns authored, and tags any column whose sole content is an image with `columns-img-col` for full-bleed image styling.

```
| columns  |                     |
|----------|---------------------|
| Text in column one | ![Image](...) |
```

---

## content {#content}

**Layout** · Passthrough block for default rich-text content (`h2`, `h3`, `p`, `img`, `ul`, `ol`, etc.). Exists solely so authored content can be assigned a named grid area via [section-metadata](/layouts#named-area-grid) — the table wrapper divs are stripped and the raw markup promoted directly into the block element.

```
| content  |
|----------|
| <h2>Heading</h2><p>Body text…</p> |
```

---

## fragment {#fragment}

**Layout** · Includes another page's content inline (`{: target="_blank"}`[AEM block collection reference](https://www.aem.live/developer/block-collection/fragment)). Used internally by `header` and `footer` to load `/nav` and `/footer`, and available for any authored page that wants to embed a shared fragment.

```
| fragment  |         |
|-----------|---------|
| [Link text](/shared-fragment) |
```

---

## header / footer {#header-footer}

**Layout** · Standard EDS site chrome. `header` loads `/nav` (or the page's `nav` metadata override) as a three-section fragment (`nav-brand` / `nav-sections` / `nav-tools`, separated by `---`) and adds a scroll-triggered `.scrolled` class via `IntersectionObserver`. `footer` loads `/footer` (or the page's `footer` metadata override) verbatim.

No block-level configuration — content comes entirely from the linked fragment pages.
