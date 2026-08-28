---
layout: page
title: Quick Start
permalink: /quickstart
sidebar:
  - label: Setup
    items:
      - title: Prerequisites
        url: "#prerequisites"
      - title: 1. Fork & Connect
        url: "#step-1"
      - title: 2. Create Workspace
        url: "#step-2"
      - title: 3. Author Content
        url: "#step-3"
      - title: 4. Configure AEM
        url: "#step-4"
      - title: 5. Run Locally
        url: "#step-5"
      - title: 6. Verify
        url: "#step-6"
      - title: 7. Deploy
        url: "#step-7"
  - label: Next Steps
    items:
      - title: Apply a Theme
        url: "#themes"
      - title: Search Result Columns
        url: "#custom-properties"
      - title: Custom Properties
        url: "#custom-property-handlers"
---

# Quick Start

Get Asset Share Commons running locally in about 15 minutes. You need an AEM instance (AEM as a Cloud Service, AEM 6.5 SP15+, or the AEM SDK) with accessible DAM assets.

> **TL;DR** — Fork the repo → install AEM Code Sync → point `fstab.yaml` at your da.live workspace → author pages → set `aem.host` in `configurations.js` → run `aem up`.

![Quick Start flow overview](https://placehold.co/860x440/111111/e91e8c?text=Quick+Start+Flow+Overview&font=inter)

*High-level setup flow: fork → connect → author → configure → run*

## Prerequisites {#prerequisites}

- Node.js 18+
- An AEM instance (AEM 6.5 SP15+, AEM SDK, or AEM as a Cloud Service) with assets in DAM
- A GitHub account (for the code repository)
- A [da.live](https://da.live){:target="_blank"} account (for content authoring)
- The [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync){:target="_blank"}
- AEM CLI: `npm install -g @adobe/aem-cli`

## Step 1 — Fork & Install AEM Code Sync {#step-1}

1. Fork [**davidjgonzalez/asset-share-commons-eds**](https://github.com/davidjgonzalez/asset-share-commons-eds){:target="_blank"} to your GitHub account.
2. Install the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync){:target="_blank"} and grant it access to your forked repository. This app watches your `main` branch and syncs code to the AEM CDN automatically on every push — no build step.
3. Clone the fork locally:

```bash
git clone https://github.com/YOUR-USERNAME/asset-share-commons-eds.git
cd asset-share-commons-eds
npm install   # installs lint tooling only — nothing to build
```

## Step 2 — Create a da.live Workspace {#step-2}

1. Go to [da.live](https://da.live){:target="_blank"} and sign in with your Adobe ID.
2. Create a new project using the **same org and repo name as your GitHub fork** — e.g. if your fork is `github.com/acme/asset-share-commons-eds`, your da.live project should live at `content.da.live/acme/asset-share-commons-eds/`. da.live is where you author and publish content (pages, navigation, footer); code lives in GitHub.
3. Update `fstab.yaml` in the repo root to point at your workspace, then commit and push:

```yaml
# fstab.yaml
mountpoints:
  /:
    url: https://content.da.live/YOUR-ORG/asset-share-commons-eds/
    type: markup
folders:
  /details: /details/default
```

> **No Google Drive / SharePoint mount needed** — this project uses da.live's own `type: markup` content source, so content is authored and stored directly in da.live. The `folders` entry aliases `/details` to a `details/default` page so unmapped MIME types fall through to it.

## Step 3 — Author Content in da.live {#step-3}

Each page is a document in your da.live workspace. Blocks are authored as tables — the first row is the block name, subsequent rows are configuration key/value pairs.

The **[starter kit](https://github.com/davidjgonzalez/asset-share-commons-eds/tree/main/docs/starter-kit){:target="_blank"}** in `docs/starter-kit/` contains ready-to-import HTML files for every page type. Import them into da.live to get going immediately — see `docs/starter-kit/README.md` for upload instructions and how to customize the filter options for your DAM taxonomy.

#### Starter kit pages

| File | Purpose | URL path |
|------|---------|----------|
| `nav.html` | Site navigation (brand / links / tools — 3 sections) | `/nav` |
| `footer.html` | Site footer | `/footer` |
| `index.html` | Search page — `search-bar`, filters, `search-results` | `/` |
| `details/index.html` | Default asset details template | `/details` |
| `details/image.html` | Image-specific details template (adds the `share` action) | `/details/image` |
| `collections.html` | Collections index/management page | `/collections` |
| `collection.html` | Single collection page — `collection-controls` + `board` | `/collections/collection` |
| `sheet.html` | Shared sheet page — `sheet-controls` + `board` | `/sheets/` |

## Step 4 — Configure AEM Connection {#step-4}

Open `scripts/asc/configurations.js` — the only file you need to edit — and set your AEM host:

```js
// scripts/asc/configurations.js

const configurations = {
  aem: {
    // Your AEM author or publish host.
    host: 'https://publish-pXXXX-eYYYY.adobeaemcloud.com',

    // AEM Asset Delivery host (AEM as a Cloud Service only) — required for
    // renditions of type 'dm-openapi'. Falls back to aem.host if unset.
    // deliveryHost: 'https://delivery-pXXXX-eYYYY.adobeaemcloud.com',
  },

  search: {
    provider: 'querybuilder',   // 'querybuilder' (default) or 'openapi'
  },

  assetDetails: {
    // Route to a details fragment by MIME type. Return null/undefined to fall
    // back to '/details'.
    templates: (asset) => {
      if (asset.mimeType?.startsWith('image/')) return '/details/image';
      if (asset.mimeType?.startsWith('video/')) return '/details/video';
      return '/details';
    },
  },

  theme: {
    default: 'default',  // 'default' | 'dark' | 'studio'
  },
};

export default configurations;
```

## Step 5 — Run Locally {#step-5}

```bash
aem up    # starts the local dev proxy at http://localhost:3000
```

The AEM CLI proxy fetches content from your da.live workspace and serves JS/CSS from your local filesystem — so code changes are instant, no rebuild or redeploy needed.

> **CORS on localhost** — AEM may block requests from `localhost:3000`. Add it to the AEM Dispatcher or Publish CORS configuration, or use an AEM author instance which typically has more permissive CORS settings.

## Step 6 — Verify {#step-6}

Open `http://localhost:3000` and check:

- Search bar renders and accepts input
- Typing a query returns assets from your AEM DAM
- Clicking an asset opens the details modal
- URL updates to `?asset={uuid}`
- `details-renditions` lists the asset's renditions
- Adding an asset to a collection updates the `collection-switcher` / `stub` badge count

![Asset Share Commons running locally](https://placehold.co/860x480/111111/9333ea?text=Asset+Share+Commons+Running+Locally&font=inter)

*Asset Share Commons running at localhost:3000*

## Step 7 — Deploy {#step-7}

```bash
git push origin main
```

AEM Code Sync picks up the push automatically and deploys to your preview (`main--{repo}--{owner}.aem.page`) and live (`main--{repo}--{owner}.aem.live`) environments within seconds. To publish content, use the da.live sidebar — open any page and click **Publish**.

---

## Apply a Theme {#themes}

Change the `theme.default` value in `configurations.js`:

```js
theme: {
  default: 'studio',   // 'default' (Violet Studio) | 'dark' (Deep Ocean) | 'studio' (Unsplash)
}
```

To create your own theme, copy `styles/themes/dark.css` and override the `--color-*` semantic tokens. See the [Theming guide](/theming) for the full token reference.

## Search Result Columns {#custom-properties}

Control which properties appear in each search result view via `searchResults.views`:

```js
// configurations.js
searchResults: {
  views: {
    // Cards view — ordered list of property names
    cards: ['thumbnail', 'title', 'file-type', 'dimensions', 'file-size'],

    // Masonry view — keep it minimal; meta overlays on hover
    masonry: ['thumbnail', 'title'],

    // List view — property + column layout hints
    list: [
      { property: 'thumbnail', width: '48px' },
      { property: 'title',     width: '1fr'  },
      { property: 'file-type', width: '120px' },
      { property: 'file-size', width: '90px' },
      { property: 'modified',  width: '120px' },
    ],
  },
},
```

Built-in property names: `thumbnail`, `title`, `file-type`, `file-size`, `file-extension`, `dimensions`, `width`, `height`, `mime-type`, `modified`, `created`, `description`, `filename` — plus any name registered in `properties.custom`.

## Custom Property Handlers {#custom-property-handlers}

Add computed or remapped properties for use in `details-property`, `details-asset-metadata`, and `searchResults.views`:

```js
// configurations.js
properties: {
  custom: {
    brand: (asset) => asset.getProperty('jcr:content/metadata/myco:brand').data,
    'approval-status': (asset) => {
      const status = asset.getProperty('jcr:content/metadata/dam:status').data;
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : null;
    },
  },
},
```

Then reference the custom name (`brand`, `approval-status`) anywhere a built-in property name is accepted.
