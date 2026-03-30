# Asset Share Commons EDS — Quickstart

Get from zero to a running asset sharing site in about 30 minutes.

---

## Prerequisites

- Node.js 18+
- GitHub account
- AEM as a Cloud Service instance, or AEM SDK running on `localhost:4503`, with DAM content
- AEM CLI: `npm install -g @adobe/aem-cli`
- da.live account (free at [da.live](https://da.live))

---

## 1. Fork and Clone

1. Fork this repository to your GitHub account.
2. Clone your fork locally:

```bash
git clone https://github.com/{owner}/{repo}.git
cd {repo}
npm install
```

3. Install the **AEM Code Sync** GitHub App on your forked repo:
   [https://github.com/apps/aem-code-sync](https://github.com/apps/aem-code-sync)

   This app watches your `main` branch and syncs code to the AEM CDN automatically on every push.

---

## 2. Create a da.live Workspace

1. Go to [da.live](https://da.live) and sign in.
2. Create a new project using the same org and repo name as your GitHub fork — for example, if your fork is `github.com/acme/asset-share`, create a da.live project at `content.da.live/acme/asset-share/`.

da.live is where you author and publish content (pages, navigation, etc.). Code lives in GitHub; content lives in da.live.

---

## 3. Connect da.live to Your Repo

Update `fstab.yaml` in the root of your repo to point to your da.live workspace:

```yaml
mountpoints:
  /:
    url: https://content.da.live/{owner}/{repo}/
    type: markup
folders:
    /details: /details/default
```

Replace `{owner}` and `{repo}` with your actual GitHub org and repo name. Commit and push this change to `main`.

---

## 4. Create Content Pages in da.live

Open your da.live workspace and create the following pages. These are the minimum pages the site needs.

### `/nav`

Navigation bar. A simple document with links. Example structure:

| Nav |
|-----|
| [Home](/) |
| [Collections](/collections) |

### `/footer`

Footer links. Same format as nav.

### `/` (index — the main search page)

This is where blocks are assembled. Blocks are authored as tables: the first row is the block name, subsequent rows are configuration.

Example search page with a search bar and results grid:

| Search Bar |
|------------|

| Search Results |
|----------------|
| Page Size | 24 |

Each table becomes a block. The block name in row 1 maps to a folder in `/blocks/`. Configuration rows are key/value pairs passed to the block's `decorate()` function.

The full set of available blocks is in the `/blocks/` directory: `search-bar`, `search-results`, `search-property`, `search-path`, `search-date-range`, `search-tags`, `search-statistics`, `details-actions`, `details-download`, `details-preview`, `details-property`, `collection`, `collections`, and more.

### `/details/default`

The asset details modal template. This page is loaded inside the details modal when a user opens an asset. Assemble it with details blocks:

| Details Preview |
|-----------------|

| Details Property |
|------------------|
| Property | dc:title |

| Details Download |
|------------------|

| Details Actions |
|-----------------|

You can create additional detail templates per MIME type (e.g., `/details/video`, `/details/pdf`) and map them in `configurations.js`.

---

## 5. Configure `scripts/configurations.js`

This is the only file you need to edit. Set your AEM host and (optionally) your search provider:

```js
const configurations = {
  aem: {
    // Point to your AEM as a Cloud Service publish host, or AEM SDK locally.
    host: 'https://publish-{env}-{program}.adobeaemcloud.com',
  },

  search: {
    // 'querybuilder' (default) — uses AEM QueryBuilder API, works with AEM DAM out of the box.
    // 'openapi'      — uses AEM Dynamic Media OpenAPI Search; requires DM OpenAPI entitlement.
    provider: 'querybuilder',

    // Narrow the search to a specific DAM path (QueryBuilder only):
    // basePath: '/content/dam/my-brand',
  },

  // ...
};
```

**QueryBuilder** is the right choice if you are on AEM DAM without Dynamic Media OpenAPI. **OpenAPI** is for sites using Dynamic Media with OpenAPI and requires that entitlement to be active on your AEM environment.

---

## 6. Start Local Dev

```bash
aem up
```

This starts a local proxy at `http://localhost:3000`. It serves code from your local disk and fetches content from da.live. The AEM connection (asset search, renditions) goes to whatever `aem.host` is set to in `configurations.js`.

If you are developing against a local AEM SDK on `localhost:4503`, the default `aem.host` value works without changes.

---

## 7. Verify It Works

Open `http://localhost:3000` in your browser. You should see:

- The navigation and footer render from da.live content.
- The search bar block appears on the index page.
- Typing in the search bar fires a request to your AEM instance and results appear in the grid.
- Clicking an asset card opens the details modal.

If results do not appear, check:

1. Your AEM instance is reachable from the browser (no CORS errors in DevTools).
2. `aem.host` in `configurations.js` is correct.
3. The DAM path has published assets.
4. If using QueryBuilder, your AEM user has read access to `/content/dam`.

---

## 8. Deploy

Push to `main` on GitHub — AEM Code Sync picks it up automatically. No build step needed.

```bash
git add scripts/configurations.js fstab.yaml
git commit -m "Configure for production"
git push origin main
```

To publish content, use the da.live sidebar: open any page and click **Publish**. Published pages are immediately available on both preview and live CDN endpoints:

- Preview: `https://main--{repo}--{owner}.aem.page/`
- Live: `https://main--{repo}--{owner}.aem.live/`

---

## Themes

Six themes ship out of the box:

| Theme | Description |
|-------|-------------|
| `default` | Clean light theme |
| `dark` | Dark mode |
| `warm` | Warm neutrals |
| `studio` | Airy SaaS aesthetic, blue + violet accents |
| `vault` | Professional dark asset manager, near-black with blue accents |
| `custom` | Starter file for your own theme (`styles/themes/custom.css`) |

Switch themes in `configurations.js`:

```js
theme: {
  default: 'studio',
},
```

To create a custom theme, add a CSS file to `styles/themes/` that overrides CSS variables, then set `default` to your filename (without `.css`).

---

## Custom Asset Properties

To expose non-standard JCR metadata fields in details blocks, add handlers to the `properties.custom` map in `configurations.js`. See the commented-out example in that file for the handler signature.

---

## Universal Editor

The project ships with `component-definition.json`, `component-models.json`, and `component-filters.json` so all ASC blocks can be edited visually in the AEM Universal Editor without touching document tables. See the [Universal Editor documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/universal-editor/introduction) for setup instructions.
