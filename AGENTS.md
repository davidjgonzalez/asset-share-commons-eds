# AGENTS — ASC Developer Reference

This file documents conventions, extension points, and architecture decisions for AI coding assistants and developers working in this repository. It is intentionally comprehensive — use it as the authoritative reference when modifying ASC code.

---

## Ownership Boundary

| Path | Owner | Rule |
|------|-------|------|
| `scripts/asc/configurations.js` | **You** | Edit freely — all site configuration |
| `scripts/asc.js` | **You** | Edit freely — ASC lifecycle entry point; add eager/lazy/delayed hooks here |
| `scripts/asc/` (flat files, e.g. `board-item.js`, `tokens.js`, `html.js`, `chrome.js`) | **You** | Edit/fork freely — default implementations you're expected to read and customize |
| `scripts/asc/core/` | **ASC core** | Do not edit — replace the whole folder on upgrades |
| `blocks/` | **You** | Copy and modify blocks as needed |
| `blocks/action-*/` | **You** | Action dialog blocks — one per `/actions/*` path |
| `styles/` | **You** | Add themes, override CSS variables |
<<<<<<< HEAD
=======
| `component-definition.json` | **You** | Universal Editor component library |
| `component-models.json` | **You** | Universal Editor field definitions |
| `component-filters.json` | **You** | Universal Editor containment rules |
>>>>>>> e491bd9eaed27b48674fbaf6e6ccd5a64870df9e

Every file inside `scripts/asc/core/` starts with `// ASC Core — do not edit.` as a guard —
that's the only part of `scripts/asc/` this applies to. See `docs/PROJECT_STRUCTURE.md` for
the full ownership-zone breakdown.

---

## Block Inventory

### Search blocks
| Block | Purpose | Provider-aware? |
|-------|---------|----------------|
| `search-bar` | Keyword text search input | No — emits `fulltext`, handled by all providers |
| `search-property` | Metadata property filter (checkbox / radio / dropdown) | Via QB `property` predicate; OpenAPI maps via `PROPERTY_MAP` |
| `search-path` | DAM path filter (checkbox / radio / dropdown) | Via QB `path` predicate; OpenAPI maps `filter[assetAncestorPath]` |
| `search-date-range` | Date range filter (from/to date inputs) | Via QB `daterange` predicate; OpenAPI maps via `DATE_PROPERTY_MAP` |
| `search-tags` | Tag filter (checkbox / radio / dropdown) | Via QB `tagid` predicate; OpenAPI maps `filter[assetTagIds][]` |
| `search-hidden` | ~~Removed~~ — replaced by the search config sheet (see below) | — |
| `search-statistics` | Displays result counts ("Showing N of M assets") | No — reads `asc:search:complete` event |
| `search-results` | Infinite-scroll results grid with sort/layout controls. Masonry view uses JS-managed flex columns (`MASONRY_COLS = 3`) so load-more never reflows existing items. | No — renders assets from `asc:search:complete` |

### Details blocks (used on details fragment pages)
| Block | Purpose |
|-------|---------|
| `details-modal` | Modal dialog shell; auto-injected by `AssetDetails` service. Close button floats top-right; the loaded fragment supplies its own header |
| `details-header` | Title + meta-subtitle bar. Authored content is a **token template** — `{{ accessor }}` / `{{ accessor \| fallback }}` resolved against the asset (see Token Placeholders below) |
| `details-preview` | Unified media previewer for **all rendition types**. Detects the selected rendition's MIME type (and filename extension as fallback) and routes to the matching sub-renderer: `image.js` (image/*), `video.js` (video/*), `pdf.js` (application/pdf), `office.js` (Office formats). Enables cross-type rendition switching — e.g. a video asset can display its JPEG poster rendition, or a PPT can display its generated PDF rendition. Config rows: `renditions` (comma-delimited priority list, default `original` — walked in order to pick the initial display rendition), `height` (viewer height for video/PDF/Office, default `600px`), `client-id` (Adobe PDF Embed API key, optional). Image viewer: square aspect-ratio container with `object-fit: contain` letterboxing, `failedUrls` tracking prevents flashing broken images. Video viewer: `canPlayType` probe → native `<video>` or unsupported overlay; MIME inferred from filename extension when `mimeType` absent. PDF viewer: Adobe PDF Embed API when `client-id` provided, native `<iframe>` fallback. Office viewer: Microsoft Office Online `<iframe>`. All viewers show an unsupported/error overlay with a download link. Responds to `asc:rendition:activate` (sticky — may swap renderer type) and `asc:rendition:preview` (hover — same-type only, cross-type hover is no-op). |
| `details-property` | Displays a single metadata property (label + value; `pill` variant → badge) |
| `details-metadata` | A panel of property rows (`asc-ui-metadata`). Rows are `Label \| property-key`; `display: list\|grid`; array values (e.g. `tags`) render as `asc-ui-chip` pills |
| `details-renditions` | Renditions as an `asc-ui-table` (default) or card grid (`\| display \| cards \|`). Author-configurable columns; highlights original rendition as active on load and dispatches `asc:rendition:activate`. Optional `instructions` row accepts inline HTML (strong/em/code/br). Cards mode: initial card AR from `asset.renditionsBoundingAspectRatio`, snapped per-card to natural image dimensions after load; `max-height: 12rem` clamps portrait cards with side bars. See "Renditions Table Templates" below |
| `details-actions` | Action buttons (`asc-ui-action` circle-icon + label). One row per action: `\| Label \| action-name \|`. Actions: `download`, `copy-url`, `copy-image`, `share`, `collection`. Labels are used exactly as authored. Updates `href`/`data-copy-url` on `asc:rendition:activate`. Download filename uses `asset-base + rendition.label + ext` (e.g. `photo-preview.mp4`); `rendition.label` is already cleaned by `Rendition.deriveLabel` (strips `cq5dam.` prefix). `copy-image` copies the active rendition's image bytes to the clipboard via `scripts/asc/core/utils/clipboard-image.js`, falling back to copying the URL when the browser or delivery-host CORS policy won't allow it; hidden automatically for non-image renditions. |
| `details-map` | Interactive Leaflet map centered on the asset's GPS capture location. Hides itself completely when coordinates are absent or invalid. Loads Leaflet 1.9.4 and OpenStreetMap tiles from CDN (no API key). EXIF DMS strings (`"42,59.35N"`) are converted to signed decimal degrees internally; full precision is passed to Leaflet and map links — never rounded before use. Authored rows: `latitude` (JCR path, default `jcr:content/metadata/exif:GPSLatitude`), `longitude` (default `jcr:content/metadata/exif:GPSLongitude`), `label` (default `"Location"`), `zoom` (default `10`). Falls back to coordinates text + Google Maps link if Leaflet fails to load. Uses `ResizeObserver` to call `map.invalidateSize()` so the map sizes correctly when the details `<dialog>` opens. |

### Collections / cart blocks
| Block | Purpose |
|-------|---------|
| `stub` | Cart bar — shows active collection count and link to download sheet |
| `collections` | Collections index/management page — list, create, delete, activate. Content config: `display` (`grid`, default, or `rail` — a compact horizontal strip with no create/manage actions, e.g. for a homepage placement) and `limit` (max collections shown, 0/omitted = no limit) |
| `collection-controls` | Collection header — editable name, asset count, Share / Download / past-shares buttons, jobs indicator. Header text (h1/p) is a **token template** — `{{collection.title}}` / `{{collection.description}}` / `{{collection.count}}` / `{{collection.lastUpdated}}` resolved against the hydrated collection. Pair with `board` (source: collection, mode: interactive) on the same page |
| `sheet-controls` | Shared-sheet header — Download / Copy Link buttons. Header text (h1/p) is a **token template** — `{{sheet.title}}` / `{{sheet.description}}` / `{{sheet.count}}` / `{{sheet.expiresAt}}` resolved against the decoded `?sheet=` payload. Pair with `board` (source: sheet, mode: view) on the same page |
| `board` | Reusable, header-less board canvas — pan/zoom, client-side search, details navigation override; `source: collection\|sheet`, `mode: view\|interactive`, `search-properties`, `details` |
| `collection-switcher` | Persistent header widget — active collection dropdown, inline create, navigate to /collections |
| `share-directory` | Curated directory of links to published shares (search links, sheets, or authored boards) — the "here's what we've put together" front door, distinct from search and from a visitor's own personal collections. Each row is `Label \| Description \| URL/path \| optional cover image`; omitted cover images resolve to an auto-generated thumbnail mosaic (up to 15 assets, resolved from a `?sheet=` payload, a live silent search, or by fetching the target page's own `board` block). Optional 2-cell config rows: `view` (`horizontal`, default, or `vertical`) and `hero` (`true`, default — first row renders full-width and featured, or `false`). See the block's own header comment for the full row/resolution contract. |

### Board block — authoring reference

The `board` block is a standalone canvas that can be placed on any page. It is authored as a
property table (one row per property, key | value).

#### Properties

| Property | Values | Default | Notes |
|----------|--------|---------|-------|
| `source` | `collection` \| `sheet` \| `authored` | `sheet` | Where to load assets from |
| `mode` | `view` \| `interactive` | `view` | `view` = pan/zoom + search only; `interactive` = drag, rubber-band, text elements, notes, Align to grid, + Text button |
| `notes` | `true` \| `false` | `true` | When `false`, hides notes button and footer from every card and omits `data-asc-notes` from the DOM entirely |
| `search-properties` | Comma-separated property names | _(none)_ | Which asset properties to stash in `data-filter` for client-side filtering. E.g. `title, file-type`. Omit to hide the search input entirely. |
| `display-properties` | `·`-delimited property names | _(none)_ | Properties to render in the card body section. Accepts any registered property name (`title`, `file-type`, `dimensions`, `file-size`, custom properties, etc.). When omitted, the card shows the asset type label (Image, Video, PDF…). |
| `details` | Path prefix | _(none)_ | Override the default ASC modal. When set, clicking a card navigates to `{details}?asset={uuid}`. MIME-type routing uses the same template patterns from `configurations.assetDetails.templates`, stripping the first path segment (e.g. `image/*` maps `/details/image` → `/sheet/my-details/image`). Falls back to `details` itself if no template matches. |
| `items` | One asset UUID or exact DAM path per line | _(none)_ | Only used when `source: authored`. A fixed, site-owner-curated asset list (e.g. a press kit or campaign set) — always read-only, regardless of `mode`. |

#### Source: collection

Reads the `?id=` URL parameter and calls `services.collections.get(id, true)` to get the
hydrated collection. Re-renders on `CollectionEvents.CHANGED` (filtered to the same collection
ID). Persists viewport pan/zoom and expand state to localStorage under `asc:boardViewport:{id}`
and `asc:boardExpanded:{id}`.

#### Source: authored

A "published collection" — a fixed set of assets a site owner curates once by authoring their
UUIDs/paths directly into the `items` row, rather than a personal collection built by a visitor
or a compressed one-off `?sheet=` link. References are resolved through
`services.authoredAssets.resolveAssetReferences()` (`scripts/asc/core/services/authored-assets/authored-assets.js`),
a bounded-concurrency pool over the active search provider — override resolution entirely via
`configurations.authoredAssets.resolveReference`. Always forced to `mode: view` — there's no
owning collection to drag positions back into, only a page an editor updates by changing the
authored list itself. An id that resolves to an `AssetAccessError` (no permission) renders as a
locked placeholder rather than being silently dropped — see `lockedBoardItemHtml` in
`scripts/asc/board-item.js`.

