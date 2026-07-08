# ASC v2 EDS Architecture Assessment

**Date**: June 2, 2026  
**Scope**: Complete codebase review covering documentation, architectural decisions, conventions, extension points, and gaps

---

## 1. Documentation Inventory

All Markdown documentation is current and accurate to code. The repository maintains comprehensive guidance at multiple levels.

| File | Purpose | Status | Completeness |
|------|---------|--------|--------------|
| [AGENTS.md](../AGENTS.md) | Comprehensive developer reference: blocks, services, events, patterns | Current | 95% — see gaps below |
| [CLAUDE.md](../CLAUDE.md) | AI assistant guidance; architecture overview | Current | 100% |
| [README.md](../README.md) | Project overview, commands, key links | Current | 100% |
| [docs/QUICKSTART.md](../docs/QUICKSTART.md) | Zero-to-deployed setup guide | Current | 100% |
| [docs/CSS_CONVENTION.md](../docs/CSS_CONVENTION.md) | CSS standards: selectors, nesting, variables, responsive, accessibility | Current | 100% |
| [docs/THEMING_README.md](../docs/THEMING_README.md) | Theme creation and token reference | Current | 100% |
| [docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md) | Contributor workflow, commit format | Current | 100% |
| [docs/CODE_OF_CONDUCT.md](../docs/CODE_OF_CONDUCT.md) | Adobe CoC reference | Current | 100% |
| [docs/starter-kit/README.md](../docs/starter-kit/README.md) | Content templates for da.live import | Current | 100% |
| [scripts/# Sheets Feature Specification.md](../scripts/%23%20Sheets%20Feature%20Specification.md) | **🚩 DRAFT** — Feature spec incomplete; filename has `#` character | Draft | 0% |

**Key observation**: Documentation is unusually high-quality for a DAM/EDS project. AGENTS.md alone is a 200+ KB reference document that rivals Adobe's own skill documentation in depth and accuracy.

---

## 2. Architectural Decisions — Documented

The codebase embodies 8 foundational architectural choices, all explicitly documented in AGENTS.md.

### 2.1 Ownership Boundary

```
scripts/configurations.js  ← USER-EDITABLE (single entry point)
scripts/asc/              ← ASC CORE (all start with "// ASC Core — do not edit.")
blocks/                   ← USER-OWNED (copy and modify freely)
styles/                   ← USER-OWNED (add themes, override CSS)
component-*.json          ← USER-EDITABLE (Universal Editor config)
```

**Design**: Clear separation enforces a non-breaking upgrade path. Users never modify core; core files can be updated independently via `scripts/asc/` folder replacement.

**Current enforcement**: No inline markers in block code. Only `scripts/asc/*` files have "// ASC Core" guards.

### 2.2 No Build Step

**Decision**: Vanilla ES6 modules deployed via AEM CDN directly. No bundling, tree-shaking, or minification.

**Consequence**: All `scripts/asc/*` are HTTP modules (browser-resolved imports). AEM Code Sync GitHub App handles automatic deployment.

### 2.3 Provider-Agnostic Search

**Decision**: Search layer delegates all API calls to a pluggable provider.

**Implementations**:
- **QueryBuilder** (default): `scripts/asc/services/search/providers/querybuilder.js` — all AEM versions via `/bin/querybuilder.json`
- **OpenAPI**: `scripts/asc/services/search/providers/openapi.js` — AEMaaCS only with Dynamic Media Asset Delivery API

**Form field naming convention** (QB → OpenAPI translation):
```
{group}_group.{predicate}.{param}
Example: 1_group.daterange.lowerBound
```

Both providers read this unified format; OpenAPI performs a two-pass translation to filter params.

### 2.4 Singleton Services with Lazy Init

**Decision**: All 15 services are singletons, imported at module load time in `scripts/scripts.js`.

**Pattern**: Each service listens to `asc:blocks:loaded` event and initializes itself once.

**Consequence**: Services are globally available (`import services from '...'`) without constructor parameters. No per-block wiring needed.

### 2.5 Declarative Events via Data Attributes

**Decision**: Blocks communicate via `data-asc-action="noun:verb@event"` instead of direct JS coupling.

**Pattern**: Actions service globally listens, collects `data-asc-*` attributes up DOM tree, dispatches matching CustomEvent on `document.body`.

**Events**: 18 ASC events defined, all following `asc:{noun}:{verb}` pattern.

**Consequence**: Blocks can be added/removed without breaking interconnections.

### 2.6 URL-Addressable Asset Details

**Decision**: Asset details modal opens via `?asset={uuid}` URL param, making deep-links shareable.

**Routing**: `configurations.assetDetails.templates()` function can route to different modal templates by MIME type or metadata.

**Storage**: URL param removed on close; browser history works naturally.

### 2.7 localStorage-Based Collections (Anonymous-First)

**Decision**: Cart/collections stored in user-scoped localStorage, not server-side.

**Storage schema**:
- `asc` — global config
- `asc:anonymous` — anonymous user data
- `asc:user{id}` — logged-in user data

**Supports**: User login/merge flow; collections persist across tabs; no backend dependency.

### 2.8 CSS Variable Theming

**Decision**: Themes override **only** semantic `--color-*` tokens. Structural tokens (spacing, radius, shadows) defined once and never overridden.

**Consequence**: Adding a new theme requires 16 CSS variable definitions only. Changes propagate to all blocks automatically.

**Semantic tokens**:
```css
--color-bg, --color-fg, --color-card, --color-card-fg, --color-primary, --color-primary-fg,
--color-secondary, --color-secondary-fg, --color-muted, --color-muted-fg, --color-accent,
--color-accent-fg, --color-destructive, --color-destructive-fg, --color-border, --color-input,
--color-ring, --color-popover, --color-popover-fg
```

**Structural tokens** (never overridden in themes):
```css
--spacing-*, --border-radius-*, --shadow-*, --transition-*, --body-font-size-*,
--heading-font-size-*, --body-font-family, --heading-font-family
```

---

## 3. Configuration Mechanisms

All customization lives in a single source: `scripts/configurations.js`

### 3.1 Configuration Surface (by tier)

| Tier | Mechanism | Complexity |
|------|-----------|-----------|
| **Zero-code** | Configuration objects in `scripts/configurations.js` | Low |
| **Single-file** | Custom property handler, rendition definition, search provider | Medium |
| **Block copy** | Copy a block, modify JS + CSS | Medium |
| **Part creation** | New part function + CSS | Medium |
| **Service extension** | Custom search provider, property handler | High |

### 3.2 Current Configuration Keys

| Key | Tier | Extensibility |
|-----|------|---|
| `aem.host` | Zero-code | ✓ — change AEM connection |
| `aem.deliveryHost` | Zero-code | ✓ — enable DM with OpenAPI |
| `search.provider` | Zero-code | ✓ — switch to 'openapi' or custom |
| `search.{preprocessQuery, postprocessResults, accepts}` | Zero-code | ✓ — hook functions for query/result filtering |
| `searchResults.views` | Zero-code | ✓ — configure result display properties per view mode |
| `assetDetails.templates` | Zero-code | ✓ — function routing by MIME type |
| `collections.*` | Zero-code | ✓ — configure cart/collection URLs and behavior |
| `downloads.*` | Zero-code | ✓ — polling timeout, job expiry |
| `properties.custom` | Single-file | ✓ — register custom property handlers |
| `renditions.definitions` | Single-file | ✓ — add/modify rendition types |
| `theme.default` | Zero-code | ✓ — activate theme by name |
| `init.preload` | Zero-code | ✓ — enable asset preload on hover |
| `debug.debug` | Zero-code | ✓ — enable debug mode (undocumented) |

---

## 4. Core Services Inventory (15 services)

All exported from [scripts/asc/services/services.js](../scripts/asc/services/services.js).

| Service | Module | Purpose | Extensibility |
|---------|--------|---------|---|
| **aem** | scripts/asc/services/aem/aem.js | Host/URL management, auth headers | Config via `configurations.aem` |
| **actions** | scripts/asc/services/actions/actions.js | Declarative event binding (`data-asc-action`) | No extension point |
| **assetDetails** | scripts/asc/services/asset-details/asset-details.js | URL-addressable modal, fragment routing | Config via `configurations.assetDetails.templates` |
| **collections** | scripts/asc/services/collections/collections.js | Cart/collection state, localStorage persistence | Storage schema fixed; IMS login flow built-in |
| **debug** | scripts/asc/services/debug/debug.js | Debug utilities | Config via `configurations.debug` |
| **downloads** | scripts/asc/services/downloads/downloads.js | Async bulk-download polling, job tracking | Config via `configurations.downloads` |
| **fileType** | scripts/asc/services/file-type/file-type.js | MIME type classification (extension → label) | Hardcoded types; no config |
| **init** | scripts/asc/services/init/init.js | Page initialization, preloading on hover | Config via `configurations.init` |
| **properties** | scripts/asc/services/properties/properties.js | Asset property handler registry, custom properties | Config via `configurations.properties.custom` |
| **renditions** | scripts/asc/services/renditions/renditions.js | Rendition definition lookup, URL resolution | Config via `configurations.renditions.definitions` |
| **search** | scripts/asc/services/search/search.js | Search orchestration, provider abstraction | Providers in `scripts/asc/services/search/providers/` |
| **storage** | scripts/asc/services/storage/storage.js | User-scoped & global localStorage API | No extension point |
| **url** | scripts/asc/services/url/url.js | Asset list compression & decompression | No extension point |
| **users** | scripts/asc/services/users/users.js | IMS/SSO detection, user context | Depends on AEM IMS setup |
| **configurations** | scripts/asc/services/configurations.js | Imported configuration object | — |

---

## 5. Block Inventory (24 blocks)

### 5.1 Categorization

```
Search Blocks (8):       search-bar, search-property, search-path, 
                         search-date-range, search-tags, search-hidden, 
                         search-results, search-statistics

Details Blocks (6):      details-modal, details-preview, details-property,
                         details-renditions, details-actions, details-similar

Collections Blocks (4):  stub, sheet, collections, collection, 
                         collection-switcher

EDS Standard (6):        hero, footer, header, fragment, columns
```

### 5.2 Pattern Consistency

**All blocks follow a consistent pattern**:
- `blocks/{name}/{name}.js` — exports `decorate(block)` function
- `blocks/{name}/{name}.css` — scoped to `.block.{name}` root selector
- `readBlockConfig(block)` or `readBlockConfig(block, transform, defaults)` for content extraction
- All use native EDS block model (no custom framework)

### 5.3 Search Blocks — Unified Form Handling

All search blocks import from [scripts/asc/utils/search.js](../scripts/asc/utils/search.js):
- `readBlockConfig(block, transform, defaults)` — extracts QB-style form field names
- `addSearchEventListeners(block, config)` — wires all interactive inputs to dispatch `asc:search:execute`

Form field naming convention: `{group}_group.{predicate}.{param}`

### 5.4 Ownership & Modification Safety

- **User-owned**: All 24 blocks live in `blocks/` — safe to copy and modify
- **No ASC core blocks**: All functional blocks are user-modifiable copies of the canonical implementation
- **No inline ownership markers**: Blocks don't have `@owner` JSDoc comments (gap identified)

---

## 6. Parts Inventory (4 parts)

**All parts are plain functions**, not classes. Each exports a default function `(asset, options)` → HTML string.

| Part | Purpose | Pattern |
|------|---------|---------|
| **assetTeaser** | Search result card/masonry/list renderer | Renders product view for an asset; no event binding |
| **collectionToggle** | Add/remove collection toggle button | Reactive; hydrates state on `asc:collection:change` events |
| **picture** | Responsive `<picture>` element with breakpoints | Wraps asset thumbnail with responsive image attributes |
| **part.js** | Documentation reference (no implementation) | Pattern guide only |

**Rules**:
- No direct event binding; all events via `data-asc-action`
- CSS scoped to `.asc-{part-name}`
- CSS loaded at import time via `loadCSS()`

---

## 7. Utilities Inventory (4 modules)

| Module | Exports | Purpose |
|--------|---------|---------|
| [scripts/asc/utils/search.js](../scripts/asc/utils/search.js) | `readBlockConfig()`, `addSearchEventListeners()`, `getOptions()` | QB form field extraction, event wiring for search blocks |
| [scripts/asc/utils/events.js](../scripts/asc/utils/events.js) | `delegateEvent()` | jQuery-like .on() event delegation pattern |
| [scripts/asc/utils/fragments.js](../scripts/asc/utils/fragments.js) | `loadFragment()` | Fragment page loading with caching |
| [scripts/asc/utils/blocks.js](../scripts/asc/utils/blocks.js) | `readBlockConfig()`, `getOptions()` | EDS standard block config helpers |

---

## 8. Models Inventory (3 classes)

| Model | Purpose | Key properties |
|-------|---------|---|
| [scripts/asc/models/asset.js](../scripts/asc/models/asset.js) | Represents a DAM asset with metadata | `uuid`, `path`, `title`, `filename`, `mimeType`, `getProperty()`, `getRendition()` |
| [scripts/asc/models/rendition.js](../scripts/asc/models/rendition.js) | Represents a single rendition | `id`, `label`, `type`, `url`, `fileSize`, `mimeType` |
| [scripts/asc/models/user.js](../scripts/asc/models/user.js) | Represents authenticated user context | `id`, `email`, `name` |

---

## 9. Events System (18 events)

All events follow `asc:{noun}:{verb}` pattern. Full reference in AGENTS.md.

### 9.1 Dispatch Scopes

| Scope | Events | Listeners |
|-------|--------|-----------|
| `document` | `asc:search:*` | SearchService, search-statistics, search-results |
| `document.body` | `asc:asset:*`, `asc:collection:*`, `asc:download:*` | Services, UI handlers, custom blocks |
| Block element | Block-local | Internal block handlers (rare) |

### 9.2 Event Detail Shapes (complete reference in AGENTS.md)

Each event passes a `detail` object with specific properties. For example:
- `asc:search:complete` → `{ results: Asset[], total, size, offset, more, success }`
- `asc:collection:change` → `{ action, id?, collectionId?, assetId?, userId?, source? }`

---

## 10. Extension Points — Current State

### 10.1 Configuration-Based Extensions

| Mechanism | Location | Usage |
|-----------|----------|-------|
| Custom Properties | `configurations.properties.custom` | `{ propertyName: (asset) => value }` |
| Rendition Definitions | `configurations.renditions.definitions` | Array of `{ id, label, type, accepts, url/params/name }` |
| Search Hooks | `configurations.search.{preprocessQuery, postprocessResults, accepts}` | Modify query before search, results after search |
| Asset Details Routing | `configurations.assetDetails.templates` | Function `(asset) => fragmentPath` |
| Themes | `styles/themes/{name}.css` | CSS override of `--color-*` tokens only |
| Collections Paths | `configurations.collections.*` | Customize cart/collection URLs |

### 10.2 Code-Level Extensions

| Extension | Approach | Complexity |
|-----------|----------|-----------|
| Custom Search Filter | Copy `blocks/search-*`, modify to new QB predicate | Medium |
| Custom Result Card | Modify `scripts/asc/parts/asset-teaser.js` or create new block | Medium |
| Custom Search Provider | Extend `SearchProvider`, register in `scripts/asc/services/search/search.js` | High |
| Custom Theme | Create `styles/themes/{name}.css` | Low |
| Custom Property Handler | Register in `configurations.properties.custom` | Low |
| Custom Rendition | Define in `configurations.renditions.definitions` | Low |

### 10.3 Escape Hatches — GAPS

**Missing**: No documented pattern for partially overriding `scripts/asc/` core without forking the entire folder.

Current options:
1. Override a service method entirely (modify `scripts/asc/services/{name}.js` — requires re-applying on upgrades)
2. Use hooks where they exist (search preprocessing, etc.)

**Need**: A documented pattern for module re-exports or a clear protocol for safe core extension.

---

## 11. Conventions & Patterns

### 11.1 CSS Convention — `.block.<name>` Root Selector

All blocks use `.block.{name}` as the root selector, not `main .{name}` (Adobe's pattern).

**Declared in**: [docs/CSS_CONVENTION.md](../docs/CSS_CONVENTION.md)

**Reason**: Intentional divergence to support reusable blocks across multiple contexts without namespace pollution.

**Example**:
```css
.block.search-results { /* styles */ }
.block.search-results input { /* nested child */ }
.block.search-results &.compact { /* variant */ }
```

### 11.2 Data Attribute Conventions

| Attribute | Purpose | Scope |
|-----------|---------|-------|
| `data-asc-action="noun:verb@event"` | Declarative event binding | All elements |
| `data-asc-asset="uuid"` | Asset identity | Propagates up DOM tree |
| `data-asc-collection="id"` | Collection reference | Optional; defaults to active |
| `data-asc-preload="path"` | Prefetch on hover | AssetDetails modal |
| `data-asc-fieldset="id"` | Search filter grouping | Dependency logic |

### 11.3 Block Naming Convention

| Category | Prefix | Examples |
|----------|--------|----------|
| Search | `search-*` | search-bar, search-property, search-date-range |
| Details | `details-*` | details-modal, details-preview, details-renditions |
| Collections | `collection*` | collection, collection-switcher, stub, sheet |
| EDS standard | — | hero, footer, header, fragment, columns |

---

## 12. Inconsistencies & Gaps

### 12.1 Documentation vs. Code Mismatches

| Issue | Location | Severity | Status |
|-------|----------|----------|--------|
| Theme list discrepancy | AGENTS.md vs. THEMING_README.md | Minor | AGENTS.md notes `warm`/`vault` as removed; code only has `default`, `dark`, `studio` |
| **🚩 Sheets Feature Spec** | `scripts/# Sheets Feature Specification.md` | Critical | File incomplete; filename has `#` character; not referenced in AGENTS.md |
| Block ownership markers | Block files | Minor | Blocks don't have `@owner user` JSDoc comments; only `scripts/asc/*` have "// ASC Core" guards |

### 12.2 Documentation Gaps

| Gap | Impact | Workaround |
|-----|--------|-----------|
| Services reference not in single doc | Medium — must read AGENTS.md or services.js | Covered in AGENTS.md |
| Custom search provider tutorial | Medium — only API reference, no implementation guide | Must study querybuilder.js code |
| Search form naming convention | Low — documented in AGENTS.md, not in QUICKSTART | Discovered via example blocks |
| Global cache (window.asc) | Low — mentioned in CLAUDE.md but not formally documented | Internal use only |
| Debug mode functionality | Low — `configurations.debug` exists but undocumented | Not actively used |
| Core extension escape hatch | **High** — no pattern for safe partial core overrides | Only fork-entire-folder currently |

### 12.3 Code Issues

| Issue | Location | Severity | Notes |
|-------|----------|----------|-------|
| Empty hero.js | `blocks/hero/hero.js` | Low | File exists but is empty; auto-decoration via scripts.js. Intentional? |
| Deprecated rendition types? | configurations.js examples | Low | Legacy DM (IS/IR protocol) examples shown but support level unclear |

### 12.4 Feature Gaps

| Feature | Status | Notes |
|---------|--------|-------|
| Analytics integration | Not documented | `loadDelayed()` mentioned for analytics but no example |
| Batch operations | Partial | Collections add/remove work; no bulk reorder UI |
| Asset versioning | Not supported | No version tracking in Asset model |
| Advanced caching | Limited | `window.asc.cache.assets` exists; no TTL or invalidation strategy |
| Offline support | Not documented | No ServiceWorker mention |
| Theme generation from URL | Not implemented | Feature request from user |

---

## 13. Known Working Features (Verified)

| Feature | Status | Evidence |
|---------|--------|----------|
| Search (QueryBuilder) | ✓ Working | search.js + querybuilder.js + search-* blocks |
| Search (OpenAPI) | ✓ Code exists | openapi.js provider, pattern matches Adobe guidance |
| Collections (localStorage) | ✓ Working | collections.js + stub/sheet/collection blocks |
| Asset Details Modal | ✓ Working | asset-details.js + details-*.js blocks |
| Renditions (static) | ✓ Working | renditions.js + details-renditions block |
| Renditions (DM Legacy) | ✓ Code exists | configurations.js examples show pattern |
| Renditions (DM OpenAPI) | ✓ Code exists | renditions.js implementation present |
| Async Downloads | ✓ Code exists | downloads.js with polling logic |
| Collections (IMS Login) | ✓ Code exists | collections.loginAs() + storage merge |
| Theming | ✓ Working | 3 built-in themes + custom theme support |
| Universal Editor | ✓ Working | component-*.json files + integration |

---

## 14. Testing Surface

| Area | Coverage | Tools |
|------|----------|-------|
| **Linting** | ESLint (airbnb-base) + Stylelint | `npm run lint`, `npm run lint:fix` |
| **Unit Tests** | Not implemented | — |
| **Browser Testing** | Manual | `aem up` + local dev server |
| **e2e Tests** | Not implemented | — |

---

## 15. Next Steps (Strategic)

### Immediate (Phase 1 tasks)
1. ✓ Create this ARCHITECTURE_ASSESSMENT.md
2. Resolve `scripts/# Sheets Feature Specification.md` (rename, complete, or archive)
3. Add `/** @owner user */` JSDoc markers to all 24 blocks

### Short-term (Phases 2–4)
4. Review Adobe skills guidance (content-driven-development, building-blocks, etc.)
5. Complete gap analysis (core extension escape hatch, debug mode, etc.)
6. Design future-state architecture (CSS selector alignment, CDD workflow for ASC, extension registry)

### Medium-term (Phases 5–6)
7. Update AGENTS.md + CLAUDE.md with future-state decisions
8. Create asc-development skill (adobe/skills-compatible with 14 reference documents)
9. Create asc-theme-from-website skill (Playwright-based theme generation)

### Long-term (Phase 7)
10. Migrate CSS selectors: `.block.<name>` → `main .{name}` (all 24 blocks)
11. Verify no regressions; run full lint suite

---

## Appendix A: Key Files Reference

| File | Role | Priority |
|------|------|----------|
| [scripts/configurations.js](../scripts/configurations.js) | Single source of truth for all customization | Critical |
| [scripts/asc/services/services.js](../scripts/asc/services/services.js) | All 15 service singletons exported | Critical |
| [AGENTS.md](../AGENTS.md) | Comprehensive reference for developers and AI agents | Critical |
| [docs/CSS_CONVENTION.md](../docs/CSS_CONVENTION.md) | CSS standards and token reference | High |
| [scripts/asc/utils/search.js](../scripts/asc/utils/search.js) | QB form field naming and search block utilities | High |
| [scripts/asc/services/search/search.js](../scripts/asc/services/search/search.js) | Search provider abstraction | High |

---

## Appendix B: Terminology

| Term | Meaning in ASC Context |
|------|---|
| **QB form field** | Form input with name pattern `{group}_group.{predicate}.{param}` (QueryBuilder-native) |
| **Provider** | Search backend implementation (QueryBuilder or OpenAPI) |
| **Fragment** | Reusable HTML content page (EDS pattern) |
| **Part** | Plain JS function that returns HTML string for a reusable UI component |
| **ASC Core** | Files in `scripts/asc/` — never edited by users; updated via folder replacement |
| **User-owned** | Files in `blocks/`, `styles/`, or configuration — safe to customize |
| **Semantic token** | CSS variable for a design decision (e.g., `--color-primary`) |
| **Structural token** | CSS variable for layout (spacing, radius, shadow) — never overridden in themes |

---

**Document compiled from codebase exploration on June 2, 2026.**
