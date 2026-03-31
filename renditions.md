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
  - label: Types
    items:
      - title: Static (JCR)
        url: "#static"
      - title: URL (Dynamic Media)
        url: "#url"
      - title: Asset Delivery
        url: "#asset-delivery"
---

# Renditions

Renditions are downloadable representations of an asset. Asset Share Commons resolves renditions from AEM based on a declarative array configured in `scripts/configurations.js`.

## Overview {#overview}

When a user clicks **Download** in the details modal or the download sheet, Asset Share Commons walks the `renditions.definitions` array, finds every definition that accepts the current asset, and renders a list of download links.

![Renditions — download options panel](https://placehold.co/860x380/111111/e91e8c?text=Renditions+%E2%80%94+Download+Options+Panel&font=inter)

*details-download block — renders configured renditions for the open asset*

Resolution is done by the `renditions` service (`scripts/asc/services/renditions/renditions.js`). For each definition it:

1. Calls `accepts(asset)` — skips if it returns false
2. Resolves the URL using the definition's `type`
3. Returns a `Rendition` model with the resolved URL

**Same-id fallback:** Multiple definitions may share the same `id`. When resolving by id (e.g. `getRendition(asset, 'thumbnail')`), the service returns the first definition whose `accepts` passes for this asset. This gives you DM-over-static priority and per-MIME-type variants of the same logical rendition — for free, just by ordering.

## Default Renditions {#default-renditions}

Out of the box, Asset Share Commons includes three definitions that work with any standard AEM DAM processing profile:

| ID | Type | Matches | Visible |
|----|------|---------|---------|
| `thumbnail` | Static (JCR) | `/^cq5dam\.thumbnail\./` | No (internal) |
| `web` | Static (JCR) | `/^cq5dam\.web\./` | Yes — images only |
| `original` | Static (JCR) | `original` (exact) | Yes — all types |

## Configuration {#configuration}

`renditions.definitions` is a flat ordered array. Each entry is evaluated top to bottom for each asset.

```js
renditions: {
  definitions: [
    {
      id: 'thumbnail',
      label: 'Thumbnail',
      type: 'static',
      name: /^cq5dam\.thumbnail\./,
      visible: false,
    },
    {
      id: 'web',
      label: 'Web',
      type: 'static',
      name: /^cq5dam\.web\./,
      accepts: (asset) => asset.mimeType?.startsWith('image/'),
    },
    {
      id: 'original',
      label: 'Original',
      type: 'static',
      name: 'original',
    },
  ],
},
```

### Definition properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique key within the array. Multiple definitions may share an id — first match wins per asset. |
| `label` | `string` | Display name shown in the download list |
| `type` | `string` | `'static'` \| `'url'` \| `'asset-delivery'` |
| `accepts` | `(asset) => boolean` | Whether this definition applies to the asset. Omit to match all assets. |
| `visible` | `boolean` | Show in the download list (default: `true`). Set `false` for internal renditions like thumbnails. |
| `description` | `string` | Optional sub-label or tooltip |
| `mimeType` | `string` | Override MIME type hint for the downloaded file |

## accepts {#accepts}

`accepts` is a function that receives the full `Asset` model and returns `true` if the definition should apply. Omit it entirely to match all assets.

```js
// Any image
accepts: (asset) => asset.mimeType?.startsWith('image/'),

// Specific type
accepts: (asset) => asset.mimeType === 'application/pdf',

// Only assets synced to Dynamic Media
accepts: (asset) => !!asset.getProperty('dam:scene7File'),

// Images wider than 2000px
accepts: (asset) => (asset.getProperty('jcr:content/metadata/tiff:ImageWidth') ?? 0) > 2000,

// A specific DAM folder
accepts: (asset) => asset.path?.startsWith('/content/dam/brand/'),
```

**Same id, different accepts — per-type variants:**

```js
definitions: [
  // DM web rendition — preferred when asset has a Scene7 file reference
  {
    id: 'web',
    label: 'Web',
    type: 'url',
    url: (asset) => {
      const server = asset.getProperty('dam:scene7APIServer');
      const file = asset.getProperty('dam:scene7File');
      return server && file ? `${server}is/image/${file}?$web$` : null;
    },
    accepts: (asset) => !!asset.getProperty('dam:scene7File'),
  },
  // Static fallback for non-DM assets
  {
    id: 'web',
    label: 'Web',
    type: 'static',
    name: /^cq5dam\.web\./,
    accepts: (asset) => asset.mimeType?.startsWith('image/'),
  },
],
```

## Excluding Renditions {#exclude}

Use `renditions.exclude` to suppress JCR rendition node names globally — useful for suppressing extra thumbnail sizes generated by processing profiles.

```js
renditions: {
  exclude: [
    'cq5dam.thumbnail.48.48.png',
    /^cq5dam\.thumbnail\.(?:48|96|140)\./,
  ],
  definitions: [ ... ],
},
```

> Exclusions only apply to `type: 'static'` renditions. `url` and `asset-delivery` renditions are unaffected.

---

## Rendition Types {#types}

### Static (JCR) {#static}

Resolves a rendition node from the asset's `jcr:content/renditions/` tree by matching `name` against the node name.

```js
{
  id: 'web',
  label: 'Web (1280px)',
  type: 'static',
  name: /^cq5dam\.web\./,
  accepts: (asset) => asset.mimeType?.startsWith('image/'),
}
```

| Property | Description |
|----------|-------------|
| `name` | `string` (exact match), `RegExp` (pattern match), or `(asset) => string` (dynamic exact match) |

### URL (Dynamic Media) {#url}

`url` is a function that receives the asset and returns the full URL string. Use `asset.getProperty()` to pull Dynamic Media metadata directly — no template variables needed.

```js
{
  id: 'dm-web',
  label: 'Web (DM)',
  type: 'url',
  url: (asset) => {
    const server = asset.getProperty('dam:scene7APIServer');
    const file = asset.getProperty('dam:scene7File');
    return server && file ? `${server}is/image/${file}?$web$` : null;
  },
  accepts: (asset) => !!asset.getProperty('dam:scene7File'),
},

// Smart crop
{
  id: 'dm-crop-small',
  label: 'Smart Crop — Small',
  type: 'url',
  url: (asset) => {
    const server = asset.getProperty('dam:scene7APIServer');
    const file = asset.getProperty('dam:scene7File');
    return server && file ? `${server}is/image/${file}:Small` : null;
  },
  accepts: (asset) => !!asset.getProperty('dam:scene7File'),
},
```

Returning `null` from `url` is safe — the definition is silently skipped.

**Common Dynamic Media properties** (written by the DM sync process):

| `getProperty()` key | Contains |
|---------------------|---------|
| `dam:scene7APIServer` | IS/IR server URL (e.g. `https://s7d1.scene7.com/`) |
| `dam:scene7File` | File path (e.g. `my-company/my-image`) |
| `dam:scene7Name` | Asset name in Scene7 |
| `dam:scene7ID` | Scene7 asset ID |
| `dam:scene7Domain` | Scene7 domain |
| `dam:scene7Folder` | Scene7 folder |

### Asset Delivery {#asset-delivery}

Constructs an AEM Asset Delivery API URL. Covers plain image transforms, smart crops, and named presets — they're all different `params` on the same URL format.

Requires `aem.deliveryHost` in `configurations.js`. AEM as a Cloud Service only.

```js
// Plain transform
{
  id: 'web-optimized',
  label: 'Web Optimized',
  type: 'asset-delivery',
  params: 'format=webp&width=1200&quality=85',
  accepts: (asset) => asset.mimeType?.startsWith('image/'),
},

// Smart crop (crop name must match a DM preset)
{
  id: 'smart-crop-small',
  label: 'Smart Crop — Small',
  type: 'asset-delivery',
  params: 'smartcrop=Small',
  accepts: (asset) => asset.mimeType?.startsWith('image/'),
},

// Named image preset
{
  id: 'dm-preset-web',
  label: 'Web Preset',
  type: 'asset-delivery',
  params: 'imagePreset=web',
  accepts: (asset) => asset.mimeType?.startsWith('image/'),
},
```

| Property | Description |
|----------|-------------|
| `params` | Query string appended to the delivery URL |
| `format` | File extension override (default: asset's own extension) |