#### Source: sheet

Reads the `?sheet=` URL parameter, decompresses the payload via `services.url.decompressToArray`,
and checks the `expiresAt` field before fetching assets. Expired sheets render an expiry notice
instead of the canvas. Expand state is persisted under `asc:sheetBoardExpanded`. The `board` block
itself renders canvas only — it does not render a title/description header; that's `sheet-controls`'
job (see above), authored as `{{sheet.*}}` tokens in the same section.

#### Page patterns

**Collection page** — pair `collection-controls` (header) + `board` (source: collection, mode: interactive) in two sections:

```html
<!-- Section 1: collection header — token template + controls -->
<div>
  <p><a href="/collections/">&#8592; Collections</a></p>
  <h1>{{collection.title}}</h1>
  <p>{{collection.description}}</p>
  <p>{{collection.count}} assets &#8212; Last updated {{collection.lastUpdated}}</p>

  <div class="collection-controls">
    <div><div>past-shares</div><div>Past Shares</div><div>ghost</div></div>
    <div><div>edit</div><div>Edit</div><div>ghost</div></div>
    <div><div>share</div><div>Share</div><div>secondary</div></div>
    <div><div>download</div><div>Download</div><div>primary</div></div>
  </div>
</div>

<!-- Section 2: interactive board canvas -->
<div>
  <div class="board">
    <div><div>source</div><div>collection</div></div>
    <div><div>mode</div><div>interactive</div></div>
    <div><div>search-properties</div><div>title, file-type</div></div>
    <div><div>display-properties</div><div>title · file-type</div></div>
    <div><div>notes</div><div>true</div></div>
  </div>
</div>
```

**Sheet page** — pair `sheet-controls` (header) + `board` (source: sheet, mode: view) and optional `details` override:

```html
<!-- Section 1: sheet header — token template + controls -->
<div>
  <p><a href="/">&#8592; Back to search</a></p>
  <h1>{{sheet.title}}</h1>
  <p>{{sheet.description}}</p>
  <p>{{sheet.count}} assets &#8212; Expires {{sheet.expiresAt|Never}}</p>

  <div class="sheet-controls">
    <div><div>download</div><div>Download</div><div>primary</div></div>
    <div><div>copy-link</div><div>Copy Link</div><div>secondary</div></div>
  </div>
</div>

<!-- Section 2: read-only board canvas -->
<div>
  <div class="board">
    <div><div>source</div><div>sheet</div></div>
    <div><div>mode</div><div>view</div></div>
    <div><div>search-properties</div><div>title, file-type</div></div>
    <div><div>details</div><div>/sheet/my-details</div></div>
  </div>
</div>
```

#### Client-side search

When `search-properties` is set, a search input appears as the last item in the toolbar segmented control. Filtering works client-side — no server round-trip.

**DOM storage** — each card gets `data-filter="…"` containing the joined, lowercased values of all configured properties (e.g. `title` + `file-type` → `"mountain landscape image/jpeg"`).

**Match behavior** — the haystack is `data-filter` + `data-asc-notes` joined. Non-matching cards dim to low opacity; matching cards get a primary-color ring highlight. Clearing the input restores all cards.

**Fit-to-matches** — after each keystroke, the viewport automatically pans and zooms to frame the matching cards. Clearing the query restores the full-board fit.

#### Details routing

When `details` is set, clicking a card resolves the final path via `resolveDetailsPath(detailsBase, mime)`:

1. Iterates `configurations.assetDetails.templates` entries (skipping `"default"`).
2. For the first pattern that matches the asset's MIME type, strips the first path segment from the template path and appends the remainder to `detailsBase`. E.g. if `image/*` → `/details/image` and `detailsBase` is `/sheet/my-details`, the resolved path is `/sheet/my-details/image`.
3. Falls back to `detailsBase` (with the `default` template's sub-path appended, if present).
4. Navigates to `{resolvedPath}?asset={uuid}`.

The details page itself is a normal EDS page; add a `details-modal` block and the same details fragments used on your main details pages.

---

## Action Pages

A convention for link-triggered action dialogs. The `actionPages` ASC Core service
(`scripts/asc/core/services/action-pages/action-pages.js`) intercepts any click on
`<a href="/actions/*">` and orchestrates the full load-render-dialog flow.

### Flow

```
click on <a href="/actions/download">
  ↓
ActionPages.trigger('/actions/download', ctx)
  ↓
fetch /actions/download.plain.html          ← DA-authored dialog content
  ↓
create detached <div class="action-download block">
  └── append fetched section divs as children
  ↓
loadBlock(blockEl)                          ← EDS loads blocks/action-download/action-download.js
  ↓
decorate(blockEl) runs
  ├── reads window.asc.pendingAction        ← context passed by triggerAction()
  ├── parses DA sections with parseActionFragment()
  └── builds + shows <dialog>
  ↓
delete window.asc.pendingAction             ← cleaned up after loadBlock resolves
```

### Context passing (`window.asc.pendingAction`)

Before calling `loadBlock`, the service writes the caller-supplied context object to
`window.asc.pendingAction`. The block's `decorate()` must read it **before any `await`**
and capture it in a local variable — it is deleted immediately after `loadBlock` resolves.

```js
export default async function decorate(block) {
  const ctx = window.asc?.pendingAction || {};  // ← capture before first await
  const collection = ctx.collectionId
    ? await services.collections.get(ctx.collectionId)
    : null;
  // …
}
```

The service also collects `data-action-*` attributes from the clicked element and its
ancestors and merges them into the context (without the `action` prefix, camelCased).

### Block naming convention

| `/actions/` path | Block name | Block directory |
|-----------------|-----------|----------------|
| `/actions/download` | `action-download` | `blocks/action-download/` |
| `/actions/share` | `action-share` | `blocks/action-share/` |
| `/actions/foo-bar` | `action-foo-bar` | `blocks/action-foo-bar/` |

### DA document structure

DA pages at `/actions/*` follow a three-section layout (separated by `---`):

| Position | Semantic role | Parsed as |
|----------|--------------|-----------|
| First section | Header | `h1` → `title`; other elements → `bodyNodes` |
| Middle section(s) | Body | `h2/h3` + `ul` → `renditionIds` (plain items) or `fields` (pipe-delimited items); other elements → `bodyNodes` |
| Last section | Footer | `<p>` links with `#hash` hrefs → `actions[]` |

`parseActionFragment(blockEl, ctx)` returns:
```js
{
  title: string | null,
  bodyNodes: Element[],          // non-title header elements + non-list body elements
  fields: Field[] | null,        // form fields from pipe-delimited ul: id|type|label|placeholder|suffix
  renditionLabel: string | null, // label above rendition list
  renditionIds: string[] | null, // plain ul items in body section
  actions: { label, hash }[],   // footer links (#close, #action-generate, etc.)
}
```

`ctx` values replace `{{ key }}` tokens in the document's HTML before nodes are returned.

### Footer `#hash` conventions

| Hash | Used for |
|------|---------|
| `#close` | Cancel / close buttons — rendered as secondary `btn` with `data-dialog-close` |
| `#action-*` | Action-specific buttons — block maps these to click handlers |

### `wireDialogClose(dialog)`

Wires `[data-dialog-close]` buttons and backdrop click (`e.target === dialog`) to
`dialog.close()`. Call after inserting the dialog into the DOM.

### Triggering actions from blocks

```js
import { triggerAction } from '../../scripts/asc.js';

// Via link click (handled automatically by the service):
// <a href="/actions/download" data-action-collection-id="uuid">Download</a>

// Programmatically:
triggerAction('/actions/download', { collectionId: collection.id });
triggerAction('/actions/share',    { collectionId: collection.id });
```

### Configuration

In `scripts/asc/configurations.js`:
```js
// actions: {
//   root: '/actions',   // DA path prefix (default: '/actions')
// },
```

---

## Section Layouts — Named-Area Grid (`_layout: grid`)

A general, author-driven grid paradigm for sections, modeled on CSS `grid-template-areas`.
Lets authors arrange blocks into a 2-D layout from **section metadata**, with each block
declaring which cell it occupies — no per-layout CSS required.

> ⚠️ **Boilerplate modification — `scripts/scripts.js`.** ASC wires in through a single import
> from `scripts/asc.js`. The relevant call is `ascDecorateMain(main)` in `decorateMain()`, which
> runs token substitution then `decorateASCSections`. Grid layout must run **after** `decorateBlocks`
> so section wrapper classes are already set.
>
> ```js
> import { ascEager, ascDecorateMain, ascLazy, ascDelayed } from './asc.js';
> // …
> export function decorateMain(main) {
>   decorateButtons(main);
>   decorateIcons(main);
>   buildAutoBlocks(main);
>   decorateSections(main);    // sets section.dataset.layout/areas/columns/rows/gap
>   decorateBlocks(main);      // decorates all blocks (wrappers created by decorateSections)
>   ascDecorateMain(main);     // ← ASC addition: registerTokens(URL params) + decorateASCSections
> }
> ```
>
> `decorateASCSections` (called inside `ascDecorateMain`) reads layout config from `section.dataset`
> (already set by `decorateSections` via `toClassName`, which strips the leading `_` —
> `_layout→layout`, `_areas→areas`, etc.), assigns `--grid-area` to block wrappers, and groups
> co-area blocks into `.grid-area-stack` containers.
>
> `scripts.js` is boilerplate (not `scripts/asc/`), so **re-apply this edit after any EDS
> boilerplate upgrade.** The logic itself lives in the user-owned `scripts/asc/section-grid.js`; the
> styling in `styles/sections.css` (imported by `styles.css` — consolidated from the former
> per-layout files in `styles/sections/`, which no longer exist; edit `sections.css` directly).
> Because `decorateMain` also runs for fragments loaded via `loadFragment` (e.g. the asset-details
> modal), grid layouts work inside the modal too.

**Authoring** (section metadata):

| Section Metadata |                    |
|------------------|--------------------|
| _layout          | grid               |
| _areas           | preview actions    |
|                  | preview metadata   |
| _columns         | 1.5fr 1fr          |
| _rows            | auto auto (opt)    |
| _gap             | 2rem (opt)         |

- `_areas` — one line per grid row (lines may also be separated by `/`, `\|`, or `,`). Repeat an
  area name across cells to make a block span them. The example makes `preview` span both rows
  on the left, with `actions` over `metadata` on the right.
- `_columns` — optional track sizing. **If omitted, defaults to equal `1fr` columns** (`repeat(N,
  minmax(0,1fr))`) derived from the widest areas row.
- `_rows` — optional. **If omitted, defaults to `auto 1fr`** (first row content-sized, the rest
  flexible). A block spanning the full column height (like `preview`) crosses the flexible track,
  so the content rows stay content-sized and the other column's blocks **pack to the top** instead
  of spacing evenly. Set `_rows` explicitly to override.
- `_gap` — optional. A named token (`xs`|`s`|`m`|`l`|`xl`) maps to the theme `--spacing-*` scale; a
  raw length (e.g. `1.5rem`) passes through.
- Collapses to a single stacked column below 768px (named placement is dropped → source order).

**Block placement** — each block claims a cell with a `_area` config row, and may add a
`_align` row to position itself within that cell instead of stretching to fill it:

```
| details-preview |            |
| _area             | preview    |
| _align            | top center |
```

`_align` — one vertical keyword (`top`|`bottom`) and/or one horizontal keyword (`left`|`right`);
`center` fills whichever axis isn't otherwise given, or both when given alone (e.g. `center` on
its own centers the block in both axes).

