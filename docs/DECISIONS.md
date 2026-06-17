# ASC Architecture Decisions Log

Record of significant design decisions, their rationale, and alternatives considered. For high-level strategic decisions, see [FUTURE_STATE_ARCHITECTURE.md](FUTURE_STATE_ARCHITECTURE.md).

---

## D001: CSS Selector Pattern (`.block.<name>` → `main .<name>`)

**Status**: Active (Phase 7 migration complete)  
**Date**: 2026-02-XX | **Updated**: 2026-06-XX

### Decision
Initially adopted ASC-specific CSS selector pattern: `.block.<name>` for all block root elements.  
Phase 7 migration to Adobe baseline: `main .<name>` for alignment with EDS convention.

### Rationale
**Original pattern (.block.<name>)**:
- Scoped selectors to blocks, preventing accidental cascade into child sections
- Made block ownership explicit in CSS
- Visually distinct from standard EDS (clear: "this is ASC-specific")

**Migration rationale**:
- Adobe EDS baseline uses `main .{name}` — long-term compatibility
- Reduces cognitive load for teams familiar with Adobe tools
- Enables future tooling/linting that expects standard patterns
- Simplifies cross-project patterns if ASC code is shared

### Alternatives Considered
- **Keep `.block.<name>` permanently**: Protects from accidental cascade, but locks in ASC-specific divergence
- **Dual-selector hybrid** (`.block.<name>, main .<name>`): Support both during migration (considered, rejected as bloat)
- **CSS scoping via @scope**: Too new (no universal browser support in 2026)

### Implementation
- Batch migration: 24 blocks across 4 batches (search, details, collection, standard)
- CSS linting verified no new errors
- No JavaScript changes required
- Backwards compatible if old `.block.` rules are removed after CDN caches expire

### Relevant Docs
- [ADOBE_GUIDANCE_REVIEW.md](ADOBE_GUIDANCE_REVIEW.md) — Gap analysis
- [CSS Guidelines](asc-development/references/css-guidelines.md) — Current pattern reference

---

## D002: QueryBuilder Form Field Naming (Provider Agnostic)

**Status**: Active (v1.0+)  
**Date**: 2026-01-XX

### Decision
All search input fields use QueryBuilder-style naming: `{groupNum}_group.{predicateName}.{paramKey}`  
regardless of backend provider (QueryBuilder or OpenAPI).

### Rationale
- **Provider abstraction**: UI layer decoupled from API choice
- **Predictable naming**: Developers know field names follow QB structure
- **Translation layer**: Each provider's `buildParams()` performs QB → API-specific mapping
- **Single form schema**: No provider-specific UI code needed

### Alternatives Considered
- **Provider-specific naming from start** (e.g., `filter[assetFormat][]` for OpenAPI):
  - Pro: Direct API mapping
  - Con: UI tightly coupled to provider choice; switching providers requires form refactoring
- **Generic naming layer** (`field-name`, `field-value` with separate mapper):
  - Pro: Simplest for single use case
  - Con: Added indirection; developers lose QB context

### Implementation
- Form fields standardized in `scripts/asc/utils/search.js`: `readBlockConfig()`, `addSearchEventListeners()`
- Each provider implements `buildParams(formData)` to translate QB → API format
- Example translation: `1_group.daterange.lowerBound` → `filter[createdAt][from]` (OpenAPI)

### Example Code Pattern
```js
// Search filter block — always QB naming
<input 
  type="date" 
  name="1_group.daterange.lowerBound"
  form="asc-search-form"
/>

// Provider handles translation
// QueryBuilderProvider: passes through as-is
// OpenApiProvider: maps to filter[createdAt][from]
```

### Relevant Docs
- [extension-decision.md](asc-development/references/extension-decision.md) — Search customization
- [search.js](../scripts/asc/utils/search.js) — Implementation

---

## D003: Event Scoping (Document vs document.body)

**Status**: Active (v1.0+)  
**Date**: 2026-01-XX

### Decision
Custom events dispatched on two scopes:
- **Search events** → `document` (asc:search:execute, asc:search:complete)
- **Cross-block events** → `document.body` (asc:asset:details:open, asc:collection:add)

### Rationale
- **Search scope (document)**:
  - Form controls (inputs, selects) dispatch change events
  - SearchService listens globally for any search:execute event
  - Multiple search instances on page must coordinate
  - Scope to document ensures all forms reach service

