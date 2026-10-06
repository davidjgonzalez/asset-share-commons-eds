# core/services/

Business logic as singletons, initialized on import. **ASC Core: do not edit.**

**Import from:** blocks and `scripts/asc.js`. Use the barrel: `import services from '.../services/services.js'`,
then `services.search`, `services.collections`, and so on. Services may import `models/`, `utils/` and each other.

**Configure** a service through its section in `scripts/asc/configurations.js` (read via
`services/configurations.js`); never edit the service.

| Service | Responsibility |
|---------|----------------|
| `search/` | Search orchestration; providers in `search/providers/` (`querybuilder`, `openapi`) |
| `aem/` | AEM host and URL management; `authorizedFetch()` chokepoint for all AEM requests |
| `users/` | Identity + credential delivery via a pluggable AuthStrategy (`users/strategies/`: `anonymous`, `aem`). See docs/AUTH.md |
| `collections/` | Collections, favorites and sheets state (localStorage) |
| `asset-details/` | URL-addressable details modal, template per MIME type |
| `renditions/` | Rendition definitions and resolvers |
| `properties/` | Pluggable asset property handlers (add your own in `configurations.js`) |
| `action-pages/`, `actions/` | `/actions/*` dialogs; declarative `data-asc-action` dispatch |
| `downloads/`, `authored-assets/`, `file-type/`, `url/`, `storage/` | Downloads, authored asset lists, file types, URL/sheet encoding, storage |
| `analytics/`, `activity/`, `notifications/`, `seo/`, `debug/`, `webmcp/` | Cross-cutting services; each takes a `customListeners` array or similar option |
| `init/`, `services.js`, `configurations.js` | Wiring: startup, the barrel, and the config re-export |

New service? Add a folder, export it from `services.js`, and expose its settings in `configurations.js`.
