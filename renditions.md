---
layout: page
title: Renditions
permalink: /renditions
sidebar:
  - label: Renditions
    items:
      - title: Overview
        url: "#overview"
      - title: Default Renditions
        url: "#default-renditions"
      - title: Configuration
        url: "#configuration"
      - title: accepts
        url: "#accepts"
      - title: Excluding Renditions
        url: "#exclude"
      - title: Filenames
        url: "#filenames"
  - label: Resolver Types
    items:
      - title: static (JCR)
        url: "#static"
      - title: dm-smartcrop
        url: "#dm-smartcrop"
      - title: url-template
        url: "#url-template"
      - title: url
        url: "#url"
      - title: web-optimized-delivery
        url: "#web-optimized-delivery"
      - title: dm-openapi
        url: "#dm-openapi"
  - label: Thumbnails
    items:
      - title: Search result srcset
        url: "#thumbnails"
---

# Renditions

Renditions are downloadable representations of an asset. Asset Share Commons resolves renditions from AEM through a **resolver registry** — a declarative array configured in `scripts/asc/configurations.js`. This is the client-side equivalent of ASC v1's `AssetRenditionDispatcher` OSGi configurations.

## Overview {#overview}

When a user opens `details-renditions` or triggers a download, ASC walks the `renditions.definitions` array, finds every definition that accepts the current asset, and resolves each through the matching **resolver type**.