`scripts/asc/section-grid.js` (called from `decorateMain`, before `decorateSections`) reads the
section-metadata block directly for `_`-prefixed keys, removes them (so EDS never sees them),
then writes `--grid-areas` / `--grid-columns` / `--grid-cols` / `--grid-rows` / `--grid-gap`
custom properties on the section and `--grid-area` / `--grid-align-self` / `--grid-justify-self`
on each block wrapper. `grid-layout.css` turns those into the grid.

### Token Placeholders

**Syntax**: `{{ accessor }}` or `{{ accessor | fallback }}`.  
When a value is empty/null, the fallback text is used (or the token collapses to `""`).  
Dangling separators (` · `, `,`, `—`) adjacent to an empty token are trimmed automatically.

Two token systems exist:

---

#### 1 — Page-wide registry (URL params, `collection.*`, `sheet.*`, ...)

**API**: `registerTokens(context)` in `scripts/asc/tokens.js`  
**Context**: a plain accumulating object — any block can merge its own `key → value` pairs into it

`registerTokens(context)` merges `context` into a single page-wide registry, (re)scans the
**entire document** — `<head>` and `<body>`, any section, `<title>`, `meta[content]`, headings,
paragraphs, links — for any not-yet-recorded `{{...}}` occurrence, then re-resolves everything
recorded so far against the full merged registry. Safe to call repeatedly and from multiple
blocks: later values for the same accessor simply overwrite earlier ones, and an accessor
nothing has registered yet just doesn't resolve (empty, or its fallback) until it does — there's
no ordering dependency between whichever blocks end up supplying values, and a token whose
namespace doesn't apply to the current page (e.g. `{{sheet.title}}` on a collection page) is
never touched because nothing on that page ever registers it.

Because the scan covers the whole document, `{{collection.title}}` / `{{sheet.title}}` etc. also
resolve if authored into the page's `<title>` or `<meta name="description">` — the browser tab
title and description update once the owning block registers real data.

**Callers today**:

| Caller | When | Keys registered |
|---|---|---|
| `ascDecorateMain()` (`scripts/asc.js`) | Before block decoration | Every URL search param, keyed by its own name (e.g. `?fulltext=mountains` → `{{fulltext}}`) |
| `collection-controls` block | After collection data is hydrated; again on rename / item add-remove | `collection.title`, `collection.description`, `collection.count`, `collection.lastUpdated` |
| `sheet-controls` block | After the `?sheet=` payload is decoded | `sheet.title`, `sheet.description`, `sheet.count`, `sheet.expiresAt` |

**`collection.*` accessors**:

| Accessor | Returns | Example |
|---|---|---|
| `collection.title` | Collection name (editable via ⋯ → Rename) | `"Q3 Campaign Assets"` |
| `collection.description` | Collection description (empty if unset) | `"Assets for Q3"` |
| `collection.count` | Number of assets in the collection | `"14"` |
| `collection.lastUpdated` | Human-formatted last-modified date | `"July 10, 2025"` |

**`sheet.*` accessors**:

| Accessor | Returns | Example |
|---|---|---|
| `sheet.title` | Sheet title (falls back to `"Download Sheet"`) | `"Q3 Campaign Assets"` |
| `sheet.description` | Sheet description (empty if unset) | `"Assets for Q3"` |
| `sheet.count` | Number of assets in the sheet | `"14"` |
| `sheet.expiresAt` | Human-formatted expiry date (empty if the link never expires) | `"July 10, 2025"` |

**Authoring example** (da.live document, collection page — same section as `collection-controls`):

```
← Collections            [link to /collections/]
{{collection.title}}     [H1]
{{collection.description}}
{{collection.count}} assets — Last updated {{collection.lastUpdated}}

| collection-controls |
| past-shares | Past Shares | ghost     |
| edit        | Edit        | ghost     |
| share       | Share       | secondary |
| download    | Download    | primary   |
```

**Authoring example** (da.live document, sheet page — same section as `sheet-controls`):

```
← Back to search           [link to /]
{{sheet.title}}            [H1]
{{sheet.description}}
{{sheet.count}} assets — Expires {{sheet.expiresAt|Never}}

| sheet-controls |
| download  | Download  | primary   |
| copy-link | Copy Link | secondary |
```

---

#### 2 — Asset (details-header, asset cards)

**Resolver**: `resolveTokens(template, context)` / `resolveTokensInElement(el, context)` in
`scripts/asc/tokens.js`  
**Called from**: `blocks/details-header/details-header.js` — runs when asset data is loaded  
**Context**: an `Asset` model instance, or a **namespace map** (`{ asset, rendition, ... }`)

`details-header` rows are authored as template strings; any `{{ }}` token is resolved against
the loaded asset. Accessor resolution order: computed getters → `asset.getProperty(key)` →
`asset[key]`.

**Namespaced accessors**: pass a namespace map instead of a single object when a template needs
to pull from more than one "thing" — e.g. `resolveTokensInElement(cardEl, { asset })` lets a
card template say `{{asset.title}} · {{asset.file-size}}`. `ns.accessor` switches to
`context[ns]` and resolves the rest against it, using the same resolution order above; the
switch only fires when `context[ns]` is itself an object, so it never collides with the
page-wide registry's flat `'collection.title'`-style keys.

`details-renditions` uses this too, but its `asset.*` paths need rules the generic engine
doesn't know (`asset.properties.*` / `asset.renditions['id']` are keyword sub-paths, not real
nested objects; rendition lookups prefer the configured rendition definition over a raw array
find). Rather than teach the shared engine asset vocabulary, its context object's `asset` key is
a small local wrapper exposing one `getProperty(path)` method — the namespace switch hands the
whole remaining path to that method in a single call, and it resolves the rest with its own
(unchanged) path-walking logic. See `assetResolver()` in `details-renditions.js`, and Renditions
Table Templates below for the full accessor list.

**Computed getters** (always available regardless of metadata):

| Accessor | Returns |
|---|---|
| `url` | Full AEM URL of the asset |
| `uuid` | Asset UUID |
| `id` | Alias for `uuid` |
| `filename` | File name (from `cq:name` or path) |
| `file-extension` | Extension only (`jpg`, `pdf`, …) |

**Property handler accessors** (registered in `configurations.js → properties`):

| Accessor | Returns | Example |
|---|---|---|
| `title` | `dc:title` or `cq:name` | `"Coastal Sunset"` |
| `description` | `dc:description` | `"A wide-angle landscape shot"` |
| `mime-type` | `dc:format` | `"image/jpeg"` |
| `file-type` | Friendly type label | `"JPEG"` / `"PDF"` |
| `file-size` | Human-formatted size | `"2.4 MB"` |
| `dimensions` | `width × height` string | `"1920 × 1080"` |
| `width` | Pixel width | `"1920"` |
| `height` | Pixel height | `"1080"` |
| `author` | `dc:creator` | `"Jane Smith"` |
| `keywords` | `dc:subject` (comma-joined) | `"nature, landscape"` |
| `tags` | `cq:tags` (comma-joined) | `"outdoors, travel"` |
| `smart-tags` | ML predicted tags (sorted by confidence) | `"mountain, sky, sunset"` |
| `uploaded-date` | `jcr:created` formatted | `"June 3, 2025"` |
| `uploaded-by` | `jcr:createdBy` | `"admin"` |
| `last-modified-date` | `jcr:lastModified` formatted | `"July 10, 2025"` |
| `last-modified-by` | `jcr:lastModifiedBy` | `"jdoe"` |
| `colors` | Color distribution (comma-joined hex values) | `"#2a4d8f, #c8a96e"` |
| `history` | XMP edit history entries | (array — joins as labels) |

Any raw JCR metadata key (e.g. `dc:format`, `xmp:Rating`) is also accessible directly.

**Authoring example** (`details-header` da.live table):

```
| details-header                                         |
| {{title}}                                              |
| {{file-type}} · {{file-size}} · {{dimensions}}         |
```

---

> **Renditions columns** in `details-renditions` also support `{{ }}` tokens, but against
> the rendition object rather than an asset. See the **Renditions Table Templates** section.

### Renditions Table Templates (`details-renditions`)

The `details-renditions` block lists an asset's renditions as table rows or a card grid.
On load it highlights the `original` rendition as active and dispatches `asc:rendition:activate`.
Authoring (da.live):

```
| details-renditions |                 |
| renditions  | original, web         |   ← optional row list (by name); omit/all = every
|             |                       |     visible rendition, "original" first then A→Z
| display     | cards                 |   ← optional: "cards" for card grid; default = table
| instructions | Select a format below. <strong>Web</strong> is recommended. |   ← inline HTML; shown above the table/cards
| Name        | name                  |   ← column: Title | value (table mode only)
| File size   | file-size             |
| W x H       | dimensions            |
|             | download, share       |   ← value of action keyword(s) → icon buttons
```

- **Values** resolve through the shared token engine (`scripts/asc/tokens.js`) against the
  **current rendition**; the owning asset is reachable via `asset.…`. A value is either a bare
  path (`name`, `file-size`) or contains `{{ }}` tokens for mixed text (`{{ width }}×{{ height }}`)
  — either form also supports `{{ accessor | fallback }}`.
- **Rendition fields / aliases**: `name`, `label`, `url`, `format`, `file-type`, `file-size`
  (formatted; lazily fetched via HEAD if absent from metadata — see below), `dimensions`,
  `width`, `height`, `mimeType`, `filename` (download filename), `downloadUrl`, `type`,
  `path`, `usecase`.
- **Asset paths**: `asset.properties.title`, `asset.renditions['web'].url`, or a bare term →
  `asset.getProperty('…')`. Well-known asset sub-objects: `properties`, `renditions`.
- **Path syntax**: dot (`a.b`), bracket (`a['b']`, `a[b]`), nesting combine.
- **Action columns**: a column whose value is one or more known action keywords renders icon
  buttons (right-aligned) instead of text:
  - `download` — rendition download link
  - `copy-url` — copies rendition URL to clipboard
  - `share` — dispatches `asc:rendition:share`
  - `preview` — thumbnail image of the rendition (non-images fall back to asset thumbnail)
- **Cards display** (`| display | cards |`): thumbnail bleeds to top/left/right card edges; footer
  shows ghost icon buttons only (download + copy-url); title and meta use smaller type.

---

## Custom Events — Full Reference

All ASC custom events follow `asc:{noun}:{verb}`. Dispatched on `document` unless noted.