- **Cross-block scope (document.body)**:
  - Asset/collection actions are user-initiated (not form-native)
  - Blocks may not exist as immediate children of document
  - Body scope ensures event bubbles through all block DOM trees
  - Separates concerns: form events vs business logic events

### Alternatives Considered
- **All events on document**:
  - Pro: Single scope, simpler to remember
  - Con: Couples form-level concerns with business logic
- **All events on document.body**:
  - Pro: Consistent scope
  - Con: Search events wouldn't bubble from form inputs in some edge cases
- **Custom event hub (no native bubbling)**:
  - Pro: Explicit, no accidental bubbling
  - Con: Added service layer; developers must remember to use hub

### Implementation
- All events follow `asc:{noun}:{verb}` pattern
- SearchService listens on `document`
- ActionsService listens on `document.body`
- Block-specific events can listen on `.block` element (third scope)

### Relevant Docs
- [asc-event-reference.md](asc-development/references/asc-event-reference.md) — All 18+ events and scopes
- [cross-block-communication.md](asc-development/references/cross-block-communication.md) — Event system details

---

## D004: Services as Singletons (vs Per-Block Instances)

**Status**: Active (v1.0+)  
**Date**: 2026-01-XX

### Decision
All 15 core services are module-level singletons, initialized on import.  
Exported from `scripts/asc/services/services.js` and shared across all blocks.

### Rationale
- **Shared state**: Collections, downloads, recently-viewed all shared across page
- **Single API endpoint**: All blocks call same service instance
- **Automatic cache**: Assets cached in `window.asc.cache` shared by all blocks
- **Event coordination**: Single service instance dispatches events all blocks listen to

### Alternatives Considered
- **Per-block instances**:
  - Pro: Encapsulation, easier testing
  - Con: State fragmentation; multiple downloads services = conflicting jobs; multiple collections services = duplicate data
- **Factory pattern** (create instances on demand):
  - Pro: Lazy initialization
  - Con: Requires lifecycle management; memory inefficiency if multiple instances created
- **Event bus only** (no service layer):
  - Pro: Decoupled
  - Con: No place to store shared state; blocks would re-fetch assets constantly

### Implementation
```js
// scripts/asc/services/services.js
const search = new SearchService();
const collections = new CollectionsService();
const downloads = new DownloadsService();
// ... 12 more services

export default { search, collections, downloads, ... };

// Any block:
import services from './services.js';
const { search, collections } = services;
```

### Relevant Docs
- [services-api.md](asc-development/references/services-api.md) — All service methods
- [ARCHITECTURE_ASSESSMENT.md](../docs/ARCHITECTURE_ASSESSMENT.md) — Service catalog

---

## D005: Parts as Plain Functions (Not Classes)

**Status**: Active (v1.0+)  
**Date**: 2026-01-XX

### Decision
Reusable UI components ("Parts") are plain exported functions, not ES6 classes.  
Each Part returns an HTML string; no state, no methods.

### Rationale
- **No constructor overhead**: Simple function call vs class instantiation
- **No event binding in Parts**: Events use `data-asc-action` attributes (handled globally by ActionsService)
- **Composable**: Parts can be nested; return strings that plug into larger HTML
- **Testable**: Pure functions with inputs (asset, options) and HTML string output
- **Styling isolation**: Each Part loads own CSS via `loadCSS()` at import time

### Alternatives Considered
- **Web Components**:
  - Pro: Encapsulation, native slot support
  - Con: Not supported in all EDS deploy targets; added complexity
- **React-like components**:
  - Pro: State management, hooks
  - Con: Adds build step (ASC is no-build); overkill for static UI
- **jQuery-style widgets** (constructor + init method):
  - Pro: Familiar pattern
  - Con: Manual lifecycle; Parts would need destroy() cleanup

### Implementation
```js
// scripts/asc/parts/asset-teaser/asset-teaser.js
import { loadCSS } from '../../../aem.js';

loadCSS('./asset-teaser.css');

export default function assetTeaser(asset, options = {}) {
  const { variant = 'card' } = options;
  return `
    <article class="asc-asset-teaser asc-asset-teaser--${variant}" data-asc-asset="${asset.uuid}">
      <div class="asc-asset-teaser__preview">
        <img src="${asset.thumbnail}" alt="${asset.title}" />
      </div>
      <div class="asc-asset-teaser__meta">
        <h3 class="asc-asset-teaser__title">${asset.title}</h3>
      </div>
    </article>
  `;
}

// Block usage:
import assetTeaser from '../../scripts/asc/parts/asset-teaser/asset-teaser.js';
const html = results.map(asset => assetTeaser(asset)).join('');
element.innerHTML = html;
```

