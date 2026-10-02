# core/models/

Plain data classes. **ASC Core: do not edit.**

| File | Purpose |
|------|---------|
| `asset.js` | An AEM asset: properties, renditions, `getProperty()` |
| `rendition.js` | One rendition of an asset |
| `user.js` | The signed-in user |
| `asset-access-error.js` | Returned in place of an `Asset` when a lookup is forbidden (401/403) |

**Import from:** blocks, parts, services and `scripts/asc.js`. Models may import `utils/` and the
service barrel they need, and nothing from `parts/` or blocks.

To change what an asset exposes, register a property handler (`services.properties`) from
`configurations.js` rather than editing a model.
