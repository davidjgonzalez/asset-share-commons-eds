# Asset Share Commons — Starter Kit

This starter kit provides ready-to-use content pages for an Asset Share Commons (ASC) EDS project. Each file is a complete HTML document structured for AEM Edge Delivery Services — blocks are represented as nested `<div>` elements that map directly to tables in da.live.

## What Is This?

Asset Share Commons is an EDS front-end for AEM DAM. These pages define the site structure: search with filters, asset detail views, a download sheet, and collections management. You should use this starter kit as a starting point and customise the filter options to match your AEM instance before going live.

## How to Use

### Option 1 — Upload to da.live

Upload each `.html` file directly to your da.live project via the da.live admin UI. EDS will render the blocks automatically from the div structure.

1. Open your da.live project.
2. For each file in this kit, use **File > Upload** or drag-and-drop the `.html` file to the correct path in your content tree.
3. The file paths should match the URLs you want on your site (e.g., `search.html` → `/search`, `sheet.html` → `/sheet`).
4. For the `details/` subfolder, upload files under a `details/` path. Name the default template `index` so it is served at the clean URL `/details`. Custom templates use their own name, e.g. `/details/image`.

### Option 2 — Recreate manually in da.live

Open a new document in da.live and insert blocks as tables. Each block in the HTML corresponds to one table:

- The block name is the first row of the table (e.g., `Search Bar`).
- Config rows follow — each row has the config key in the left cell and the value in the right cell.
- Zero-config blocks are a single-row table with just the block name and no config rows.

Use the HTML comments in each file as a guide to the table structure.

## Pages and Blocks

| File | URL path | Blocks used |
|------|----------|-------------|
| `nav.html` | `/nav` | Semantic `<nav>` (no blocks) |
| `footer.html` | `/footer` | Semantic `<footer>` (no blocks) |
| `search.html` | `/search` | `stub`, `search-statistics`, `search-bar`, `search-property` (x2), `search-path`, `search-date-range`, `search-tags`, `search-results` |
| `details/index.html` | `/details` | `details-preview`, `details-property` (x6), `details-renditions`, `details-actions` |
| `details/image.html` | `/details/image` | Same as default — `details-actions` adds the `share` action |
| `sheet.html` | `/sheet` | `sheet` |
| `collections.html` | `/collections` | `collections` |
| `index.html` | `/` | `teaser` (x9), `hero` |
| `collections/press-kit.html` | `/collections/press-kit` | `board` (`source: authored`) (an "authored-list" published collection) |

## Published Collections vs. Personal Collections

`collections.html` (`/collections`) is a visitor's own private, ad hoc collections —
built in their browser, never discoverable by anyone else. A **published**
collection is different: something you curate once, that has a permanent,
linkable URL, and that any visitor can browse without having built it themselves
(e.g. "Spring 2026 Campaign", "Press Kit"). `index.html` (`/`) is a curated
directory of these — add one `teaser` block per published collection you
create (see `blocks/teaser/teaser.js` for the full authoring/resolution
contract).

There are two ways to feature a reusable asset set, and neither needs a new
collection to be created in browser storage. `index.html` (`/`) places several
`teaser` blocks with ordinary content (a heading, copy, a `hero` banner, a
button) authored in between — a homepage isn't limited to a single directory
section, and the one featured share doesn't have to be authored first; it's
just whichever teaser is named `Teaser (Hero)` (see the block's own header
comment — the variant lives in the block name, not a config row). The rest
of a section's `teaser` blocks auto-arrange into a grid via that section's
own `style: grid` metadata (see `docs/GRID_LAYOUT.md` /
`styles/sections.css`) — no block-level row limit or
config to juggle:

- **Live search link** — link the directory row directly to `/search` with query
  parameters, as the Spring 2026 starter row does. It stays current as matching
  assets are added without introducing page-local hidden predicates.
- **Authored list** (`collections/press-kit.html`) — defined by a fixed set of
  asset ids authored directly on the page (`board` block, `source: authored`),
  for when you want exactly these items and nothing else. Always read-only —
  edit the page's authored list to change what's in it.

## Branded vs. Standalone Shares (Chrome)

Any share/sheet/board page can render two ways: **branded** (with the site's
own header, footer, search, and collections navigation — the visitor is
still "inside" the wider asset library) or **standalone** (none of that — the
page reads as its own discrete microsite, with no way to wander back into the
rest of the site via the UI). See `scripts/asc/chrome.js` for the resolution
logic. This is a presentational choice, not an access-control one — it hides
navigation, not AEM/DAM permissions.

- **Ad hoc personal shares** (the `?sheet=` links generated from the "Share"
  dialog, `blocks/action-share`) default to standalone — that's always been
  the behavior for these links. The dialog's "Share as a standalone page"
  switch makes this an explicit per-share choice (`&chrome=none` / `&chrome=full`
  on the generated URL) rather than an implicit rule.
- **Fixed/authored shares** (a page like `collections/press-kit.html`) default
  to branded. Add `<meta name="chrome" content="none">` to the page's `<head>`
  to opt that one page into standalone mode (see `collections/press-kit.html`
  for an example — a press kit is a natural fit, since external media
  shouldn't need to navigate the rest of the internal library).
- **`?chrome=full` / `?chrome=none`** on any URL overrides both of the above,
  for one-off preview regardless of the page's default.
- Every standalone page gets one small floating link (bottom-right) to flip
  to the other mode — nothing is a dead end.

If you add your own "back to search" / "back to shares" style link to a share
page's authored content, tag it `data-asc-nav-link` (see the examples in
`sheet.html` and `collections/press-kit.html`) so it's hidden along with
the header/footer in standalone mode — otherwise it'd be the one way back
into the site a standalone page isn't supposed to have.

## Customising Filter Options

The filter blocks in `search.html` are pre-populated with example values. Before going live, replace these with the correct values for your AEM instance:

- **search-property (File Type)** — replace the `options` values with the MIME types present in your DAM (e.g., `image/tiff`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
- **search-property (Status)** — replace option values with the asset workflow statuses used in your instance (these must match the values stored in `jcr:content/metadata/dam:status`).
- **search-path (Folders)** — replace the DAM paths with the root folders you want to expose for filtering (e.g., `/content/dam/brand`, `/content/dam/campaigns/2025`).
- **search-tags (Tags)** — replace the tag values with real tag IDs from your AEM taxonomy. Tag IDs use the colon-separated path format (e.g., `properties:style/black-and-white`).
- **search-date-range** — the `property` value should point to the JCR property you want to filter by. `dam:assetLastModified` is a sensible default; change it to `jcr:created` or a custom metadata property if needed.

## Configuring the Details Templates

The `assetDetails` service in `scripts/asc/configurations.js` maps MIME type patterns to detail template URLs. By default it loads `/details` (authored as `details/index` in da.live) for all asset types. To use the image-specific template for images, add a mapping such as:

```js
assetDetails: {
  templates: {
    'image/*': '/details/image',
  },
}
```

Refer to `scripts/asc/configurations.js` for the full configuration reference.
