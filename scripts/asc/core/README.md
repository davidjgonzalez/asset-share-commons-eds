# scripts/asc/core/

The `VERSION` file in this folder is the ASC Core version; `tools/asc-update.js` reads it to compare against the template on an upgrade.

The ASC framework. **Do not edit.** Every file starts with `// ASC Core — do not edit.`, and the
whole folder is replaced when you upgrade ASC. Change behavior through `scripts/asc/configurations.js`.

## Layers

```
blocks/ (yours)         UI that authors place on pages
   ↓ may import
parts/                  reusable UI pieces shared by several blocks
   ↓ may import
services/               singletons: search, aem, collections, renditions, ...
   ↓ may import
models/                 Asset, Rendition, User
   ↓ may import
utils/                  stateless helpers
```

A layer may import from the layers below it and from its own folder, never from a layer above.
Anything above `utils/` that needs a setting reads it from `configurations.js`.

## Who may import from `core/`

| Importer | Allowed |
|----------|---------|
| Blocks (`blocks/**`) | Yes: `parts`, `services`, `models`, `utils` |
| `scripts/asc.js`, `scripts/scripts.js` | Yes |
| Other `core/` files | Yes, following the layering above |
| `core/` importing a block or a user file | **No**, except `scripts/asc/configurations.js` |

Prefer the single `services.js` barrel (`services/services.js`) over importing an individual service.

## Adding code here

New reusable mechanism, UI or business logic with no site-specific knobs goes here, with the
`// ASC Core — do not edit.` header. See the table in `scripts/asc/README.md` for what goes elsewhere.
