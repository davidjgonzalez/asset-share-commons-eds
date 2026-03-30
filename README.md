# Asset Share Commons — Edge Delivery Services

An AEM Edge Delivery Services front-end for sharing, searching, and downloading assets from AEM DAM.

## Environments

- Preview: `https://main--{repo}--{owner}.aem.page/`
- Live: `https://main--{repo}--{owner}.aem.live/`

## Getting Started

See **[QUICKSTART.md](QUICKSTART.md)** for the full setup guide.

**TL;DR:**
```bash
npm install
aem up       # opens http://localhost:3000
```

## Documentation

| File | Purpose |
|------|---------|
| [QUICKSTART.md](QUICKSTART.md) | First-time setup — AEM, da.live, local dev, deploy |
| [AGENTS.md](AGENTS.md) | Developer reference — events, data attributes, blocks, extension points |
| [CSS_CONVENTION.md](CSS_CONVENTION.md) | CSS coding standards for blocks and themes |
| [THEMING_README.md](THEMING_README.md) | How to create and switch themes |
| [docs/starter-kit/](docs/starter-kit/) | Content starter kit — HTML pages to import into da.live |

## Configuring

All configuration lives in **`scripts/configurations.js`** — the only file you ever need to edit. Everything in `scripts/asc/` is ASC core and should not be modified.

Minimum configuration:
```js
// scripts/configurations.js
export default {
  aem: {
    host: 'https://author-pXXX-eYYY.adobeaemcloud.com',
  },
  search: {
    provider: 'querybuilder',  // or 'openapi'
  },
};
```

## Blocks

**Search:** `search-bar` `search-property` `search-path` `search-date-range` `search-tags` `search-hidden` `search-statistics` `search-results`

**Asset Details:** `details-modal` `details-preview` `details-property` `details-download` `details-actions`

**Collections:** `stub` `sheet` `collections` `collection`

## Theming

Five built-in themes: `default`, `dark`, `warm`, `studio`, `vault`.

```js
// scripts/configurations.js
theme: { default: 'vault' }
```

Add your own in `styles/themes/custom.css`.

## Development

```bash
npm run lint        # ESLint + Stylelint
npm run lint:fix    # auto-fix
aem up              # local dev proxy
```