![Renditions — download options panel](https://placehold.co/860x380/111111/e91e8c?text=Renditions+%E2%80%94+Download+Options+Panel&font=inter)

*details-renditions block — renders configured renditions for the open asset*

Resolution is done by the `renditions` service (`scripts/asc/core/services/renditions/renditions.js`). For each definition it:

1. Calls `accepts(asset)` — skips if it returns false
2. Resolves the rendition through the type's resolver (JCR node lookup, URL template, or function)
3. Returns a `Rendition` model with the resolved URL, and — for node-backed types — auto-detects any additional renditions present on the asset that weren't explicitly configured

**Same-id fallback:** Multiple definitions may share the same `id`. When resolving by id (e.g. `getRendition(asset, 'web')`), the service returns the first definition whose `accepts` passes for this asset — DM-over-static priority and per-MIME-type variants of the same logical rendition, for free, just by ordering.

## Default Renditions {#default-renditions}

Out of the box, Asset Share Commons ships definitions that work with any standard AEM DAM processing profile, plus classic Dynamic Media smart crops:

| ID | Type | Matches | Visible |
|----|------|---------|---------|
| `original` | `static` | `original` (exact) | Yes — all types |
| `web` | `static` | `cq5dam.web.1280.1280` | Yes — images only |
| `smart-crop-small` / `smart-crop-medium` | `dm-smartcrop` | Auto-detected JCR smart crop nodes | Yes — images only |

## Configuration {#configuration}

`renditions.definitions` is a flat ordered array. Each entry is evaluated top to bottom for each asset.

```js
renditions: {
  definitions: [
    { id: 'original', label: 'Original', type: 'static', name: 'original' },
    {
      id: 'web',
      label: 'Web (1280px)',
      type: 'static',
      name: 'cq5dam.web.1280.1280',
      accepts: (asset) => asset.mimeType?.startsWith('image/'),
    },
    {
      id: 'smart-crop-small',
      label: 'Smart Crop — Small',
      type: 'dm-smartcrop',
      accepts: (asset) => asset.mimeType?.startsWith('image/'),
    },
  ],
},
```

### Definition properties

| Property | Type | Description |
|----------|------|--------------|
| `id` | `string` | Unique key within the array. Multiple definitions may share an id — first accepted match wins per asset. |
| `label` | `string` | Display name shown in the download list |
| `type` | `string` | `'static'` \| `'dm-smartcrop'` \| `'url-template'` \| `'url'` \| `'web-optimized-delivery'` \| `'dm-openapi'` |
| `accepts` | `(asset) => boolean` | Whether this definition applies to the asset. Omit to match all assets. |
| `visible` | `boolean` | Show in the download list (default: `true`). Set `false` for internal renditions like thumbnails. |
| `description` | `string` | Optional sub-label or tooltip |
| `mimeType` | `string` | Override MIME type hint for the downloaded file |
| `fileType` | `string` | Human-readable format label shown in the `file-type` column (e.g. `'JPEG'`, `'WebP 1200px'`). Defaults to a label derived from `mimeType`. |
| `usecase` | `string` | Destination-specific label (e.g. `'Instagram Post / Profile Image (1:1)'`, `'Email / Blog Inline (4:3)'`), shown in place of the generic format/size meta line wherever a rendition is picked: the `details-renditions` table/card display and the shared rendition-picker popover ([search-results](#search-results), [board](#board) cards). Falls back to the technical format description when unset. |
| `filename` | `string \| (rendition, asset) => string` | Override the download filename — see [Filenames](#filenames) |

## accepts {#accepts}

`accepts` is a function that receives the full `Asset` model and returns `true` if the definition should apply. Omit it entirely to match all assets.

```js
// Any image
accepts: (asset) => asset.mimeType?.startsWith('image/'),

// Only assets synced to classic Dynamic Media
accepts: (asset) => !!asset.getProperty('dam:scene7File').data,

// A specific DAM folder
accepts: (asset) => asset.path?.startsWith('/content/dam/brand/'),
```

## Excluding Renditions {#exclude}

Use `renditions.exclude` to suppress JCR rendition node names globally — useful for suppressing thumbnail/template nodes generated by processing profiles that should never show up anywhere (including internal auto-detection).

```js
renditions: {
  exclude: [
    /^cq5dam\.thumbnail\./,   // cq5dam.thumbnail.48.48.png, etc.
    /^cqdam\..+\.json$/,      // cqdam.text.json, cqdam.metadata.json
    'cqdam.metadata.xml',
    'Swatch',
  ],
  definitions: [ /* ... */ ],
},
```

> Exclusions only apply to `type: 'static'` and node-scanning resolvers. `url`, `url-template`, `web-optimized-delivery`, and `dm-openapi` renditions are unaffected — they're constructed, not scanned.

---

## Resolver Types

Six built-in resolver types cover the three distinct DM delivery patterns plus plain static/custom URLs:

| | Classic DM (Scene7 / IS-IR) | Web-optimized delivery | DM with OpenAPI |
|---|---|---|---|
| **AEM version** | AEM 6.5 or AEMaaCS + classic DM | AEMaaCS publish | AEMaaCS + DM OpenAPI enabled |
| **Rendition type** | `dm-smartcrop`, `url-template`, or `url` | `web-optimized-delivery` | `dm-openapi` |
| **URL prefix** | `{dam:scene7Domain}/is/image/` | `{host}/adobe/dynamicmedia/deliver/dm-aid--{uuid}/` | `{deliveryHost}/adobe/dynamicmedia/deliver/{uuid}/` |
| **Asset identifier** | `dam:scene7File` metadata | UUID (with `dm-aid--` prefix) | UUID |
| **Requires DM OpenAPI** | No | No | Yes |
| **Smart crop / presets** | `:CropName` / `?$preset$` | No | `?smartcrop=Name` / `?imagePreset=name` |

> **`dam:scene7Domain` vs `dam:scene7APIServer`** — `dam:scene7Domain` is the IS/IR delivery CDN host used in image URLs (e.g. `https://s7d1.scene7.com/`). `dam:scene7APIServer` is the Scene7 management API endpoint — **not** used for delivery. Use `${dm.domain}` in `url-template` strings for IS/IR URLs.

### static (JCR) {#static}

Resolves a rendition node from the asset's `jcr:content/renditions/` tree by matching `name` against the node name. Works on any AEM instance.

```js
{
  id: 'web',
  label: 'Web (1280px)',
  type: 'static',
  name: 'cq5dam.web.1280.1280',       // string (exact), RegExp, or (asset) => string
  accepts: (asset) => asset.mimeType?.startsWith('image/'),
}
```

### dm-smartcrop {#dm-smartcrop}

Classic Dynamic Media (Scene7) smart crop via the IS protocol: `{dam:scene7APIServer}is/image/{dam:scene7File}:{id}`. The definition's `id` must exactly match the smart-crop name registered in DM (case-sensitive, e.g. `"Small"`, `"Medium"`, `"Large"`).

```js
{ id: 'Large', label: 'Smart Crop — Large', type: 'dm-smartcrop', accepts: (asset) => asset.mimeType?.startsWith('image/') },
```

Smart crops present on the asset but **not listed here are auto-detected and appended automatically** (`autoDetect: true` behavior, built in). Add an explicit definition only when you need a custom label, an `accepts` guard on a specific crop, or a `usecase`. Smart crops are the most common place to reach for `usecase`, since the crop name (`Small`/`Medium`/`Large`) says nothing about where it's actually meant to go:

```js
{ id: 'Small',  label: 'Square',     usecase: 'Instagram Post / Profile Image (1:1)',   type: 'dm-smartcrop', accepts: (asset) => asset.mimeType?.startsWith('image/') },
{ id: 'Medium', label: 'Standard',   usecase: 'Email / Blog Inline (4:3)',              type: 'dm-smartcrop', accepts: (asset) => asset.mimeType?.startsWith('image/') },
{ id: 'Large',  label: 'Widescreen', usecase: 'Web Banner / Twitter Post (16:9)',       type: 'dm-smartcrop', accepts: (asset) => asset.mimeType?.startsWith('image/') },
```

### url-template {#url-template}

Declarative `${variable}` token string — the preferred way to build Dynamic Media / Scene7 IS/IR URLs without a JS function. Resolves to `null` automatically if any referenced token has no value on the asset, so an `accepts` guard is optional.

```js
{
  id: 'dm-web-preset',
  label: 'Web Preset',
  type: 'url-template',
  template: '${dm.domain}is/image/${dm.file}?$web$',
}
```

| Token | Resolves to | JCR metadata path |
|-------|-------------|--------------------|
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

### url {#url}

Arbitrary JS function — use when `url-template` tokens aren't enough.

```js
{
  id: 'dm-grayscale',
  label: 'Grayscale',
  type: 'url',
  url: (asset) => {
    const server = asset.getProperty('dam:scene7APIServer').data;
    const file = asset.getProperty('dam:scene7File').data;
    return server && file ? `${server}is/image/${file}?$grayscale$` : null;
  },
}
```

Returning `null` from `url` is safe — the definition is silently skipped.

### web-optimized-delivery {#web-optimized-delivery}

Web-optimized delivery on AEM as a Cloud Service publish — works **without** requiring the full DM OpenAPI entitlement. URL prefix uses `dm-aid--{uuid}`.

```js
{
  id: 'web-optimized',
  label: 'Web Optimized',
  type: 'web-optimized-delivery',
  params: 'format=webp&width=1200&quality=85',
  accepts: (asset) => asset.mimeType?.startsWith('image/'),
}
```

Uses `aem.deliveryHost` when set, falls back to `aem.host`.

### dm-openapi {#dm-openapi}

Dynamic Media with OpenAPI / AEM Asset Delivery. Requires `aem.deliveryHost` and the DM OpenAPI entitlement. Covers plain transforms, smart crops, and named presets — they're all different `params` on the same URL format.

```js
// Plain transform
{ id: 'web-optimized', label: 'Web Optimized', type: 'dm-openapi',
  params: 'format=webp&preferwebp=true&width=1200&quality=85',
  accepts: (asset) => asset.mimeType?.startsWith('image/') },

// Smart crop (crop name must match a DM preset)
{ id: 'smart-crop-small', label: 'Smart Crop — Small', type: 'dm-openapi',
  params: 'smartcrop=Small', accepts: (asset) => asset.mimeType?.startsWith('image/') },

// Named image preset
{ id: 'dm-preset-web', label: 'Web Preset', type: 'dm-openapi',
  params: 'imagePreset=web', accepts: (asset) => asset.mimeType?.startsWith('image/') },
```

| Property | Description |
|----------|--------------|
| `params` | Query string appended to the delivery URL |
| `format` | File extension override (default: asset's own extension) |

### Custom resolvers

Register a new type, or override a built-in one, by keying on the type string:

```js
renditions: {
  resolvers: {
    'my-type': {
      fromDefinition(def, asset, aemConfig) { /* return new Rendition({...}) or null */ },
      // Optional — for JCR node-scanning types:
      autoDetect: true,
      acceptsNode(name, node) { return false; },
      fromNode(name, node, asset, aemConfig) { /* return new Rendition({...}) or null */ },
    },
  },
},
```

---

## Service API

```js
import services from '../../scripts/asc/core/services/services.js';

services.renditions.getRenditions(asset);            // definitions + auto-detected node renditions
services.renditions.getRendition(asset, 'web');       // single rendition by id
services.renditions.resolveAllNodes(asset);           // every JCR node through all resolvers
services.renditions.getThumbnailUrl(asset);           // best thumbnail URL (with fallback)
services.renditions.getThumbnailSrcset(asset);        // Rendition[] sorted by size.width, for <img srcset>
services.renditions.getRenditionDefinition('web');    // raw definition object (no asset needed)
```

## Filenames {#filenames}

Each resolver sets a `filename` on the `Rendition` it constructs; `details-renditions` uses it verbatim when present and falls back to a generic pattern otherwise.

| Type | Filename pattern | Example |
|------|-------------------|---------|
| `dm-smartcrop` | `{asset-stem}-smart-crop-{cropName}.jpg` | `hero-banner-smart-crop-Large.jpg` |
| `static` / `url` / `url-template` / `dm-openapi` | `{asset-stem}-{id}.{ext}` | `hero-banner-web.jpg` |
| `static` with a JCR node name as id | Extension stripped: `{asset-stem}-{node-base}.{ext}` | `hero-banner-cq5dam.fpo.png` |
| `original` | `{asset-stem}.{ext}` (no suffix) | `hero-banner.jpg` |

**Definition-level override** — add `filename` to any definition. A plain string is used as-is; a function receives `(rendition, asset)` and returns a string. Applied last, after the resolver runs, so `rendition` already has its `url`, `mimeType`, etc.

```js
// Plain string
{ id: 'fpo', label: 'FPO', type: 'static', name: 'cq5dam.fpo', filename: 'fpo-placeholder.png' }

// Function — full access to rendition and asset
{
  id: 'web', label: 'Web', type: 'static', name: 'cq5dam.web.1280.1280',
  filename: (rendition, asset) => {
    const stem = asset.filename?.replace(/\.[^.]+$/, '') ?? asset.title;
    return `${stem}-web-optimized.jpg`;
  },
}
```

### File size — lazy HEAD fetch

Static renditions get `fileSize` from JCR metadata for free. Dynamically generated renditions (`dm-smartcrop`, `url`, `url-template`, `web-optimized-delivery`, `dm-openapi`) don't have a known size until the URL is requested — `details-renditions` fires a `HEAD` request for any rendition missing `fileSize` after render, reads `Content-Length`, and updates the cell in place. If the server returns no `Content-Length` (chunked transfer, an un-generated Scene7 crop), the cell stays blank — no error thrown.

---

## Thumbnails — search result srcset {#thumbnails}

Put thumbnail renditions in a **separate `thumbnails` array** (not `definitions`). Entries here are never shown in the download list — they exist solely to generate the `<img srcset>` on asset teasers (cards, masonry, list, board cards, collection mosaics). Each entry needs `size.width` so the browser gets a correct `Nw` descriptor.

```js
renditions: {
  thumbnails: [
    { type: 'web-optimized-delivery', size: { width: 100  }, params: 'width=100&preferwebp=true&quality=85',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 320  }, params: 'width=320&preferwebp=true&quality=85',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 640  }, params: 'width=640&preferwebp=true&quality=80',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
    { type: 'web-optimized-delivery', size: { width: 1280 }, params: 'width=1280&preferwebp=true&quality=70', accepts: (asset) => asset.mimeType?.startsWith('image/') },
  ],
  definitions: [ /* downloadable renditions — see above */ ],
},
```

Use `web-optimized-delivery` for thumbnails — it works on any AEMaaCS publish instance without requiring DM OpenAPI. Reserve `dm-openapi` for `definitions` (downloadable renditions).

`services.renditions.getThumbnailSrcset(asset)` resolves URLs for the asset and returns them sorted smallest to largest. `getThumbnailUrl(asset)` picks the mid-size entry as the `src` fallback. Non-image assets, or when every `thumbnails` entry has an image-only `accepts`, fall back to the static `cq5dam.thumbnail` node URL.

### Asset Model — computed rendition properties

```js
// CSS aspect-ratio string for the most-portrait rendition across all renditions + the
// asset's own dimensions. Use as the initial preview container AR so every rendition
// displays without clipping — falls back to "4 / 3" when no dimension metadata exists.
asset.renditionsBoundingAspectRatio   // → e.g. "1280 / 960" or "4 / 3"

block.style.setProperty('--preview-ar', asset.renditionsBoundingAspectRatio);

// Snap to actual image dimensions after load (eliminates bars for exact matches)
img.addEventListener('load', () => {
  if (img.naturalWidth && img.naturalHeight) {
    container.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
  }
}, { once: true });
```