| Event | Dispatched by | Listened to by | `detail` shape |
|-------|--------------|----------------|----------------|
| `asc:search:execute` | All search filter blocks, search-results | SearchService | `{ form?, type?, source? }` |
| `asc:search:complete` | SearchService | search-results, search-statistics | `{ results, type, formData }` |
| `asc:search:error` | SearchService | (custom handlers) | `{ error, formData }` |
| `asc:asset:details:open` | Actions service | AssetDetails service | `{ data: { ascAsset } }` |
| `asc:asset:details:close` | Actions service | AssetDetails service, details-modal | — |
| `asc:asset:preload` | Actions service | Init service | `{ data: { ascPreload } }` |
| `asc:asset:share` | Actions service | (custom handler) | `{ data: { ascAsset } }` |
| `asc:collection:add` | Actions service | Collections service | `{ data: { ascAsset, ascCollection } }` |
| `asc:collection:remove` | Actions service | Collections service | `{ data: { ascAsset, ascCollection } }` |
| `asc:collection:change` | Collections service | collections, stub, collection-switcher blocks | `{ action, id?, collectionId?, assetId?, userId?, source? }` |
| `asc:collection:created` | Collections service | (UI handlers) | `{ collection }` |
| `asc:collection:deleted` | Collections service | (UI handlers) | `{ id }` |
| `asc:collection:activated` | Collections service | (UI handlers) | `{ id, previous }` |
| `asc:download:started` | Downloads service | (UI handlers) | `{ jobId }` |
| `asc:download:complete` | Downloads service | collection block | `{ jobId, downloadUrl }` |
| `asc:download:failed` | Downloads service | collection block | `{ jobId, error }` |
| `asc:download:change` | Downloads service | (UI handlers) | `{ jobId, status }` |
| `asc:blocks:loaded` | Init service | SearchService | `{ blocks }` |
| `asc:rendition:activate` | `details-renditions` | `details-preview`, `details-actions`, `details-rendition-metadata` | `{ rendition, asset }` — sticky selection; dispatched on `document.body` |
| `asc:rendition:preview` | `details-renditions` | `details-preview` | `{ rendition, asset }` — transient hover preview; `rendition: null` on mouseleave to restore sticky |
| `asc:share:created` | `action-share` block | `collection` block (past-shares panel) | `{ url, title, collectionId }` — fired after share URL is generated and saved to history |
| `asc:notification:show` | Any block/service (event-bus escape hatch) | notifications service | `{ message, type?, duration? }` — dispatched on `document`; prefer calling `notify()` from `scripts/asc/notifications.js` directly when possible |

`asc:search:complete` `results` shape:
```js
{
  assets: Asset[],  // hydrated Asset model instances
  total: number,    // total matching assets (for pagination display)
  size: number,     // assets in this batch
  offset: number,   // current offset
  more: boolean,    // more pages available
  success: boolean,
}
```

---

## Data Attributes — Full Reference

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `data-asc-action` | `noun:verb@eventType [...]` | Declarative event binding via Actions service. Space-separated for multiple. |
| `data-asc-asset` | UUID string | Asset identity — propagated through the DOM tree for event handlers |
| `data-asc-collection` | collection ID string | Collection reference — UUID of the target collection, or omit to use the active collection |
| `data-asc-preload` | URL path | Path prefetched on hover when `init.preload` is true |
| `data-asc-fieldset` | fieldset ID string | Groups a search input with its supporting inputs (for `cleanFormData` dependency logic) |

### Actions system

The Actions service listens to DOM events globally, parses `data-asc-action`, fires a matching `CustomEvent` on `document.body`, and passes all `data-*` attributes collected up the DOM tree as `event.detail.data`:

```html
<!-- fires asc:collection:add on click, passing ascAsset (collection defaults to active) -->
<button data-asc-action="collection:add@click"
        data-asc-asset="uuid-here">Add to Collection</button>

<!-- fires asc:collection:add targeting a specific collection by ID -->
<button data-asc-action="collection:add@click"
        data-asc-asset="uuid-here"
        data-asc-collection="collection-uuid-here">Add to Named Collection</button>

<!-- fires two events from one element -->
<article data-asc-action="asset:details:open@click asset:preload@mouseover"
         data-asc-asset="uuid-here">...</article>
```

---

## Search Provider Abstraction

Search blocks emit **QueryBuilder-native field names** (e.g. `{n}_group.daterange.lowerBound`). Both providers read this form data — the QueryBuilder provider passes it as-is; the OpenAPI provider's `buildParams()` performs a two-pass QB→OpenAPI translation.

### Form field naming convention

All search block inputs carry `form="asc-search-form"` so `SearchService.collectFormData()` picks them up. Most field names follow the QB group sub-key pattern:

```
{groupNum}_group.{predicateName}.{paramKey}    ← property, daterange, tagid predicates
```

**Exception — `path` predicate:** The QB `path` predicate takes its value directly as the key (no `.value` sub-key). `search-path` therefore emits:

```
{n}_group.path=/content/dam/…                  ← radio / dropdown (single selection)
{n}_group.1_path=/path1
{n}_group.2_path=/path2                         ← checkbox (multi-selection)
{n}_group.p.or=true                             ← emitted alongside multi-select checkboxes
```

`path.exact` and `path.flat` are sub-keys of the `path` predicate and remain in `{n}_group.path.exact` / `{n}_group.path.flat` form.  
`path.self` is **deprecated** by AEM — do not use it.

**Reference:** [QueryBuilder Predicate Reference](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates)

`groupNum` is the block's **filter-block-index** — assigned in DOM order, counting only blocks that call `readBlockConfig` from `search.js` (i.e. actual filter blocks, not display blocks like `search-results`). This number is stable across page loads as long as the filter blocks on the page don't change, which makes it safe to use in shareable URLs.

**Group number ranges:**
- Filter blocks (DOM order, via `readBlockConfig` from `search.js`): groups `1`–`n`
### Search config sheet (content-author static predicates)

`configurations.search.sheet` points to the `/asc` workbook in da.live. `SearchService` fetches the `search-predicates` sheet (`/asc.json?sheet=search-predicates`) lazily on first search and merges it into every search (tier 2b, between `basePredicates` and live form data).

Sheet format — two columns:

| name | value |
|------|-------|
| `path` | `/content/dam/brand` |
| `notexpired.property` | `jcr:content/metadata/dam:expirationDate` |
| `1000_group.property` | `jcr:content/metadata/dam:status` |
| `1000_group.property.value` | `approved` |

- **`name`** — full QB predicate name; include group prefix (`1000_group.*`) when grouping is needed
- **`value`** — predicate value

Both QB and OpenAPI providers receive the merged sheet params through the normal `formData` Map; OpenAPI translates them via its existing two-pass scan.

`SearchService.searchSilent(formData)` also applies sheet predicates, making it available to blocks like `details-similar` that run outside the search page's DOM.

### OpenAPI provider predicate mapping

`OpenApiProvider.buildParams()` performs a two-pass scan:

**Pass 1** — groups all `{n}_group.*` form entries by group number and predicate name.

**Pass 2** — maps known predicates:

| QB predicate | OpenAPI filter param | Notes |
|-------------|----------------------|-------|
| `daterange.lowerBound` + `.property` | `filter[createdAt\|modifiedAt][from]` | Property mapped via `DATE_PROPERTY_MAP` |
| `daterange.upperBound` + `.property` | `filter[createdAt\|modifiedAt][to]` | Same mapping |
| `tagid.N_value` | `filter[assetTagIds][]` | Each selected tag appended |
| `property.N_value` + `.property=dc:format` | `filter[assetFormat][]` | Via `PROPERTY_MAP` |
| `path` / `M_path` | `filter[assetAncestorPath]` | First value used; radio/dropdown → `N_group.path`; checkboxes → `N_group.M_path` |
| `fulltext` | `q` | Top-level, not a predicate group |

`DATE_PROPERTY_MAP` and `PROPERTY_MAP` are static getters on `OpenApiProvider` — extend them there to support additional JCR property → OpenAPI filter mappings.

### Adding a custom search provider

```js
// scripts/asc/core/services/search/providers/my-provider.js
import SearchProvider from '../search-provider.js';

export default class MyProvider extends SearchProvider {
  async search(formData) {
    // formData: Map of all form field names → values (QB-style)
    // Must return: { assets: Asset[], total, size, offset, more, success }
  }

  buildParams(formData) {
    // Return URLSearchParams for this provider's API
    return new URLSearchParams({ ... });
  }

  async getAssetById(id) { ... }
}
```

Register in `scripts/asc/core/services/search/search.js`:
```js
const PROVIDERS = {
  querybuilder: QueryBuilderProvider,
  openapi: OpenApiProvider,
  'my-provider': MyProvider,
};
```

Activate in `scripts/asc/configurations.js`:
```js
search: { provider: 'my-provider' }
```

---

## Parts — Interface Specification

Parts are **plain exported functions** that return HTML strings. They are not blocks — they have no `decorate()` and are never loaded independently by EDS.

```js
// scripts/asc/core/parts/my-part/my-part.js
// ASC Core — do not edit. Customize via scripts/asc/configurations.js
import { loadCSS } from '../../../aem.js';

loadCSS('/scripts/asc/core/parts/my-part/my-part.css');

/**
 * @param {Asset}  asset
 * @param {object} [options]
 * @returns {string} HTML string
 */
export default function myPart(asset, options = {}) {
  return `<div class="asc-my-part" data-asc-asset="${asset.uuid}">...</div>`;
}
```

Rules:
- **No classes, no constructors** — a Part is a function, not a class.
- **No event binding inside the Part** — all events use `data-asc-action` on the HTML, handled globally by the Actions service.
- **CSS class prefix**: `.asc-{part-name}` (not `.block.*`).
- Each Part loads its own CSS via `loadCSS()` at import time.

### `collectionToggle(asset, options?)`

Renders an add/remove collection toggle button. Both states are rendered simultaneously; CSS hides the inactive one based on `data-in-collection`. State is hydrated asynchronously after render and updated on every `asc:collection:change` event — including active collection switches.

```js
import collectionToggle from '../../scripts/asc/core/parts/collection-toggle/collection-toggle.js';

// Default — labels use {name} token replaced with the active collection name
container.insertAdjacentHTML('beforeend', collectionToggle(asset));

// Custom labels
container.insertAdjacentHTML('beforeend', collectionToggle(asset, {
  addLabel: 'Save to {name}',
  removeLabel: 'Saved to {name} ✓',
}));

// Target a specific collection
container.insertAdjacentHTML('beforeend', collectionToggle(asset, { collectionId: 'uuid' }));
```

| Option | Default | Description |
|--------|---------|-------------|
| `addLabel` | `'Add to {name}'` | Add button label; `{name}` is replaced with the active collection name |
| `removeLabel` | `'Remove from {name}'` | Remove button label |
| `collectionId` | active collection | Target a specific collection instead of the active one |

The Part registers a single global `asc:collection:change` listener at import time that keeps all `.asc-collection-toggle` instances on the page in sync — no per-block wiring needed.

---

Usage in a block:
```js
import assetTeaser from '../../scripts/asc/core/parts/asset-teaser/asset-teaser.js';

export default async function decorate(block) {
  const assets = /* ... */;
  block.querySelector('[data-asc-results]').innerHTML =
    assets.map((asset) => assetTeaser(asset)).join('');
}
```

The `Part` base class in `scripts/asc/core/parts/part.js` exists as documentation only — do not extend it.

---

## Search Utility — Shared Helpers

`scripts/asc/core/utils/search.js` exports helpers used by all search filter blocks:

### `readBlockConfig(block, transform, defaults)`
Wraps the generic `readBlockConfig` and adds search-specific context:
- `form` — the search form ID (`"asc-search-form"`)
- `group` — stable filter-block index (see "Form field naming convention" above)
- `field` — the full QB field name for this block's predicate
- `parameter(key, index?)` — builds a fully-qualified QB parameter name
- `fieldset` — the fieldset ID for dependency grouping
- `initial` — initial values for this group parsed from the current URL (used to restore state on page load / from a shared URL)