### Relevant Docs
- [parts.md](asc-development/references/parts.md) — Parts reference (assetTeaser, collectionToggle, picture)
- [block-conventions.md](asc-development/references/block-conventions.md) — Block structure

---

## D006: Declarative Event Binding (data-asc-action)

**Status**: Active (v1.0+)  
**Date**: 2026-01-XX

### Decision
Block interactivity wired via `data-asc-action` attributes instead of imperative JS event listeners.  
ActionsService listens globally and routes events based on attribute values.

### Rationale
- **No manual binding**: Prevents duplicate listeners when blocks render multiple times
- **Testable HTML**: Event handlers visible in markup, no hidden JS
- **Dynamic elements**: New DOM elements with data-asc-action automatically handled (no re-binding needed)
- **Separation of concerns**: HTML declares intent; service implements actions

### Alternatives Considered
- **Imperative JS** (block adds click listeners):
  - Pro: Explicit, familiar pattern
  - Con: Manual cleanup on re-render; risk of duplicate listeners
- **Inline onclick handlers**:
  - Pro: Simple for one-off actions
  - Con: Security risk; doesn't scale; can't pass complex data
- **CSS custom properties for events**:
  - Pro: Some scoping
  - Con: CSS not meant for behavior

### Implementation
```html
<!-- Markup declares action intent -->
<button 
  data-asc-action="asset:details:open@click"
  data-asc-asset="uuid-123"
>View Details</button>

<!-- ActionsService handles routing -->
document.body.addEventListener('click', (e) => {
  const action = e.target.dataset.ascAction;
  if (action === 'asset:details:open@click') {
    // Fire asc:asset:details:open event with collected data-asc-* attributes
  }
});
```

### Relevant Docs
- [cross-block-communication.md](asc-development/references/cross-block-communication.md) — data-asc-action reference
- [asc-event-reference.md](asc-development/references/asc-event-reference.md) — Event routing

---

## D007: Rendition Type Abstraction (static/url/asset-delivery)

**Status**: Active (v1.0+)  
**Date**: 2026-01-XX

### Decision
Three rendition types support different AEM deployment models:
- **static**: JCR rendition nodes (any AEM)
- **url**: Legacy Scene7/IS-IR URLs (AEM 6.5, classic Dynamic Media)
- **asset-delivery**: Next-gen Dynamic Media OpenAPI (AEMaaCS only)

### Rationale
- **Deployment flexibility**: Single configuration supports multiple AEM versions
- **Future-proof**: Asset Delivery is new DM standard; static/url are legacy but still in use
- **Template-driven**: Each rendition stores URL pattern; resolved at runtime via variable substitution
- **Provider isolation**: Search provider doesn't need to know about renditions

### Alternatives Considered
- **Single hardcoded type**:
  - Pro: Simplest implementation
  - Con: Breaks for deployments using different DM strategy
- **Separate configurations per AEM version**:
  - Pro: Explicit control
  - Con: Duplicated config; users confused which to use
- **Auto-detection at runtime**:
  - Pro: Zero config
  - Con: Magic behavior; unpredictable if asset metadata is inconsistent

### Implementation
```js
// scripts/configurations.js
renditions: {
  definitions: [
    // Static JCR renditions (any AEM)
    { id: 'web', type: 'static', name: /^cq5dam\.web\./ },
    
    // Legacy Dynamic Media (AEM 6.5)
    { id: 'dm-preset', type: 'url', url: '${dm.apiServer}is/image/${dm.file}?$web$' },
    
    // Next-gen Dynamic Media (AEMaaCS)
    { id: 'web-optimized', type: 'asset-delivery', params: 'format=webp&width=1200' },
  ]
}
```

