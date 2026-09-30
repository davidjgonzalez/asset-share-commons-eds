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
      - title: 4. Configure AEM connection
        url: "#step-4"
      - title: 5. Configure Dispatcher
        url: "#step-5"
      - title: 6. Run Locally
        url: "#step-6"
      - title: 7. Verify
        url: "#step-7"
      - title: 8. Deploy
        url: "#step-8"
  - label: Next Steps
    items:
      - title: Staying in Sync with ASC Core
        url: "#staying-in-sync"
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

> **Fork, not "Use this template."** GitHub's template option gives you a clean repo with no history and no path back to the original, which is fine for a one-off snapshot but rules out ever pulling a Core update again. A real fork keeps the git relationship intact, the same way you'd stay connected to an upstream AEM EDS boilerplate. See [Staying in Sync with ASC Core](#staying-in-sync) below for what that buys you.

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

## Step 4 — Configure AEM connection {#step-4}

Open `scripts/asc/configurations.js` — the only file you need to edit — and set your AEM host. ASC ships defaults for everything else (asset details routing, rendition ladders, property handlers, and so on), so this is all a working site needs:

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
    page: '/search',            // where a search-bar on another page sends the query
  },

  theme: {
    default: 'default',  // 'default' | 'dark' | 'studio'
  },
};

export default configurations;
```

Every other option in the file is commented out with its default shown. Uncomment only what you want to change; see the [Developer Reference](/developer#defaults) for the full list of what ships by default.

## Step 5 — Configure the AEM Publish Dispatcher {#step-5}

ASC runs entirely in the browser, so search, thumbnails, renditions, and downloads are `fetch()` calls from the page straight to `aem.host`. If that host is an AEM Publish tier behind a Dispatcher, the Dispatcher must allow those requests through. A hardened default configuration blocks them.

Ask whoever owns your Dispatcher (Cloud Manager or AMS repository) to add the two samples below. Adjust them to your environment.

**1. Allow filter rules.** Add to your farm's filter file (`dispatcher.any`, or `conf.dispatcher.d/filters/filters.any` on AEM as a Cloud Service), alongside your baseline security filters. Delete the rules for features you don't use.

```
# Asset Share Commons: Dispatcher filter rules.
#
# Paste into your farm's filter file (AEMaaCS: dispatcher/src/conf.dispatcher.d/filters/filters.any),
# alongside your baseline security filters, not in place of them. Rule names only need to be unique.
# Delete the rules for features you don't use (for example, the OpenAPI block if search.provider
# is 'querybuilder').

# QueryBuilder search
/asc-001 { /type "allow" /method "GET" /url "/bin/querybuilder.json" }

# DM OpenAPI search, only if search.provider: 'openapi'
/asc-002 { /type "allow" /method "GET" /url "/adobe/assets/search" }
/asc-003 { /type "allow" /method "GET" /url "/adobe/assets/*" }

# Static renditions and thumbnails
/asc-004 { /type "allow" /method "GET" /url "/content/dam/*/_jcr_content/renditions/*" }

# Web-optimized / DM OpenAPI delivery
/asc-005 { /type "allow" /method "GET" /url "/adobe/dynamicmedia/deliver/*" }

# Bulk download initiate and poll
/asc-006 { /type "allow" /method "POST" /url "/content/dam.downloads.initiateDownload.json" }
/asc-007 { /type "allow" /method "GET"  /url "/content/dam.downloads.initiateDownload.json" }

# CORS preflight for the authenticated calls above (only needed if preflights reach Publish;
# asc-cors.vhost answers them at Apache first)
/asc-008 { /type "allow" /method "OPTIONS" /url "/bin/querybuilder.json" }
/asc-009 { /type "allow" /method "OPTIONS" /url "/content/dam.downloads.initiateDownload.json" }
```

**2. CORS headers.** Add to the Apache virtual host that fronts AEM Publish. Replace `YOUR-REPO` and `YOUR-OWNER` with your values, and remove the localhost line in production.

```apache
# Asset Share Commons: CORS response headers.
#
# Paste into your Dispatcher virtual host (AEMaaCS: dispatcher/src/conf.d/available_vhosts/<name>.vhost),
# inside or after the <VirtualHost> block that fronts AEM Publish. Requires mod_headers and mod_rewrite.
#
# 1. Edit the origin allowlist below (EDS hostnames, custom domain, localhost).
# 2. Remove the localhost line on production environments.
# 3. Do NOT also emit CORS headers from AEM Publish's CORS policy (duplicate headers are rejected).

# Origins allowed to call this host from the browser.
SetEnvIfExpr "req_novary('Origin') =~ m#^https://(main--YOUR-REPO--YOUR-OWNER\.aem\.(page|live)|assets\.example\.com)$#" ASC_CORS_ORIGIN=%{HTTP:Origin}
SetEnvIfExpr "req_novary('Origin') == 'http://localhost:3000'" ASC_CORS_ORIGIN=%{HTTP:Origin}

