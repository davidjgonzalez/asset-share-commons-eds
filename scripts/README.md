# scripts/

Browser JavaScript for the site. Everything here is loaded by Edge Delivery Services as native ES
modules: there is no build step.

| Path | Owner | Edit? | What it is |
|------|-------|-------|------------|
| `aem.js` | EDS boilerplate | No (upgrade from the boilerplate) | Core EDS loader: block discovery, eager/lazy/delayed phases |
| `scripts.js` | EDS boilerplate, ASC-modified | Only to re-apply the ASC hooks after an upgrade | Page lifecycle; calls the four hooks in `asc.js` |
| `delayed.js` | EDS boilerplate | Yes, if you need delayed-phase work | Runs about 3s after load |
| `asc.js` | You | Yes | ASC integration entry point: lifecycle hooks and the action-page helpers blocks import |
| `asc/` | See its README | See its README | `configurations.js` (yours) and `core/` (ASC framework) |

## Who may import what

- **Blocks** import `scripts/asc.js` (for `triggerAction`, `confirmDialog`, `parseActionFragment`,
  `wireDialogClose`) and may import from `scripts/asc/core/**` directly.
- **`scripts.js`** imports only `asc.js` (and `aem.js`).
- Nothing in `scripts/` may import from `blocks/`.

Build tooling does not belong here: Node scripts live in `/tools`.