### Relevant Docs
- [AGENTS.md](../AGENTS.md#rendition-system) — Rendition reference
- [extension-decision.md](asc-development/references/extension-decision.md) — Adding custom renditions

---

## D008: Collections Stored Client-Side (localStorage)

**Status**: Active (v1.0+)  
**Date**: 2026-01-XX

### Decision
User collections (favorites/cart) persisted in browser localStorage, not on AEM server.  
Each user gets separate localStorage scope; anonymous + logged-in are separate contexts.

### Rationale
- **No server round-trip**: Collections available instantly on page load
- **Offline support**: Users can build collections without network
- **Privacy**: No collection data sent to server unless user explicitly shares/downloads
- **Simple architecture**: No need for collection endpoints on AEM
- **Per-user scope**: IMS login triggers merge of anonymous → user-specific collections

### Alternatives Considered
- **Server-side storage** (AEM endpoint):
  - Pro: Syncs across devices, permanent
  - Con: Requires backend implementation; network latency on every collection action
- **Hybrid** (sync to server on demand):
  - Pro: Best of both
  - Con: Sync logic complexity; conflict resolution for multi-device edits
- **SessionStorage only**:
  - Pro: Privacy, no persistence across tabs
  - Con: Lost if user closes tab; frustrating UX

### Implementation
```js
// Storage schema
localStorage.asc = JSON.stringify({
  currentUserId: 'user123' // or null for anonymous
});

localStorage['asc:anonymous'] = JSON.stringify({
  collections: {
    'default-id': { id, name, assetIds: [...] },
    'collection-uuid': { ... }
  }
});

localStorage['asc:user123'] = JSON.stringify({
  collections: { ... }
});
```

### Relevant Docs
- [AGENTS.md](../AGENTS.md#collections-service) — Collections Service API
- [services-api.md](asc-development/references/services-api.md) — Storage service

---

## D009: Semantic CSS Tokens (16 colors + 5 structural)

**Status**: Active (v1.0+)  
**Date**: 2026-01-XX

### Decision
Theming via 16 semantic color tokens + 5 structural token families.  
Themes override colors only; structural tokens (spacing, radius, shadows) remain fixed.

### Rationale
- **Semantic clarity**: `--color-primary` means action, not `--color-blue`
- **Accessibility**: Semantic tokens force contrast consideration (primary vs primary-fg)
- **Theme portability**: Colors extracted from websites map cleanly to semantic roles
- **Structural stability**: Fixed spacing/radius prevents "bad" themes that break layouts

### Alternatives Considered
- **Utility-first** (Tailwind-style):
  - Pro: Maximum flexibility
  - Con: Themes would duplicate spacing/radius; larger CSS; harder to maintain
- **All CSS variables themeable**:
  - Pro: Maximum customization
  - Con: Risk of broken layouts; `--spacing-md: 200px` theme would destroy page
- **No tokens** (hardcoded values):
  - Pro: No abstraction overhead
  - Con: Theme creation requires deep CSS editing

### Implementation
```css
/* styles/styles.css - semantic tokens */
:root {
  /* Colors */
  --color-primary: #1f2937;
  --color-primary-fg: #ffffff;
  /* ... 14 more color tokens */
  
  /* Structural (fixed) */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --border-radius-sm: 4px;
  --shadow-sm: 0 1px 3px rgb(0 0 0 / 10%);
  --transition-fast: 150ms ease-out;
}

/* styles/themes/my-brand.css - theme overrides colors only */
.theme-my-brand {
  --color-primary: #c44b0a;
  --color-primary-fg: #ffffff;
  /* ... no spacing/radius changes */
}
```

### Relevant Docs
- [CSS Guidelines](asc-development/references/css-guidelines.md) — Token reference
- [FUTURE_STATE_ARCHITECTURE.md](../docs/FUTURE_STATE_ARCHITECTURE.md) — Design token strategy

---

## D010: Custom Properties as Pluggable System

**Status**: Active (v1.0+)  
**Date**: 2026-01-XX

### Decision
Asset properties (title, mime-type, dimensions, etc.) resolved via pluggable PropertiesService.  
Built-in properties provided; custom properties added via `configurations.js`.

### Rationale
- **Extensibility**: Teams can add custom metadata properties without modifying core
- **Lazy evaluation**: Properties fetched on-demand, not all loaded upfront
- **JCR agnostic**: Custom properties can read from any metadata source
- **Single API**: All blocks call `asset.getProperty(name)` regardless of source

### Alternatives Considered
- **Asset model with all properties hardcoded**:
  - Pro: Simple, predictable
  - Con: Adding custom properties requires code changes; all properties loaded even if unused
- **Raw metadata object** (all JCR props exposed):
  - Pro: Maximum flexibility
  - Con: Teams must know JCR path syntax; inconsistent property names across projects
- **Separate metadata service**:
  - Pro: Decoupled from Asset
  - Con: Added layer; developers must remember to call it

### Implementation
```js
// scripts/configurations.js
properties: {
  custom: {
    'brand': (asset) => asset.getProperty('jcr:content/metadata/myco:brand'),
    'approval-status': (asset) => {
      const status = asset.getProperty('jcr:content/metadata/dam:status');
      return status?.toUpperCase() || 'PENDING';
    }
  }
}

// Block usage
const brand = asset.getProperty('brand'); // uses custom property above
```

### Relevant Docs
- [extension-decision.md](asc-development/references/extension-decision.md) — Adding custom properties
- [AGENTS.md](../AGENTS.md#property-system) — Property system reference

---

## D011: Block Ownership Model (@owner markers)

**Status**: Active (Phase 1+)  
**Date**: 2026-02-XX

### Decision
All 24 blocks marked with `/** @owner user */` comment in JS files.  
Core services marked with `/** @owner ASC Core — do not edit */`.

### Rationale
- **Clear boundaries**: Teams know what they own vs what they shouldn't modify
- **Upgrade safety**: ASC upgrades replace scripts/asc/ but preserve blocks/
- **Extensibility**: Teams encouraged to copy and modify blocks freely
- **Single customization entry point**: scripts/configurations.js is the only file to edit for config

### Alternatives Considered
- **No markers** (implicit ownership):
  - Pro: No boilerplate
  - Con: Unclear what's safe to edit; teams might accidentally modify core
- **Strict namespacing** (blocks/ under user control, scripts/ off-limits):
  - Pro: Physical separation
  - Con: Already used; marker comment is lightweight alternative
- **Separate ASC core directory**:
  - Pro: Extreme clarity
  - Con: More complex structure; harder to understand relationships

### Implementation
```js
/**
 * Search Bar Block
 * @owner user
 * 
 * Customize in configurations.js:
 *   search: { provider: 'querybuilder' | 'openapi' }
 */
export default function decorate(block) { ... }

// vs

// scripts/asc/services/search/search.js
// ASC Core — do not edit. Customize via scripts/configurations.js
export default class SearchService { ... }
```

### Relevant Docs
- [ARCHITECTURE_ASSESSMENT.md](../docs/ARCHITECTURE_ASSESSMENT.md) — Block inventory
- [CLAUDE.md](../CLAUDE.md) — Ownership boundary

---

## D012: CDD-Inspired Development Workflow

**Status**: Active (Phase 6+)  
**Date**: 2026-05-XX

### Decision
ASC development follows Component-Driven Development (CDD) adapted for blocks.  
8-step workflow: decide → design → build → document → test → integrate → review → ship.

### Rationale
- **Validated at each step**: No surprises at integration time
- **Documentation-first**: Decisions recorded before code written
- **Test coverage**: Built-in; not an afterthought
- **Asynchronous review**: Clear checkpoints for stakeholder feedback

### Alternatives Considered
- **Agile/Scrum** (sprints):
  - Pro: Fast iteration cycles
  - Con: Can skip documentation; technical debt accumulates
- **Traditional Waterfall**:
  - Pro: Complete upfront planning
  - Con: Slow feedback loops; changes expensive
- **Just code** (no process):
  - Pro: Fast initial development
  - Con: Quality/consistency issues; refactoring multiplied costs

### Implementation
1. **Decide**: Extension decision tree (extension-decision.md) — What are you adding?
2. **Design**: Sketch HTML + data model — How will it work?
3. **Build**: Write code — Implement
4. **Document**: Add JSDoc + reference docs — Help future developers
5. **Test**: Manual testing in dev server — Verify behavior
6. **Integrate**: Run lint + check block examples — Ensure compatibility
7. **Review**: Against coding standards (block-conventions.md, css-guidelines.md) — Consistency
8. **Ship**: Git commit + deploy — Production

### Relevant Docs
- [cdd-workflow.md](asc-development/references/cdd-workflow.md) — Full workflow with validation
- [extension-decision.md](asc-development/references/extension-decision.md) — Decision triage layer

---

## D013: Escape Hatch for Core Customization

**Status**: Documented (Phase 4)  
**Date**: 2026-04-XX

### Decision
If a team needs to customize ASC Core (e.g., SearchService behavior), they may:
1. Copy the service to scripts/custom/ and modify
2. Override export in scripts/scripts.js
3. Document their changes for upgrade awareness

### Rationale
- **Pragmatic**: Real teams hit edge cases requiring core changes
- **Transparent**: Changes visible; not hidden in patches
- **Upgrade-aware**: Teams know they'll need to re-apply changes on upgrades
- **Last resort**: Encourages reporting issues to ASC team for upstream fixes

### Alternatives Considered
- **Forbid core changes**:
  - Pro: Clear boundaries
  - Con: Frustrating for teams with real constraints
- **Inherit from classes** (make services extensible):
  - Pro: Override-friendly
  - Con: Adds API surface area; harder to refactor core
- **Plugin system**:
  - Pro: Designed for extensibility
  - Con: Significant complexity; overkill for ~15 services

### Implementation
```js
// If SearchService needs tweaking:
// 1. Copy to scripts/custom/search.js
// 2. Modify as needed
// 3. Override in scripts/scripts.js:

import CustomSearchService from './custom/search.js';
window.asc.services.search = new CustomSearchService();

// 4. Document in project README:
// "Custom SearchService: see scripts/custom/search.js for changes"
```

### Relevant Docs
- [FUTURE_STATE_ARCHITECTURE.md](../docs/FUTURE_STATE_ARCHITECTURE.md) — Extensibility section
- [CLAUDE.md](../CLAUDE.md) — Ownership boundary

---

## D014: No Build Step (EDS Philosophy)

**Status**: Active (v1.0+)  
**Date**: 2026-01-XX

### Decision
ASC is no-build: vanilla ES6 modules, no bundler, deployed as-is to AEM CDN.  
No Webpack, no TypeScript compilation, no JSX preprocessing.

### Rationale
- **Deployment simplicity**: Git push → CDN update (AEM's job)
- **Debug transparency**: Browser DevTools see actual source code
- **Fast iteration**: No build wait time; refresh browser
- **Minimal dependencies**: Only npm dev tools (ESLint, StyleLint)

### Alternatives Considered
- **Webpack/Rollup bundle**:
  - Pro: Tree-shaking, minification, split chunks
  - Con: Build step; harder debugging; added complexity
- **TypeScript**:
  - Pro: Type safety, better IDE support
  - Con: Compilation step; overkill for this project size
- **Single-file deployment** (HTML + embedded JS/CSS):
  - Pro: One file to manage
  - Con: Loses modularity; hard to maintain

### Implementation
- Modules imported via `<script type="module">` in HTML
- Dynamic `import()` for lazy loading (fragments, details templates)
- CSS loaded via `loadCSS(url)` helper
- ESLint + StyleLint for code quality (no compilation)

### Relevant Docs
- [CLAUDE.md](../CLAUDE.md) — Architecture overview
- [ARCHITECTURE_ASSESSMENT.md](../docs/ARCHITECTURE_ASSESSMENT.md) — Core layers

---

## D015: Triage Layer (extension-decision.md)

**Status**: Active (Phase 6+)  
**Date**: 2026-05-XX

### Decision
All "Where do I add X?" questions answered by single reference: extension-decision.md.  
Maps natural language intent → file location + exact config keys + code patterns.

### Rationale
- **Discoverability**: Developers don't hunt through docs; one place to start
- **Completeness**: 14+ extension points documented with decision trees
- **Copy-paste ready**: Config examples use exact syntax; copy directly
- **Maintainability**: As new points added, triage layer is first update

### Alternatives Considered
- **Video tutorials**:
  - Pro: Visual learning
  - Con: Outdated quickly; hard to search; not searchable by text
- **Interactive flowchart UI**:
  - Pro: Engaging
  - Con: Requires hosting; breakable links; maintenance burden
- **Just SKILL.md**:
  - Pro: Single reference
  - Con: Generic; doesn't map intent to exact config keys

### Implementation
```markdown
## I want to: Add a custom search filter

**Triage**: Configuration → New search filter block

**Steps**:
1. Copy blocks/search-property/ to blocks/my-custom-filter/
2. Define QB field name (3_group.{predicateName}.{paramKey})
3. Add to page: <div class="my-custom-filter">...</div>
4. (No configurations.js change needed)

**Details**: [See search-filter template](templates/search-filter.md)
```

### Relevant Docs
- [extension-decision.md](asc-development/references/extension-decision.md) — Full triage layer
- [asc-development/SKILL.md](asc-development/SKILL.md) — Development skill

---

## Decision Framework for Future Decisions

When making new architectural decisions:

1. **Rationale**: Why this choice over alternatives?
2. **Alternatives**: What did we consider and reject?
3. **Implementation**: How is this decision realized in code?
4. **Relevant Docs**: Where should developers learn more?
5. **Status**: Active, Deprecated, or Proposed?

Add entries to this log as new decisions arise. Link decisions to code patterns in reference docs.

---

**Last Updated**: 2026-06-03  
**Total Decisions**: 15 active  
**Related**: [FUTURE_STATE_ARCHITECTURE.md](FUTURE_STATE_ARCHITECTURE.md) (ADRs), [AGENTS.md](../AGENTS.md) (implementation details)