<IfModule mod_headers.c>
    # Echo the matching origin, never '*', so credentialed requests (bulk downloads) work.
    Header always set Access-Control-Allow-Origin "%{ASC_CORS_ORIGIN}e" env=ASC_CORS_ORIGIN
    Header always set Access-Control-Allow-Credentials "true" env=ASC_CORS_ORIGIN
    Header always set Access-Control-Allow-Methods "GET, POST, HEAD, OPTIONS" env=ASC_CORS_ORIGIN
    Header always set Access-Control-Allow-Headers "Authorization, Content-Type" env=ASC_CORS_ORIGIN
    Header always set Access-Control-Max-Age "86400" env=ASC_CORS_ORIGIN

    # The response differs by Origin, so shared caches must key on it.
    Header always merge Vary "Origin"
</IfModule>

# Answer preflight requests at the web tier so they never reach Publish.
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} =OPTIONS
    RewriteCond %{ENV:ASC_CORS_ORIGIN} !=""
    RewriteRule ^ - [R=204,L]
</IfModule>
```

You can skip this step if `aem.host` points at an author instance or a Publish tier without a restrictive Dispatcher.

## Step 6 — Run Locally {#step-6}

```bash
aem up    # starts the local dev proxy at http://localhost:3000
```

The AEM CLI proxy fetches content from your da.live workspace and serves JS/CSS from your local filesystem — so code changes are instant, no rebuild or redeploy needed.

> **CORS on localhost** — AEM may block requests from `localhost:3000`. Make sure `http://localhost:3000` is an allowed origin in the CORS configuration from the previous step, or use an AEM author instance, which typically has more permissive CORS settings.

## Step 7 — Verify {#step-7}

Open `http://localhost:3000` and check:

- Search bar renders and accepts input
- Typing a query returns assets from your AEM DAM
- Clicking an asset opens the details modal
- URL updates to `?asset={uuid}`
- `details-renditions` lists the asset's renditions
- Adding an asset to a collection updates the `collection-switcher` / `stub` badge count

![Asset Share Commons running locally](https://placehold.co/860x480/111111/9333ea?text=Asset+Share+Commons+Running+Locally&font=inter)

*Asset Share Commons running at localhost:3000*

## Step 8 — Deploy {#step-8}

```bash
git push origin main
```

AEM Code Sync picks up the push automatically and deploys to your preview (`main--{repo}--{owner}.aem.page`) and live (`main--{repo}--{owner}.aem.live`) environments within seconds. To publish content, use the da.live sidebar — open any page and click **Publish**.

---

## Staying in Sync with ASC Core {#staying-in-sync}

Everything under `scripts/asc/core/` is marked "do not edit" for a reason: it's the part of the project meant to keep working the same way in your fork as it does upstream, so future fixes and features can land in your project the same way a fork of the AEM EDS boilerplate itself stays current. See the [Ownership Boundary](/developer#ownership) for the full list of what's yours to edit versus what stays untouched.

Add the original project as a second remote once, right after forking:

```bash
git remote add asc-upstream https://github.com/davidjgonzalez/asset-share-commons-eds.git
```

Whenever you want to pull in upstream changes:

```bash
git fetch asc-upstream
git merge asc-upstream/main
```

This stays low-conflict as long as your own changes are confined to the customization surface: `scripts/asc/configurations.js`, `scripts/asc.js`, `blocks/`, and `styles/`. If you've edited anything under `scripts/asc/core/` directly, expect merge conflicts there; that's the tradeoff for stepping outside the boundary.

Two things worth knowing:

- Occasionally an update touches the boilerplate parts of `scripts/scripts.js` itself, not just `scripts/asc/core/`. The [Page Lifecycle](/developer#lifecycle) section lists exactly which lines those are, so a conflict there is quick to resolve by hand.
- There are no tagged releases yet, so `asc-upstream/main` is the only thing to merge from today. Review the commits you're pulling in before merging rather than merging blind, the same caution you'd apply to any upstream dependency without pinned versions.

If you're using an AI coding assistant to help maintain your fork, point it at this project's `CLAUDE.md` and `AGENTS.md` (in the repo root): they document the ownership boundary and event conventions in a form written for that purpose.

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

Built-in property names: `thumbnail`, `title`, `file-type`, `file-size`, `file-extension`, `dimensions`, `width`, `height`, `mime-type`, `modified`, `created`, `description`, `filename`, `author`, `keywords`, `tags`, `smart-tags`, `colors`, `history`, `uploaded-by`, `uploaded-date`, `last-modified-by`, `last-modified-date` — plus any name registered in `properties.custom`. When `searchResults.views` is not set, cards show `thumbnail`, `title`, `file-type`, `dimensions`, and `file-size`.

## Custom Property Handlers {#custom-property-handlers}

The built-in properties above are already registered. Add computed or remapped ones, or override a built-in by reusing its name, for use in `details-property`, `details-metadata`, and `searchResults.views`:

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