**Only call this from actual filter blocks.** Display blocks (`search-results`, `search-statistics`) must NOT call this — it consumes a group slot and must not be wasted on blocks that produce no group-scoped predicates. Display blocks that need `SEARCH_FORM` should import it directly from `search.js`.

### `SearchService.searchSilent(formData)`
Background search that applies `basePredicates`, sheet predicates, and `accepts` rules — but does NOT update the browser URL, fire `asc:search:complete`, or block concurrent searches. Use for programmatic fetches from detail or non-search pages.

```js
// In details-similar or any block that needs a scoped background query:
const results = await services.search.searchSilent(new Map([
  ['similar', asset.path],
  ['similar.fields', 'jcr:content/metadata/dc:tags'],
  ['p.limit', '9'],
]));
```

### `addSearchEventListeners(block, config)`
Wires all interactive inputs in a filter block (checkboxes, radios, date inputs, selects) to dispatch `asc:search:execute` on change. **All search filter blocks must use this** instead of writing their own change listeners.

```js
import { readBlockConfig, addSearchEventListeners } from '../../scripts/asc/core/utils/search.js';

export default function decorate(block) {
  const config = readBlockConfig(block, {}, { name: 'myfilter', ... });
  block.innerHTML = html(config);
  addSearchEventListeners(block, config);
}
```

### Restoring URL-based initial values

Every filter block **must** render its inputs with values pre-filled from `config.initial` so that shared/bookmarked URLs restore visual filter state. `config.initial` is populated by `getInitialValues(window.location.search, group)` inside `readBlockConfig` — no extra work required.

**`<input type="date">` pitfall:** URL persistence stores full ISO datetimes (`YYYY-MM-DDT00:00:00.000Z`). Date inputs only accept `YYYY-MM-DD`. Always strip the time suffix when setting the initial value:

```js
// Bad — browser silently ignores the ISO string, picker appears blank after refresh
value="${config.initial[lowerName] || ''}"

// Correct
value="${(config.initial[lowerName] || '').slice(0, 10)}"
```

`adjustFormData` re-appends the correct time suffix (`T00:00:00.000Z` / `T23:59:59.999Z`) before the search runs, so the QB query is always correct regardless.

---

## Property System

`asset.getProperty(name)` dispatches through the properties service. Built-in properties:

| Name | Returns |
|------|---------|
| `title` | `dc:title` |
| `thumbnail` | Thumbnail URL string |
| `file-type` | Human label: "JPEG", "PDF", etc. |
| `file-size` | Formatted: "1.2 MB" |
| `file-extension` | Extension string |
| `dimensions` | `{ width, height }` object |
| `width` / `height` | Individual pixel values |
| `mime-type` | Raw MIME type string |
| `modified` | `lastModified.toLocaleDateString()` |
| `created` | `created.toLocaleDateString()` |
| `description` | `dc:description` |
| `filename` | Node filename |

All built-in names are also valid in `searchResults.views` (see below).

### Adding a custom property

```js
// scripts/asc/configurations.js
properties: {
  custom: {
    'brand': (asset) => asset.getProperty('jcr:content/metadata/myco:brand').data,
    'approval-status': (asset) => {
      const s = asset.getProperty('jcr:content/metadata/dam:status').data;
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
    },
  }
}
```

Custom property names can then be used in `details-property` blocks and in `searchResults.views`.

---

## Search Result Views — `searchResults.views`

Controls which properties are displayed in each view mode. Configured in `scripts/asc/configurations.js`.

```js
searchResults: {
  views: {
    // Cards view: ordered array of property names
    cards: ['thumbnail', 'title', 'file-type', 'file-size'],

    // Masonry view: keep minimal — meta overlays on hover
    masonry: ['thumbnail', 'title'],

    // List view: columns with label and width
    list: [
      { property: 'thumbnail',  width: '48px'  },
      { property: 'title',      width: '1fr'   },
      { property: 'file-type',  label: 'Type',  width: '120px' },
      { property: 'file-size',  label: 'Size',  width: '90px'  },
      { property: 'modified',   label: 'Date',  width: '120px' },
      // Any registered custom property:
      { property: 'brand',      label: 'Brand', width: '120px' },
      // Escape hatch for complex rendering:
      { label: 'Status', width: '80px', render: (asset) => asset.getProperty('dam:status').html || '—' },
    ],
  },
},
```

**Rules:**
- `thumbnail` always renders as `<img>` in the preview area; all other properties go in the meta section
- For `list`, `label` defaults to a sensible built-in name if omitted
- The `render` function on a list column receives `(asset, services)` and should return an HTML string; it bypasses the property system entirely

---

## Rendition System

The renditions system is the client-side equivalent of ASC v1's `AssetRenditionDispatcher`. It resolves download URLs for each asset through a **resolver registry**. Each resolver handles one rendition type and covers two paths: resolving an explicit definition from `configurations.js`, and (for node-backed types) auto-detecting renditions by scanning `jcr:content/renditions/*` nodes.

Six built-in resolver types map to AEM delivery patterns:

| Type | AEM v1 equivalent | When to use |
|------|------------------|-------------|
| `static` | `StaticRenditionDispatcher` | JCR rendition nodes (`jcr:content/renditions/*`, `nt:file`); works on any AEM |
| `dm-scene7` | `DynamicMediaSmartCropRenderer` | **Classic DM (Scene7) smart crops** — IS-protocol URL; **auto-detected** from `sling:resourceType: dam/rendition/smartcrop` JCR nodes; no definitions needed |
| `url-template` | `ExternalRedirectRenderer` | **Legacy DM / Scene7 IS/IR protocol** — declarative `${variable}` template string; preferred for DM presets |
| `url` | `ExternalRedirectRenderer` | **Custom URL construction** — arbitrary JS function `(asset) => string`; use when `url-template` tokens are not enough |
| `web-optimized-delivery` | — | **Web-optimized delivery** — `dm-aid--{uuid}` URL prefix; AEMaaCS publish without full DM OpenAPI |
| `dm-openapi` | `DmOpenApiRenditionDispatcher` | **DM with OpenAPI** — plain transforms, smart crops (`?smartcrop=`), named presets (`?imagePreset=`); AEMaaCS + DM OpenAPI |

**Key distinction — three different DM delivery patterns:**

| | Classic DM (Scene7 / IS-IR) | Web-optimized delivery | DM with OpenAPI |
|---|---|---|---|
| **AEM version** | AEM 6.5 or AEMaaCS + classic DM | AEMaaCS publish | AEMaaCS + DM OpenAPI enabled |
| **Rendition type** | `dm-scene7`, `url-template`, or `url` | `web-optimized-delivery` | `dm-openapi` |
| **URL prefix** | `{dam:scene7Domain}/is/image/` | `{host}/adobe/dynamicmedia/deliver/dm-aid--{uuid}/` | `{deliveryHost}/adobe/dynamicmedia/deliver/{uuid}/` |
| **Asset identifier** | `dam:scene7File` metadata | UUID (with `dm-aid--` prefix) | UUID |
| **Requires DM OpenAPI** | No | No | Yes |
| **Smart crop / presets** | `:CropName` / `?$preset$` | No | `?smartcrop=Name` / `?imagePreset=name` |

> **`dam:scene7Domain` vs `dam:scene7APIServer`** — `dam:scene7Domain` is the IS/IR delivery CDN host used in all image URLs (e.g. `https://s7d1.scene7.com/`). `dam:scene7APIServer` is the Scene7 management API endpoint — **not** used for delivery. Use `${dm.domain}` in `url-template` strings for IS/IR URLs.

### Template variables for `type: 'url-template'`

`url-template` uses a `template` string with `${variable}` tokens resolved at runtime. The resolver returns `null` automatically if any referenced token has no value on the asset — so an `accepts` guard is optional (it degrades safely without one).

| Variable | Resolves to | JCR metadata path |
|----------|------------|-------------------|
| `${asset.path}` | JCR path | — |
| `${asset.name}` | Node name (filename) | — |
| `${asset.extension}` | File extension | — |
| `${rendition.name}` | This definition's `id` | — |
| `${dm.name}` | Scene7 asset name | `dam:scene7Name` |
| `${dm.id}` | Scene7 asset ID | `dam:scene7ID` |
| `${dm.file}` | Scene7 file path | `dam:scene7File` |
| `${dm.folder}` | Scene7 folder | `dam:scene7Folder` |
| `${dm.domain}` | **IS/IR delivery CDN host** (use this for image URLs) | `dam:scene7Domain` |
| `${dm.api-server}` | Scene7 management API (not for delivery) | `dam:scene7APIServer` |

`${rendition.name}` equals the definition's `id` field — useful for DM IS/IR presets where the preset name must appear in the URL.

> **Smart crops** — use `type: 'dm-scene7'` instead of `url-template`. The resolver auto-detects all `sling:resourceType: dam/rendition/smartcrop` nodes from the asset's JCR renditions tree so no definitions are needed. Use explicit definitions only when you need a custom label or an `accepts` guard on a specific crop. An explicit definition never hardcodes the DM crop name as its own `id` — instead it looks up the real node among the asset's smart-crop renditions via `smartCropId` (the exact, case-sensitive DM-registered crop name, e.g. `smartCropId: 'Small'`; falls back to `id` if omitted); `id` is optional and defaults to the matched node's real name, so you only need it when you want a stable slug for `getRendition()` lookups. If a definition's `smartCropId` finds no corresponding node on a given asset, it resolves to `null` — it never fabricates a URL for a crop that doesn't exist.

### `accepts` filter

Controls which asset types a rendition applies to:
- Omit → all assets
- MIME glob string: `'image/*'`, `'video/*'`, `'application/pdf'`
- Function: `(asset) => asset.getProperty('dam:scene7File').data != null`

### `visible` flag

`visible: false` hides a rendition from the download list while keeping it available via `services.renditions.getRendition(asset, id)`. Use for the `thumbnail` rendition, which is used internally by teasers but shouldn't appear as a download option.

### File size — lazy HEAD fetch

Static renditions have `fileSize` from JCR metadata. Dynamically generated renditions
(dm-scene7, url, url-template) do not — their size is unknown until the URL is
requested.

After the block renders, `details-renditions` fires a `HEAD` request for every rendition
with no `fileSize`. The `Content-Length` response header is read and the cell / card meta
updated in place. Same auth logic as blob download: AEM auth headers for AEM-host URLs,
no credentials for CDN/Scene7 URLs (`credentials: 'omit'` keeps it compatible with
`Access-Control-Allow-Origin: *`).

If the server returns no `Content-Length` (e.g. chunked transfer, Scene7 crop with no
pre-generated file), the cell remains blank — no error is thrown.

### Download filenames

Each resolver is responsible for the download filename of its rendition type. Resolvers set `filename` on the `Rendition` they construct; the block uses it verbatim when present and falls back to a generic `{asset-stem}-{rendition-id}.{ext}` pattern otherwise.

**Built-in naming**

| Type | Filename pattern | Example |
|------|-----------------|---------|
| `dm-scene7` | `{asset-stem}-smart-crop-{cropName}.jpg` | `hero-banner-smart-crop-Large.jpg` |
| `static` / `url` / `url-template` / `dm-openapi` | `{asset-stem}-{id}.{ext}` | `hero-banner-web.jpg` |
| `static` with JCR node name as id | extension stripped: `{asset-stem}-{node-base}.{ext}` | `hero-banner-cq5dam.fpo.png` |
| `original` | `{asset-stem}.{ext}` (no suffix) | `hero-banner.jpg` |

