# tools/

Developer tooling. Nothing here is loaded by the browser or deployed with the site's runtime code.

| Path | What it is |
|------|------------|
| `asc-update.js` | Upgrades `scripts/asc/core` from an ASC template remote without touching user code (`npm run asc:update`). See docs/PROJECT_STRUCTURE.md "Upgrading". |
| `extract-design-tokens.js` | Node CLI that generates a theme from a website's colors: `node tools/extract-design-tokens.js --url <url> --theme <name>` |
| `local-dev-proxy/` | Local development proxy helper |

**Edit:** yes, these are yours. **Import from:** nothing in the runtime code should import from `tools/`.
