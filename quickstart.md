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
      - title: 3. Mount Content
        url: "#step-3"
      - title: 4. Author Content
        url: "#step-4"
      - title: 5. Configure AEM
        url: "#step-5"
      - title: 6. Run Locally
        url: "#step-6"
      - title: 7. Verify
        url: "#step-7"
      - title: 8. Deploy
        url: "#step-8"
  - label: Next Steps
    items:
      - title: Apply a Theme
        url: "#themes"
      - title: Configure Renditions
        url: "#renditions-config"
      - title: Custom Properties
        url: "#custom-properties"
---

# Quick Start

Get Asset Share Commons running locally in about 15 minutes. You need an AEM instance (author or publish) with accessible DAM assets.

> **TL;DR** — Fork the repo → connect AEM Code Sync → create da.live workspace → author pages → set `aem.host` in `configurations.js` → run `aem up`.

![Quick Start flow overview](https://placehold.co/860x440/111111/e91e8c?text=Quick+Start+Flow+Overview&font=inter)

*High-level setup flow: fork → connect → configure → run*

## Prerequisites {#prerequisites}

- Node.js 18+
- An AEM instance (AEM 6.5 SP15+, AEM SDK, or AEM as a Cloud Service) with assets in DAM
- A GitHub account (for the code repository)
- A [da.live](https://da.live){:target="_blank"} account (for content authoring)
- The [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync){:target="_blank"}

## Step 1 — Fork & Install AEM Code Sync {#step-1}

1. Fork [**davidjgonzalez/asset-share-commons-eds**](https://github.com/davidjgonzalez/asset-share-commons-eds){:target="_blank"} to your GitHub account.
2. Install the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync){:target="_blank"} and grant it access to your forked repository.
3. Clone the fork locally:

```bash
git clone https://github.com/YOUR-USERNAME/asset-share-commons-eds.git
cd asset-share-commons-eds
npm install
```

## Step 2 — Create a da.live Workspace {#step-2}

1. Go to [da.live](https://da.live){:target="_blank"} and sign in with your Adobe ID.
2. Click **New Organization** → link it to your GitHub account.
3. Create a new site pointing to your forked repository.

## Step 3 — Mount Content (fstab.yaml) {#step-3}

Edge Delivery Services content lives in Google Drive or SharePoint and is mounted via `fstab.yaml` in the repository root.

```yaml
# fstab.yaml
mountpoints:
  /:
    url: https://drive.google.com/drive/folders/YOUR-FOLDER-ID
    type: google
```

Create the folder in Google Drive, share it with the AEM Code Sync service account, then commit `fstab.yaml`.

## Step 4 — Author Content in da.live {#step-4}

Each page is a document in your content folder. Blocks are authored as tables — the first row is the block name, subsequent rows are configuration key/value pairs.

The **[starter kit](https://github.com/davidjgonzalez/asset-share-commons-eds/tree/main/docs/starter-kit){:target="_blank"}** in `docs/starter-kit/` contains ready-to-import HTML files for every page type. Import them into da.live to get going immediately.

#### Starter kit pages

| File | Purpose | URL path |
|------|---------|----------|
| `index.html` | Search page (main entry) | `/` |
| `details/default.html` | Default asset details template | `/details/default` |
| `details/image.html` | Image-specific details template | `/details/image` |
| `sheet.html` | Download sheet | `/sheet` |
| `collections.html` | Collections index page | `/collections` |
| `nav.html` | Site navigation | `/nav` |
| `footer.html` | Site footer | `/footer` |

## Step 5 — Configure AEM Connection {#step-5}

Open `scripts/configurations.js` and set your AEM host:

```js
// scripts/configurations.js — the only file you need to edit

export default {
  aem: {
    // Your AEM publish host (or author for internal tools)
    host: 'https://publish-pXXXX-eYYYY.adobeaemcloud.com',

    // AEM as a Cloud Service Asset Delivery host (optional — for DM OpenAPI renditions)
    // deliveryHost: 'https://delivery-pXXXX-eYYYY.adobeaemcloud.com',
  },

  search: {
    provider: 'querybuilder',   // 'querybuilder' (default) or 'openapi'
  },

  assetDetails: {
    templates: {
      'image/*': '/details/image',
      default:   '/details/default',
    },
  },

  theme: {
    default: 'default',  // 'default' | 'dark' | 'warm' | 'studio' | 'vault'
  },
};
```

## Step 6 — Run Locally {#step-6}

```bash
aem up    # starts the local dev proxy at http://localhost:3000
```

The AEM CLI proxy fetches content from your da.live workspace and serves JS/CSS from your local filesystem — so code changes are instant.

> **CORS on localhost** — AEM may block requests from `localhost:3000`. Add it to the AEM Dispatcher or Publish CORS configuration, or use an AEM author instance which typically has more permissive CORS settings.

## Step 7 — Verify {#step-7}

Open `http://localhost:3000` and check:

- Search bar renders and accepts input
- Typing a query returns assets from your AEM DAM
- Clicking an asset opens the details modal
- URL updates to `?asset={uuid}`
- Download block lists renditions
- Add to Cart updates the stub counter

![Asset Share Commons running locally](https://placehold.co/860x480/111111/9333ea?text=Asset+Share+Commons+Running+Locally&font=inter)

*Asset Share Commons running at localhost:3000*

## Step 8 — Deploy {#step-8}

```bash
git push origin main
```

AEM Code Sync picks up the push automatically and deploys to your preview (`main--{repo}--{owner}.aem.page`) and live (`main--{repo}--{owner}.aem.live`) environments within seconds.

---

## Apply a Theme {#themes}

Change the `theme.default` value in `configurations.js`:

```js
theme: {
  default: 'vault',   // default | dark | warm | studio | vault
}
```

To create your own theme, copy `styles/themes/custom.css` and override any CSS variable. See the [Theming guide](/theming) for the full variable reference.

## Configure Renditions {#renditions-config}

By default Asset Share Commons resolves `thumbnail`, `web`, and `original` static renditions from the asset's JCR rendition nodes. To add Dynamic Media or AEM Asset Delivery renditions, configure them in `configurations.js`. See the [Renditions guide](/renditions).

## Custom Metadata Properties {#custom-properties}

Add computed or remapped properties for use in `details-property` blocks:

```js
// configurations.js
properties: {
  custom: {
    'brand': (asset) => asset.getProperty('jcr:content/metadata/myco:brand'),
    'approval-status': (asset) => {
      const status = asset.getProperty('jcr:content/metadata/dam:status');
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : null;
    },
  },
},
```

Then add a `details-property` block with `property = brand`.