**Definition-level override** — add `filename` to any definition in `configurations.js`. A plain string is used as-is; a function receives `(rendition, asset)` and returns a string. Applied after the resolver runs, so `rendition` already has its `url`, `mimeType`, etc.

```js
// Plain string
{ id: 'fpo', label: 'FPO', type: 'static', name: 'cq5dam.fpo',
  filename: 'fpo-placeholder.png' }

// Function — full access to rendition and asset
{ id: 'web', label: 'Web', type: 'static', name: /^cq5dam\.web\./,
  filename: (rendition, asset) => {
    const stem = asset.filename?.replace(/\.[^.]+$/, '') ?? asset.title;
    return `${stem}-web-optimized.jpg`;
  } }
```

**Resolver-level override** — set `filename` in the `Rendition` constructor inside `fromDefinition` or `fromNode`. This is the right place when the naming logic depends on information only the resolver has (e.g. the crop name in `dm-scene7`):

```js
fromNode(name, node, asset) {
  const url = buildUrl(asset, name);
  return new Rendition({
    id: name, label: `My Type — ${name}`,
    url,
    filename: `${asset.filename?.replace(/\.[^.]+$/, '')}-my-type-${name}.png`,
  });
}
```

Definition-level `filename` always wins over a resolver-set one (applied last by `_resolveFromDef`).

### `thumbnails` array — responsive srcset for search result cards

Put thumbnail renditions in a **separate `thumbnails` array** (not `definitions`). Entries in `thumbnails` are never shown in the download list — they exist solely to generate the `<img srcset>` on asset teasers (cards, masonry, list thumbnail, collection mosaics). Each entry requires `size.width` so the browser gets a correct `Nw` descriptor. Board cards use a separate, wider `previews` ladder instead — see below — since board items show the image uncropped at its native aspect ratio rather than in a fixed-size card slot.

Use `web-optimized-delivery` for thumbnails — it works on any AEMaaCS publish instance without requiring DM OpenAPI to be enabled. Use `dm-openapi` only in `definitions` (downloadable renditions).

```js
renditions: {
  thumbnails: [
    { type: 'web-optimized-delivery', size: { width: 250  }, params: 'width=250&preferwebp=true&quality=85',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 500  }, params: 'width=500&preferwebp=true&quality=85',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 1000 }, params: 'width=1000&preferwebp=true&quality=60', accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 1600 }, params: 'width=1600&preferwebp=true&quality=60', accepts: (asset) => asset.mimeType?.startsWith('image/') },
  ],
  definitions: [ /* downloadable renditions */ ],
}
```

URL shape: `{host}/adobe/dynamicmedia/deliver/dm-aid--{uuid}/{filename}?{params}` — the `dm-aid--` prefix distinguishes web-optimized from DM OpenAPI delivery. Uses `aem.deliveryHost` when set, falls back to `aem.host`.

`services.renditions.getThumbnailSrcset(asset)` reads `thumbnails`, resolves URLs for the asset, and returns them sorted smallest to largest. `getThumbnailUrl(asset)` picks the mid-size entry as the `src` fallback. Non-image assets return `[]` if all entries have `accepts: (asset) => asset.mimeType?.startsWith('image/')`, falling back to the static `cq5dam.thumbnail` node URL.

### `previews` array — responsive srcset for natural-aspect board cards

