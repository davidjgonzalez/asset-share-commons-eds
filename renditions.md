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
      - title: Excluding Renditions
        url: "#exclude"
      - title: Rendition Types
        url: "#types"
  - label: Types
    items:
      - title: Static (JCR)
        url: "#static"
      - title: Web Optimized
        url: "#web-optimized"
      - title: Dynamic Media
        url: "#dynamic-media"
      - title: Asset Delivery
        url: "#asset-delivery"
      - title: Custom
        url: "#custom"
---

# Renditions

Renditions are downloadable representations of an asset. Asset Share Commons resolves renditions from AEM based on declarative configuration in `scripts/configurations.js`.

## Overview {#overview}

When a user clicks **Download** in the details modal or the download sheet, Asset Share Commons looks up the rendition definitions for that asset's MIME type and renders a list of download links.

![Renditions — download options panel](https://placehold.co/860x380/111111/e91e8c?text=Renditions+%E2%80%94+Download+Options+Panel&font=inter)

*details-download block — renders configured renditions for the open asset*

Rendition resolution is done by the `renditions` service (`scripts/asc/services/renditions.js`). It takes:

1. A `Rendition` definition from `configurations.renditions`
2. An `Asset` model instance

And returns a resolved URL the browser can download directly.

## Default Renditions {#default-renditions}

Out of the box, Asset Share Commons resolves three renditions for all asset types:

| Name | Type | Description |
|------|------|-------------|
| `thumbnail` | Static (JCR) | `cq5dam.thumbnail.48.48.png` |
| `web` | Static (JCR) | `cq5dam.web.1280.1280.jpeg` |
| `original` | Static (JCR) | The original uploaded binary |

## Configuration {#configuration}

Renditions are configured per MIME type pattern in `configurations.js`:

```js
renditions: {
  definitions: {
    'image/*': [
      {
        name: 'thumbnail',
        label: 'Thumbnail (48×48)',
        type: 'static',
        renditionName: 'cq5dam.thumbnail.48.48.png',
      },
      {
        name: 'web',
        label: 'Web (1280px)',
        type: 'static',
        renditionName: 'cq5dam.web.1280.1280.jpeg',
      },
      {
        name: 'original',
        label: 'Original',
        type: 'original',
      },
    ],
    'video/*': [
      {
        name: 'original',
        label: 'Original Video',
        type: 'original',
      },
    ],
    default: [
      {
        name: 'original',
        label: 'Original',
        type: 'original',
      },
    ],
  },
},
```

MIME type keys support wildcards (`image/*`) and exact types (`application/pdf`). Asset Share Commons picks the most specific match — if none is found, `default` is used.

## Excluding Renditions {#exclude}

Use `renditions.exclude` to suppress specific AEM rendition node names globally — without needing to add `visible: false` to every definition. Accepts exact strings or RegExps matched against the JCR rendition node name.

```js
renditions: {
  exclude: [
    'cq5dam.thumbnail.48.48.png',
    'cq5dam.thumbnail.140.100.png',
    /^cq5dam\.thumbnail\.(?:48|96|140)\./,
  ],
  definitions: [ ... ],
},
```

> Exclusions only apply to `type: 'static'` renditions matched by JCR node name. `url` and `asset-delivery` renditions are unaffected.

**Dynamic Media priority over static:** List Dynamic Media (`type: 'url'`) definitions before static ones in the `definitions` array. The first matching definition wins. Combine with `exclude` to suppress the static fallback entirely:

```js
definitions: [
  {
    id: 'web',
    label: 'Web (DM)',
    type: 'url',
    url: '${dm.apiServer}is/image/${dm.file}?$web_crop$',
    accepts: 'image/*',
  },
  {
    id: 'web-static',
    label: 'Web',
    type: 'static',
    name: /^cq5dam\.web\./,
    accepts: 'image/*',
  },
],
exclude: [/^cq5dam\.thumbnail\./],
```

---

## Rendition Types {#types}

### Static (JCR) {#static}

Resolves a named rendition from the asset's JCR `jcr:content/renditions/` node.

```js
{
  name: 'web',
  label: 'Web (1280px)',
  type: 'static',
  renditionName: 'cq5dam.web.1280.1280.jpeg',
}
```

| Property | Description |
|----------|-------------|
| `renditionName` | Exact name of the JCR rendition child node |

### Web Optimized {#web-optimized}

Uses AEM's Web Optimized Image Delivery API to serve a resized/formatted rendition on the fly.

```js
{
  name: 'web-optimized-2x',
  label: 'Retina (2560px)',
  type: 'web-optimized',
  width: 2560,
  format: 'webp',
  quality: 85,
}
```

| Property | Default | Description |
|----------|---------|-------------|
| `width` | — | Output width in pixels |
| `format` | `webp` | `webp` \| `jpeg` \| `png` |
| `quality` | `85` | Compression quality (1–100) |

### Dynamic Media {#dynamic-media}

Generates a Dynamic Media rendition URL using a named preset or raw parameters.

```js
{
  name: 'dm-medium',
  label: 'DM Medium (800px)',
  type: 'dynamic-media',
  preset: 'Medium_Size_Asset',
}
```

| Property | Description |
|----------|-------------|
| `preset` | DM Image Preset name |
| `params` | Raw DM URL parameters string (alternative to preset) |

### Asset Delivery {#asset-delivery}

Uses the AEM as a Cloud Service Asset Delivery API (requires `aem.deliveryHost` in config).

```js
{
  name: 'delivery-original',
  label: 'Asset Delivery (Original)',
  type: 'asset-delivery',
  format: 'original',
}
```

| Property | Description |
|----------|-------------|
| `format` | `original` \| `webp` \| `jpeg` \| `png` |
| `width` | Output width |
| `quality` | Quality (1–100) |

### Custom {#custom}

Full control — provide a function that takes an `Asset` and returns a URL string.

```js
{
  name: 'cdn-optimized',
  label: 'CDN Optimized',
  type: 'custom',
  resolve: (asset) => {
    const uuid = asset.getProperty('jcr:uuid');
    return `https://cdn.example.com/assets/${uuid}/web.jpg`;
  },
}
```

| Property | Description |
|----------|-------------|
| `resolve` | `(asset: Asset) => string` — returns the download URL |
