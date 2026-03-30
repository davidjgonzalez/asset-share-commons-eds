# Asset Share Commons — Starter Kit

This starter kit provides ready-to-use content pages for an Asset Share Commons (ASC) EDS project. Each file is a complete HTML document structured for AEM Edge Delivery Services — blocks are represented as nested `<div>` elements that map directly to tables in da.live.

## What Is This?

Asset Share Commons is an EDS front-end for AEM DAM. These pages define the site structure: search with filters, asset detail views, a download sheet, and collections management. You should use this starter kit as a starting point and customise the filter options to match your AEM instance before going live.

## How to Use

### Option 1 — Upload to da.live

Upload each `.html` file directly to your da.live project via the da.live admin UI. EDS will render the blocks automatically from the div structure.

1. Open your da.live project.
2. For each file in this kit, use **File > Upload** or drag-and-drop the `.html` file to the correct path in your content tree.
3. The file paths should match the URLs you want on your site (e.g., `index.html` → `/`, `sheet.html` → `/sheet`).
4. For the `details/` subfolder, upload both files under a `details/` path so the detail templates resolve to `/details/default` and `/details/image`.

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
| `index.html` | `/` | `stub`, `search-statistics`, `search-bar`, `search-property` (x2), `search-path`, `search-date-range`, `search-tags`, `search-results` |
| `details/default.html` | `/details/default` | `details-preview`, `details-property` (x6), `details-download`, `details-actions` |
| `details/image.html` | `/details/image` | Same as default — `details-actions` adds the `share` action |
| `sheet.html` | `/sheet` | `sheet` |
| `collections.html` | `/collections` | `collections` |

## Customising Filter Options

The filter blocks in `index.html` are pre-populated with example values. Before going live, replace these with the correct values for your AEM instance:

- **search-property (File Type)** — replace the `options` values with the MIME types present in your DAM (e.g., `image/tiff`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
- **search-property (Status)** — replace option values with the asset workflow statuses used in your instance (these must match the values stored in `jcr:content/metadata/dam:status`).
- **search-path (Folders)** — replace the DAM paths with the root folders you want to expose for filtering (e.g., `/content/dam/brand`, `/content/dam/campaigns/2025`).
- **search-tags (Tags)** — replace the tag values with real tag IDs from your AEM taxonomy. Tag IDs use the colon-separated path format (e.g., `properties:style/black-and-white`).
- **search-date-range** — the `property` value should point to the JCR property you want to filter by. `dam:assetLastModified` is a sensible default; change it to `jcr:created` or a custom metadata property if needed.

## Configuring the Details Templates

The `assetDetails` service in `scripts/configurations.js` maps MIME type patterns to detail template URLs. By default it will load `/details/default` for all asset types. To use the image-specific template for images, add a mapping such as:

```js
assetDetails: {
  templates: {
    'image/*': '/details/image',
  },
}
```

Refer to `scripts/configurations.js` for the full configuration reference.