Same shape and rules as `thumbnails` (separate array, `size.width` required, never shown in the download list), read by `services.renditions.getPreviewSrcset(asset)` and consumed by `scripts/asc/board-item.js`. Kept separate from `thumbnails` because board cards (`asc-ui-asset-card--natural`) show the image at its own aspect ratio in a canvas the user can zoom up to 3x (see `blocks/board/board.js`'s pan/zoom engine) — `web-optimized-delivery` with only `width` set resizes proportionally (no crop), so it's safe for that uncropped display, and the ladder's top end needs to cover the zoomed-in size, not just the resting ~240px card width.

```js
renditions: {
  previews: [
    { type: 'web-optimized-delivery', size: { width: 240  }, params: 'width=240&preferwebp=true&quality=85',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 480  }, params: 'width=480&preferwebp=true&quality=85',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 960  }, params: 'width=960&preferwebp=true&quality=80',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 1920 }, params: 'width=1920&preferwebp=true&quality=75', accepts: (asset) => asset.mimeType?.startsWith('image/') },
  ],
}
```

Board's CSS-transform-based zoom (`canvas.style.transform = ...scale(zoom)`) changes what's painted on screen without changing the `<img>`'s layout width — the dimension the browser's native srcset selection is based on — so a zoomed-in card would otherwise just upscale whatever low-res candidate it picked at rest. `board.js` compensates by re-pointing each visible image's `sizes` attribute at `offsetWidth * zoom` (debounced, on every pan/zoom change), which forces the browser to re-run its normal srcset selection against the zoomed-in effective size, picking a larger tier once it's actually needed on screen.

### How To: Add a Custom Rendition

```js
// scripts/asc/configurations.js
renditions: {
  // Thumbnail srcset — never in download list, used by cards/masonry/list/collection mosaics.
  thumbnails: [
    { type: 'web-optimized-delivery', size: { width: 250  }, params: 'width=250&preferwebp=true&quality=85',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 500  }, params: 'width=500&preferwebp=true&quality=85',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 1000 }, params: 'width=1000&preferwebp=true&quality=60', accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 1600 }, params: 'width=1600&preferwebp=true&quality=60', accepts: (asset) => asset.mimeType?.startsWith('image/') },
  ],

  definitions: [
    // ── Static (any AEM) ──────────────────────────────────────────────────
    { id: 'thumbnail', label: 'Thumbnail', type: 'static', name: /^cq5dam\.thumbnail\./, visible: false },
    { id: 'web',       label: 'Web',       type: 'static', name: /^cq5dam\.web\./,       accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { id: 'original',  label: 'Original',  type: 'static', name: 'original' },

    // ── Classic DM / Scene7 IS-IR protocol (AEM 6.5 or classic DM) ───────
    // Smart crops are auto-detected from the asset's JCR renditions tree
    // (sling:resourceType: dam/rendition/smartcrop nodes). No definitions needed.
    // Add an explicit dm-scene7 definition only to override label or add an accepts guard.
    // `smartCropId` (not `id`!) picks the real DM-registered crop name (case-sensitive)
    // to customize; `id` is optional and defaults to the matched crop name:
    // { label: 'Smart Crop — Small', type: 'dm-scene7', smartCropId: 'Small' },

    // IS/IR image preset — url-template with ${dm.domain} (delivery CDN host).
    {
      id: 'dm-web-preset',
      label: 'Web Preset',
      type: 'url-template',
      template: '${dm.domain}is/image/${dm.file}?$web$',
    },

    // ── DM with OpenAPI / Asset Delivery (AEMaaCS only) ──────────────────
    // Requires aem.deliveryHost. Falls back to aem.host if not set.
    {
      id: 'web-optimized',
      label: 'Web Optimized',
      type: 'dm-openapi',
      params: 'format=webp&preferwebp=true&width=1200&quality=85',
      accepts: (asset) => asset.mimeType?.startsWith('image/'),
    },
    {
      id: 'smart-crop-small',
      label: 'Smart Crop — Small',
      type: 'dm-openapi',
      params: 'smartcrop=Small',
      accepts: (asset) => asset.mimeType?.startsWith('image/'),
    },
  ],

  // ── Custom resolvers (optional) ────────────────────────────────────────
  // Register a new type or override a built-in by keying on the type string.
  resolvers: {
    'my-type': {
      // Return a new Rendition or null. Set rendition.filename to control the download filename.
      fromDefinition(def, asset, aemConfig) { /* return new Rendition({...}) or null */ },
      // Node-scanning (optional — for JCR-backed types):
      autoDetect: true,                      // true = also runs in getRenditions() default pass
      acceptsNode(name, node) { return false; },
      fromNode(name, node, asset, aemConfig) { /* return new Rendition({...}) or null */ },
    },
  },
}
```

### Service API

```js
import services from '../../scripts/asc/core/services/services.js';

services.renditions.getRenditions(asset);              // definitions + auto-detected node renditions (autoDetect: true)
services.renditions.getRendition(asset, 'web');        // single rendition by id
services.renditions.resolveAllNodes(asset);            // every JCR node through all resolvers — used by 'all' mode
services.renditions.getThumbnailUrl(asset);            // best thumbnail URL (with fallback)
services.renditions.getThumbnailSrcset(asset);         // Rendition[] sorted by size.width, for <img srcset>
services.renditions.getPreviewSrcset(asset);           // Rendition[] sorted by size.width, natural-aspect (board cards)
services.renditions.getRenditionDefinition('web');     // raw definition object (no asset needed)
```

### Asset Model — Computed Rendition Properties

```js
// CSS `aspect-ratio` string for the most-portrait rendition across all renditions +
// the asset's own TIFF dimensions. Use as the initial container AR so every rendition
// can display without clipping; bars appear for wider renditions but nothing is cropped.
// Falls back to "4 / 3" when no dimension metadata is available.
asset.renditionsBoundingAspectRatio  // → e.g. "1280 / 960" or "4 / 3"

// Typical usage in a details block
block.style.setProperty('--preview-ar', asset.renditionsBoundingAspectRatio);

// Snap to actual image dimensions after load (eliminates bars for exact matches)
img.addEventListener('load', () => {
  if (img.naturalWidth && img.naturalHeight) {
    container.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
  }
}, { once: true });
```

---

## UI Kit (`.asc-ui-*`)

Reusable, theme-driven UI primitives shared across blocks, parts, and templates.
**Before writing new block CSS, reuse a kit primitive.** Full catalog with copy-paste
markup: [`docs/UI_KIT.md`](docs/UI_KIT.md). Visual gallery (themed, with per-element
code/usage): [`/docs/ui-kit.html`](docs/ui-kit.html). Styles: [`styles/ui-kit.css`](styles/ui-kit.css)
(each primitive tagged `@kit <name>` for grepping).

Primitives: `asc-ui-card`, `asc-ui-badge`, `asc-ui-chip`, `asc-ui-empty-state`,
`asc-ui-skeleton`, `asc-ui-spinner`, `asc-ui-segmented`, `asc-ui-switch`, `asc-ui-field`,
`asc-ui-search`, `asc-ui-control`/`asc-ui-dropdown`, `asc-ui-collection-card`,
`asc-ui-asset-row`, `asc-ui-table`, `asc-ui-masonry`, `asc-ui-icon-btn`, plus the
typography helpers. Foundational `.btn`, form fields, `.asc-panel`, and `.asc-dialog`
live in `styles.css` (documented below).

### Kit-first checklist (run through this for every block task)

- [ ] Checked `docs/UI_KIT.md` for existing primitives that cover the UI I need?
- [ ] Used `.asc-ui-*` / `.btn` classes — not reimplemented them in block CSS?
- [ ] Needed a new variant? Added it to `ui-kit.css` + gallery tile + catalog entry first?
- [ ] Block CSS contains only layout rules (grid tracks, gaps, spacing between primitives)?
- [ ] Ran `npm run lint:css` after any kit or block CSS changes?

### Kit anti-patterns — never do these

- **Don't** write `.my-block__badge { … }` when `.asc-ui-badge` exists — use the kit class.
- **Don't** override kit primitive styles inside a block's CSS — add a modifier variant to the kit instead.
- **Don't** use raw color values — always use `--color-*` semantic tokens.
- **Don't** duplicate a row/card/table layout that `asc-ui-asset-row`, `asc-ui-card`, or `asc-ui-table` already provides.

When a block needs a primitive to look different, add a variant *to the kit* (and document
it) rather than overriding it inside the block.

---

## Button Utilities (`.btn`)

Global utility classes defined in `styles/styles.css`. Use these for all component buttons — not EDS editorial `a.button:any-link`.

```html
<!-- Variants -->
<button class="btn btn--primary">Save</button>
<button class="btn btn--secondary">Cancel</button>
<button class="btn btn--ghost">Dismiss</button>
<button class="btn btn--danger">Delete</button>

<!-- Size modifier -->
<button class="btn btn--primary btn--sm">Small</button>

<!-- Icon button (square, circular) -->
<button class="btn btn--ghost btn--icon" aria-label="Close">✕</button>
```

| Class | Appearance |
|-------|-----------|
| `.btn` | Base: `inline-flex`, padded, border-radius, transitions |
| `.btn--primary` | `--color-primary` background, `--color-primary-fg` text |
| `.btn--secondary` | Transparent + `--color-border` border |
| `.btn--ghost` | Transparent, no border |
| `.btn--danger` | `--color-destructive` background |
| `.btn--sm` | Smaller padding and `--body-font-size-xs` |
| `.btn--icon` | Fixed 36×36px square, `--border-radius-full` |

Focus: automatic `outline` using `--color-ring` via `:focus-visible`.

---

## Modal Pattern (native `<dialog>`)

Use the native `<dialog>` element for all modals. Add `class="asc-dialog"` for the shared base styles.

```js
// Open
const dialog = document.createElement('dialog');
dialog.className = 'asc-dialog my-block__dialog';
dialog.setAttribute('aria-labelledby', 'my-dialog-title');
dialog.innerHTML = `
  <h2 id="my-dialog-title" class="asc-dialog__title">Dialog Title</h2>
  <div class="asc-dialog__body">...</div>
  <footer class="asc-dialog__footer">
    <button class="btn btn--secondary" data-close-dialog>Cancel</button>
    <button class="btn btn--primary">Confirm</button>
  </footer>`;
document.body.append(dialog);

// Show
dialog.showModal();

// Close on backdrop click
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

// Close on [data-close-dialog]
dialog.addEventListener('click', (e) => { if (e.target.closest('[data-close-dialog]')) dialog.close(); });
```

`::backdrop` is styled globally in `styles/styles.css` with a semi-transparent overlay.

---

## How To: Add a Custom Theme

Themes override only the `--color-*` semantic tokens (and optionally `--body-font-family`). **Never** override structural tokens like spacing, border-radius, or shadow in a theme file.

Built-in themes: `default` (Violet Studio), `dark` (Deep Ocean), `studio` (Unsplash). `warm` and `vault` are removed.

1. Create `styles/themes/my-theme.css`:
```css
.theme-my-theme {
  /* ── Required color roles ─────────────────────────────────────────── */
  --color-bg:             #f5f5f0;
  --color-fg:             #1a1a1a;
  --color-card:           #ffffff;
  --color-card-fg:        #1a1a1a;
  --color-primary:        #c44b0a;   /* Action color */
  --color-primary-fg:     #ffffff;   /* Text ON primary */
  --color-secondary:      #eeece8;
  --color-secondary-fg:   #1a1a1a;
  --color-muted:          #f0ede8;   /* Subtle backgrounds */
  --color-muted-fg:       #6b6560;   /* Secondary text */
  --color-accent:         #fce8dd;   /* Hover tints */
  --color-accent-fg:      #c44b0a;
  --color-destructive:    #dc2626;
  --color-destructive-fg: #ffffff;
  --color-border:         #ddd8d0;
  --color-input:          #ffffff;
  --color-ring:           #c44b0a;   /* Focus outline */

  /* ── Optional overrides ──────────────────────────────────────────── */
  --body-font-family: Georgia, serif;

  /* For dark themes, override the select chevron to a light color: */
  /* --select-arrow: url("data:image/svg+xml,..."); */
}
```

### Semantic token reference

| Token | Role |
|-------|------|
| `--color-bg` | Page background |
| `--color-fg` | Default text |
| `--color-card` / `--color-card-fg` | Card surface / text |
| `--color-popover` / `--color-popover-fg` | Dropdown/tooltip surface / text |
| `--color-primary` / `--color-primary-fg` | Primary action (buttons, links, badges) / text on primary |
| `--color-secondary` / `--color-secondary-fg` | Secondary surface / text |
| `--color-muted` / `--color-muted-fg` | Subtle background / secondary text |
| `--color-accent` / `--color-accent-fg` | Hover tint backgrounds / text |
| `--color-destructive` / `--color-destructive-fg` | Danger/delete actions / text |
| `--color-border` | All borders and dividers |
| `--color-input` | Form input backgrounds |
| `--color-ring` | Focus outline color |

2. In `scripts/asc/configurations.js`:
```js
theme: { default: 'my-theme' }
```

The `ascEager(doc)` hook in `scripts/asc.js` reads this value, adds `theme-{name}` to `<body>`, and loads `styles/themes/{name}.css`. It is called from `scripts/scripts.js` `loadEager()`.

---

<<<<<<< HEAD
## DA.live Block Library

Authoring in this project is DA.live / Experience Workspace only — there is no Universal Editor
integration.

### Block Authoring Registration — required for every new author-placed block

New blocks must be registered in the DA.live block library (`library/blocks` sheet in DA content,
not this repo — one `{ name, path }` row per block, pointing at an example doc under
`/blocks/<block-name>`). See `https://docs.da.live/administrators/guides/setup-library`. Skip
this for blocks that are never section-placed (`action-*`, invoked via the actions service) and
for stock EDS blocks (`columns`, `content`, `header`, `footer`, `fragment`). New DA documents/
sheets need to be previewed and published before the library reflects them.
=======
## Universal Editor

The project ships three JSON files at the project root for Universal Editor support:

| File | Purpose |
|------|---------|
| `component-definition.json` | Component library (palette) — grouped: Search, Asset Details, Collections, Standard |
| `component-models.json` | Sidebar field definitions for each block |
| `component-filters.json` | Containment rules — what blocks can go in which sections |

To activate page-level filters (e.g. `asc-details-page`), add `data-aue-filter="asc-details-page"` to the `<main>` element of the page template.

If a block's JS reads config via `readBlockConfig()` (fixed `key | value` rows), its
`component-definition.json` template **must** set `"key-value": true` — otherwise Universal
Editor renders fields positionally (bare values, no key cell), which `readBlockConfig()` can't
parse. Blocks that take unbounded/free-form rows (`Label | property` lists like
`details-metadata`) aren't a good fit for fixed model fields — register a single descriptive
`richtext` field instead (see `search-hidden`'s model) and keep the row format documented in the
block's own header comment.

### Block Authoring Registration — required for every new author-placed block

New blocks must be registered in **both** Universal Editor (above) **and** the DA.live block
library (`library/blocks` sheet in DA content, not this repo — one `{ name, path }` row per
block, pointing at an example doc under `/blocks/<block-name>`). See
`https://docs.da.live/administrators/guides/setup-library`. Skip both for blocks that are never
section-placed (`action-*`, invoked via the actions service) and for stock EDS blocks (`columns`,
`content`, `header`, `footer`, `fragment`). New DA documents/sheets need to be previewed and
published before the library reflects them.
>>>>>>> e491bd9eaed27b48674fbaf6e6ccd5a64870df9e

---

## Collections Service

`scripts/asc/core/services/collections/collections.js` — singleton exported from `services.js` as `services.collections`.

### Storage schema

Stored under `storage.get('collections')` (user-scoped):

```js
{
  defaultId: "uuid",     // permanent default collection — never deleted
  items: {
    "uuid": {
      id:         string,  // crypto.randomUUID()
      name:       string,
      createdAt:  ISO string,
      modifiedAt: ISO string,
      items:      Array<AssetItem | SectionItem>
    }
  }
}

// AssetItem:   { type: 'asset',   id: string, mimeType?: string, x?: number, y?: number, notes?: string }
// SectionItem: { type: 'section', id: string, title: string, body: string }
```

The **active collection** ID is stored separately under `storage.get(storage.ACTIVE_COLLECTION_ID)`. `null` means use `defaultId`.

### API

```js
import services from '../../scripts/asc/core/services/services.js';
const { collections } = services;

// CRUD
collections.create(name)           // → Collection (not hydrated)
collections.delete(id)             // default collection is protected
collections.rename(id, name)

// Getters  (hydrateAssets=true adds an `assets: Asset[]` array)
await collections.getAll(hydrateAssets?)          // → Collection[]
await collections.get(id, hydrateAssets?)         // → Collection | null
await collections.getDefault(hydrateAssets?)      // → Collection
await collections.getActive(hydrateAssets?)       // → Collection
      collections.getActiveId()                   // → string (UUID)
      collections.setActive(id)

// Asset management (collectionId defaults to active collection)
await collections.addAsset(assetId, collectionId?)
await collections.removeAsset(assetId, collectionId?)
await collections.hasAsset(assetId, collectionId?)   // → boolean

// Board item updates — partial update of x/y position and/or notes for an asset item
      collections.updateItem(collectionId, assetId, { x?, y?, notes? })

// Asset reordering — replaces the full ordered array (programmatic use; board uses x/y instead)
      collections.reorderAssets(collectionId, newAssetIds)

// Section management (stored in items[] alongside assets)
await collections.addSection(collectionId, { title?, body? })       // → SectionItem
      collections.updateSection(collectionId, sectionId, { title, body })
await collections.removeSection(collectionId, sectionId)

// Login / merge / logout
await collections.loginAs(userId)  // merges anonymous → user, switches context
      collections.logout()         // switches back to anonymous scope
```

### Events dispatched on `document`

| Event | When | `detail` shape |
|-------|------|----------------|
| `asc:collection:change` | Any mutation or cross-tab sync | `{ action, id?, collectionId?, assetId?, userId?, source? }` |
| `asc:collection:created` | New collection created | `{ collection }` |
| `asc:collection:deleted` | Collection deleted | `{ id }` |
| `asc:collection:activated` | Active collection changed | `{ id, previous }` |

`action` values in `asc:collection:change`: `"created"`, `"deleted"`, `"renamed"`, `"activated"`, `"assetAdded"`, `"assetRemoved"`, `"reordered"`, `"login"`, `"logout"`, or `"external"` (cross-tab).

### Share URL format (`?sheet=`)

The collection Share dialog encodes the full board state as a single compressed JSON payload:

```
{sheetPath}?sheet={compressArray([JSON.stringify(payload)])}
```

Payload structure:
```js
{
  title:        string,
  description?: string,
  expiresAt?:   ISO string,          // link expires; board shows an error state, sheet-controls hides its buttons
  items:        string[],            // encoded asset and section items (see below)
  textElements?: { x, y, w, h, content }[],  // free-floating text from the board
}
```

Item encoding within `items[]`:
- **Asset** (no position, no notes): `"uuid"`
- **Asset** (with board position): `"uuid@x,y"`
- **Asset** (with notes): `"uuid@x,y|||notes text"` or `"uuid|||notes text"`
- **Section heading**: `"~title|||body"`

`board` (source: sheet) and `sheet-controls` each independently decode the same payload for display.

---

## Downloads Service

`scripts/asc/core/services/downloads/downloads.js` — singleton. Manages asynchronous AEM bulk-download jobs with localStorage persistence.

### Storage schema

Stored under `storage.get(storage.DOWNLOAD_JOBS)` (user-scoped):

```js
{
  jobs: {
    "local-uuid": {
      id:           string,    // local UUID
      collectionId: string,    // source collection ID
      assetPaths:   string[],  // JCR asset paths
      renditionIds: string[],  // rendition IDs to download
      status:       string,    // 'pending' | 'running' | 'complete' | 'failed'
      aemJobId:     string,    // job ID returned by AEM download framework
      downloadUrl:  string,    // URL to trigger on completion
      error:        string,    // error message (if failed)
      createdAt:    ISO,
      updatedAt:    ISO,
      expiresAt:    ISO,       // auto-cleaned after jobExpiry ms (default 7 days)
    }
  }
}
```

### API

```js
import services from '../../scripts/asc/core/services/services.js';
const { downloads } = services;

// Initiate an async AEM download job (returns immediately; polling runs in background)
await downloads.create(assetPaths, renditionIds, { collectionId?, autoDownload?: true });

// Retrieve jobs
downloads.getAll()         // → job[]  (sorted newest first)
downloads.get(jobId)       // → job | null

// Resume polling for a job that didn't finish within the quick-poll window
await downloads.resume(jobId, autoDownload?)

// Trigger a browser download for a completed job
downloads.triggerDownload(jobId)
```

### Events dispatched on `document`

| Event | When | `detail` shape |
|-------|------|----------------|
| `asc:download:started` | Job created locally | `{ jobId }` |
| `asc:download:complete` | AEM job finished, URL available | `{ jobId, downloadUrl }` |
| `asc:download:failed` | AEM job failed or fetch error | `{ jobId, error }` |
| `asc:download:change` | Any job status update | `{ jobId, status }` |

### Configuration (`configurations.downloads`)

| Key | Default | Description |
|-----|---------|-------------|
| `initiateUrl` | `/content/dam.downloads.initiateDownload.json` | AEM download servlet path |
| `quickPollTimeout` | `15000` | Fast-poll window in ms before leaving job as 'running' |
| `pollInterval` | `2000` | Poll interval in ms |
| `jobExpiry` | `604800000` (7 days) | Job TTL in ms — older jobs are auto-removed |

---

## Storage Service

`scripts/asc/core/services/storage/storage.js` — singleton. Provides user-scoped and global localStorage management.

### Key constants (available as `storage.KEY_NAME`)

| Constant | Key | Scope |
|----------|-----|-------|
| `COLLECTIONS` | `"collections"` | user |
| `ACTIVE_COLLECTION_ID` | `"activeCollectionId"` | user |
| `RECENTLY_VIEWED` | `"recentlyViewed"` | user |
| `THEME` | `"theme"` | global |
| `SHARED_LINKS` | `"sharedLinks"` | global |

### API

```js
import storage from '../../scripts/asc/core/services/storage/storage.js';

// User-scoped
storage.get(key)          // → value | null
storage.set(key, value)
storage.remove(key)

// Global (shared across users)
storage.getGlobal(key)
storage.setGlobal(key, value)
storage.removeGlobal(key)

// Domain helpers
storage.addRecentlyViewed(uuid)      // prepends, deduplicates, caps at 50
storage.getRecentlyViewed()          // → string[]
storage.getTheme()                   // → string | null
storage.setTheme(name)
storage.addSharedLink(url, label?)   // prepends, deduplicates by URL
storage.getSharedLinks()             // → { url, label, receivedAt }[]

// Cross-tab sync
storage.onExternalChange(callback)   // fires callback on StorageEvent for asc:* keys
storage.mergeUserData(fromId, toId)  // merges recentlyViewed (used by loginAs)
```

### localStorage structure

```
asc        → { currentUserId, theme, sharedLinks }
asc:anonymous → { user, collections, activeCollectionId, recentlyViewed }
asc:user123   → { user, collections, activeCollectionId, recentlyViewed }
```

---

## URL Service

`scripts/asc/core/services/url/url.js` — singleton. URL helpers for asset lists.

```js
import url from '../../scripts/asc/core/services/url/url.js';

// Low-level compression — used by the collection share dialog to encode the ?sheet= payload
const encoded = await url.compressArray(['uuid1', 'uuid2']);
const values  = await url.decompressToArray(encoded);

// Legacy helpers — still available but not used by the board/sheet share flow
const shareUrl = await url.toCollectionUrl(assetIds, { param: 'assets', base?: string });
const assetIds = await url.fromCollectionUrl(window.location.search, 'assets');

// Strip the origin off an authored URL and re-anchor it to the current domain —
// authors paste share/sheet links copied from whichever environment they were on
// (aem.live, aem.page, localhost, a custom domain); only the path/query/hash is
// ever meaningful. Used by board.js (details/sheet-url rows), search-bar.js
// (redirect row), and share-directory.js (share link cells).
const relative = url.toRelativeUrl('https://main--site--org.aem.page/sheet?sheet=abc');
// → '/sheet?sheet=abc'
```

---

## Authored Assets Service

`scripts/asc/core/services/authored-assets/authored-assets.js` — singleton. Resolves
site-owner-authored asset references (a UUID or an exact DAM path, one per line) through the
active search provider, with a bounded concurrency pool so a long list doesn't fire an unbounded
request burst. Backs `board`'s `source: authored` and `share-directory`'s thumbnail-mosaic
resolution for authored-list/board links.

```js
import services from '../../scripts/asc/core/services/services.js';

// Parse a rich-text cell (DA/UE may use <p>/<li>/<br> for line breaks) into raw reference strings
const ids = services.authoredAssets.parseAssetReferences(cellElement);

// Resolve them, honoring configurations.authoredAssets.concurrency (default 4)
const assets = await services.authoredAssets.resolveAssetReferences(ids);
```

Configuration (`configurations.authoredAssets`):

| Key | Default | Description |
|-----|---------|--------------|
| `concurrency` | `4` | Max in-flight resolution requests |
| `resolveReference` | _(none)_ | `async (reference) => Asset \| AssetAccessError \| null` — override resolution entirely (e.g. to hit a custom API instead of the search provider) |

---

## Block Event Scoping Summary

| Scope | Delegate to | Use case |
|-------|-------------|----------|
| Search events | `document` | `asc:search:execute`, `asc:search:complete` |
| Cross-block / service events | `document.body` | `asc:asset:details:open`, `asc:collection:add`, etc. |
| Block-local events | The block's `.block` element | Events that only affect one block instance |

---

## Global Image Fallback

`scripts/asc/core/utils/images.js` exports `setupImageFallback()`, called once from `scripts/asc.js` at module-load time. It installs a capture-phase `error` listener on `document` that replaces broken `<img>` `src` with `/styles/images/image-placeholder.svg` and stamps `data-img-error="1"` to prevent infinite loops.

**Opt-out**: set `data-img-error="1"` on an image element to skip the fallback entirely. This is required for blocks that handle their own image errors (e.g. `details-preview`'s image sub-module) — the block's error handler runs in the bubble phase and would see the placeholder URL instead of the original broken URL if the fallback fires first.

---

## Global Keyboard Activation

`scripts/asc/core/utils/keyboard.js` exports `setupRoleButtonKeyboardSupport()`, called once from `scripts/asc.js` at module-load time (alongside `setupImageFallback()`). It installs one `keydown` listener on `document` that synthesizes a `click` on Enter/Space for any focused `[role="button"][tabindex]`, `[role="row"][tabindex]`, or `[role="gridcell"][tabindex]` element.

Any non-native interactive element (a `<div>`/`<article>` standing in for a button — asset teaser cards, board items, list-view rows) only needs `role="button"` (or `role="row"`/`role="gridcell"` inside an ARIA grid/table) + `tabindex="0"` + its existing `click`-bound handler (`data-asc-action="...@click"` or a plain delegated `click` listener). This bridge makes it keyboard-activatable for free — no per-block keydown wiring needed, and no change to the click handler itself.

---

## CSS Conventions (see `docs/CSS_CONVENTION.md` for full guide)

- Root selector: `.block.<block-name> { ... }` — never a bare class
- CSS nesting for children and modifiers
- **Colors**: use `--color-*` semantic tokens from `styles/styles.css` `:root` (e.g. `--color-primary`, `--color-muted-fg`, `--color-border`). Do not use `--background-color`, `--text-color`, etc. — those are backward-compat aliases for EDS boilerplate only.
- **Spacing, radius, shadow, transitions**: `--spacing-*`, `--border-radius-*`, `--shadow-*`, `--transition-*` from `styles/tokens.css`
- **Typography**: `--body-font-size-s/xs`, `--heading-font-size-s/m/l/xl` — do not use `--font-size-sm` or `--radius-md` (old names, removed)
- Mobile-first: `@media (width >= 768px)` syntax
- Part CSS scoped to `.asc-{part-name}` prefix
- Themes in `styles/themes/` override `--color-*` tokens only — never structural tokens

### Z-Index Scale

All z-index values use tokens from `styles/styles.css`. Never use raw integers for page- or modal-level stacking.

**Two-context rule**: everything on the page lives below 400. Modals and their controls start at 400. No page-level element can ever visually overlay a modal or anything inside it.

#### Page context tokens

| Token | Value | Use for |
|---|---|---|
| `--z-behind` | -1 | Behind siblings — hero backgrounds, absolute image layers |
| `--z-raised` | 1 | Minor stacking boost within a component (e.g. card hover overlay) |
| `--z-sticky` | 100 | Sticky header, sticky toolbars |
| `--z-dropdown` | 200 | Page dropdowns, popovers, tooltip panels |
| `--z-float` | 300 | Toasts, floating action buttons |

#### Modal context tokens

| Token | Value | Use for |
|---|---|---|
| `--z-modal-backdrop` | 400 | Semi-transparent scrim behind the dialog |
| `--z-modal` | 500 | The `<dialog>` / modal container itself |
| `--z-modal-dropdown` | 600 | Dropdowns or panels rendered inside a modal |

#### Rules for block authors

- **Page dropdowns** (filter panels, collection menu, any `.asc-panel` anchored to a trigger): `z-index: var(--z-dropdown)`.
- **Sticky elements** (header, any `position: sticky` bar): `z-index: var(--z-sticky)`. Page dropdowns intentionally sit above the header so they are never clipped by it.
- **Blocks with an internal canvas** (e.g. `board`): add `isolation: isolate` to the block root. This contains the block's internal z-indices so they don't compete with page-level stacking values. Raw integers (10, 50, 200…) are acceptable *within* an isolated stacking context.
- **Modal dropdowns**: any dropdown or popover that opens inside a `<dialog>` must use `--z-modal-dropdown` (600), not `--z-dropdown`. The `<dialog>` element is in the browser top layer, so its children need a z-index relative to the modal's own stacking context.
- **Never** use `--z-modal` or `--z-modal-backdrop` inside a block — those are set by the `details-modal` block and action-page service.
