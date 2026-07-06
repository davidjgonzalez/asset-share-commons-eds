# Future-State Architecture for ASC v2 EDS

**Date**: June 2, 2026  
**Scope**: Target architecture decisions and design principles for ASC v2; guided by Adobe EDS patterns and ASC strategic goals

---

## 1. Architecture Vision

**Aspiration**: ASC becomes the canonical example of agentic EDS development — AI-assisted tools (Cursor, Copilot, Claude) can generate compliant extensions with minimal human guidance.

**Means**:
- Explicit, well-documented extension model
- Formal acceptance criteria framework
- Clear separation between configuration and code
- Self-describing code with ownership markers
- Skill-based guidance for common patterns
- Aligned CSS conventions (Adobe + ASC semantic tokens)

---

## 2. Core Architectural Decisions

### 2.1 Adoption of Content-Driven Development (CDD)

**Decision**: ASC adopts the 8-step CDD workflow from Adobe skills as its canonical development process.

**ASC-specific implementation**:

| Step | Adobe guideline | ASC adaptation |
|------|---|---|
| Step 0 | Create TodoList | ✓ Already done in this plan |
| Step 1 | Start dev server | `aem up --no-open --forward-browser-logs` |
| Step 2 | Analyze & plan | Use ASC-specific acceptance criteria template (block-specific) |
| Step 3 | Design content model | For blocks: design da.live table structure; QB form field naming |
| Step 4 | Test content | Create block content in da.live; run `find-test-content` skill if modifying |
| Step 5 | Implement | Use `building-blocks` skill with ASC-specific references |
| Step 6 | Lint & test | `npm run lint`, `npm run lint:fix`, `npm test` |
| Step 7 | Final validation | Check acceptance criteria; verify across mobile/tablet/desktop |
| Step 8 | Ship it | PR with preview links; include preview of all variants |

**Workflow formalization**: Will be captured in `skills/asc-development/references/cdd-workflow.md` (Phase 6)

### 2.2 CSS Conventions — Hybrid Pattern

**Decision**: Migrate block root selectors from `.block.<name>` to `main .{name}` (Adobe standard) while keeping ASC's semantic token strategy.

**Rationale**:
- Adobe pattern is proven, well-documented, and broadly familiar
- ASC's semantic tokens (`--color-*`) remain superior for theming
- Combined approach: Adobe selectors + ASC granular tokens = best of both

**CSS rule**:
```css
/* Root selector: Adobe standard */
main .my-block { /* styles */ }

/* Child and variant nesting: native CSS nesting */
main .my-block {
  & h2 { /* child */ }
  &.large { /* variant */ }
}

/* All colors: ASC semantic tokens */
color: var(--color-fg);
background: var(--color-card);
border: 1px solid var(--color-border);

/* All spacing/structure: ASC structural tokens */
padding: var(--spacing-m);
border-radius: var(--border-radius-m);
box-shadow: var(--shadow-md);

/* No overrides in themes — themes only set --color-* tokens */
```

**Migration plan**: Phase 7, all 24 blocks, one batch at a time

### 2.3 Formal Extension Model — 4 Tiers

**Decision**: Explicitly define extension points by complexity tier. Each tier has clear entry/exit criteria and expected outcomes.

#### Tier 1: Configuration (Zero-code)

**Entry**: Customize behavior without touching code.  
**Mechanism**: Update `scripts/configurations.js`

**What's configurable**:
- Search provider (QueryBuilder / OpenAPI)
- Search hooks (preprocessQuery, postprocessResults, accepts)
- Custom properties (register property handlers)
- Rendition definitions (add/modify renditions)
- Theme (activate by name)
- Asset details routing (MIME-based fragment selection)

**Exit criteria**: Configuration is valid JavaScript; `npm run lint` passes

**Examples**:
- Add a custom property handler for "approval status"
- Add a DM smart crop rendition
- Switch to OpenAPI search provider
- Activate a new theme

**Effort**: < 1 hour per item

---

#### Tier 2: Copy-Modify Block

**Entry**: Customize a block's behavior or appearance.  
**Mechanism**: Copy an existing block, modify JS + CSS

**What's modifiable**:
- Block JS decoration logic
- CSS styling (use ASC semantic tokens)
- Block variants (CSS-only or JS-based)

**Not modifiable** (out of scope):
- Block name (namespace is fixed)
- Block folder structure
- data-asc-action attributes (declare events, don't create new ones)

**Entry criteria**: Existing block is known; understand its purpose and usage

**Exit criteria**: `npm run lint` passes; block renders across mobile/tablet/desktop; no regressions

**Examples**:
- Modify search-results to show asset ratings
- Create a variant of details-image for video-only preview
- Change search-statistics to show facet counts instead of total

**Effort**: 2–4 hours

---

#### Tier 3: New Block

**Entry**: Create a new block for a novel use case not covered by existing blocks.  
**Mechanism**: Create `blocks/{name}/{name}.js` + `.css` following ASC conventions

**Required pattern**:
- Export `decorate(block)` function
- Use `readBlockConfig(block)` or `readBlockConfig(block, transform, defaults)` to extract content
- Use native `<dialog>` for modals
- Use `data-asc-action` for cross-block communication
- Scope CSS to `main .{name}`
- Load CSS at import time via `loadCSS()`

**Entry criteria**: CDD workflow completed (steps 0–4); test content ready; acceptance criteria defined

**Exit criteria**: All acceptance criteria met; `npm run lint` passes; works across viewports; no console errors; PR with preview

**Examples**:
- New "asset cart" block for AEM Authoring integration
- "Featured collection" block for hero section
- Custom metadata editor block

**Effort**: 4–8 hours

---

#### Tier 4: Service Extension

**Entry**: Extend ASC's service layer for a major new capability.  
**Mechanism**: Implement a new service or extend existing service (e.g., custom search provider)

**What's extensible**:
- Custom search provider (implement SearchProvider interface)
- Custom property handler (function-based)
- Custom rendition type (add to configurations)

**Not easily extensible** (requires forking):
- Custom service replacing an existing service (no escape hatch yet)
- Modifying core event system behavior

**Entry criteria**: Architecture review completed; clear use case for service-level extension

**Exit criteria**: Service passes unit tests; integrates cleanly with existing services; no breaking changes

**Examples**:
- Elasticsearch search provider
- Integration with external metadata service
- Custom download handler for specialized formats

**Effort**: 8–16 hours

---

### 2.4 Core Extension Escape Hatch (NEW)

**Problem** (identified in gap analysis): No documented pattern to safely override/extend `scripts/asc/` core without forking the entire folder.

**Solution**: Define a "partial override" pattern that allows selective module re-exports.

**Pattern** (recommended approach):

```js
// scripts/asc-overrides/services/search.js — override search service with custom logic
import SearchService from '../services/search/search.js';

export default class CustomSearchService extends SearchService {
  async search(formData) {
    // Pre-process
    const results = await super.search(formData);
    // Post-process or intercept
    return results;
  }
}
```

```js
// scripts/scripts.js — use override if present
import services from './asc/services/services.js';
const overrideSearch = await import('./asc-overrides/services/search.js').catch(() => null);
if (overrideSearch) {
  services.search = new overrideSearch.default();
}
```

**Constraints**:
- Only for service-level overrides (not blocks or parts)
- Requires understanding service interface
- Not recommended for every upgrade (compatibility risk)

**Status**: Recommended design; implementation deferred to Phase 7 (if needed)

---

### 2.5 Debug & Observability

**Decision**: Formalize debug mode to surface extension registry and event tracing.

**Debug mode activation**: `configurations.debug` object

```js
debug: {
  debug: true,           // Enable debug mode
  logEvents: true,       // Log all asc:* events
  logServices: true,     // Log service initialization
  logExtensions: true,   // Log registered extensions
}
```

**What debug mode surfaces**:
- `window.asc.extensions` — registered custom properties, renditions, search hooks
- Console logging of all `asc:*` events with payload
- Service initialization order and timing
- Provider switching logs

**Implementation**: Phase 4 design; Phase 6 documentation; actual code in debug service (already exists, needs enhancement)

---

### 2.6 Extension Registry Visibility (NEW)

**Decision**: Add `window.asc.extensions` to surface all registered extensions at runtime.

**Structure**:
```js
window.asc.extensions = {
  properties: {
    'approval-status': { handler: (asset) => {...}, source: 'configurations.js' },
    'brand': { handler: (asset) => {...}, source: 'configurations.js' }
  },
  renditions: {
    'web-optimized': { id: 'web-optimized', label: 'Web Optimized', type: 'dm-openapi', source: 'configurations.js' },
    'smart-crop-small': { ... }
  },
  searchHooks: {
    preprocessQuery: { source: 'configurations.js' },
    postprocessResults: { source: 'configurations.js' }
  }
};
```

**Benefit**: Developers can query at runtime what's been registered; useful for debugging and admin dashboards.

**Implementation**: Phase 4 design; Phase 6 documentation

---

## 3. Future-State Documentation Structure

The following documents will comprise Phase 5 (docs for AI agents):

| Document | Purpose | Audience |
|----------|---------|----------|
| Updated AGENTS.md | Comprehensive reference with future-state decisions | All developers, AI agents |
| Updated CLAUDE.md | AI assistant guidance with skill invocation triggers | AI agents, humans using Copilot |
| Updated docs/CSS_CONVENTION.md | CSS standards reflecting hybrid selector/token approach | CSS developers, AI agents |
| New docs/EXTENSION_GUIDE.md | Step-by-step guide for each extension tier | Developers doing custom work |
| New docs/RECIPES.md | 8+ copy-paste recipes for common patterns | Developers, AI agents |

---

## 4. Future-State Skill Structure

The following skills will be created in Phases 6–6b:

### Phase 6: `skills/asc-development/` — main skill

**Purpose**: End-to-end guide for developing against ASC v2 EDS using Adobe CDD workflow and ASC-specific patterns.

**References** (14 documents):
- architecture.md
- block-conventions.md
- cross-block-communication.md
- asc-event-reference.md
- modals-and-dialogs.md
- fragments.md
- parts.md
- services-api.md
- extension-points.md
- search-filters.md
- details-blocks.md
- recipes.md
- css-guidelines.md
- js-guidelines.md

**Invocation triggers** (when to use):
- Creating a new block
- Modifying an existing block
- Adding a custom property
- Creating a custom search filter
- Implementing a modal/dialog
- Building a custom rendition

---

### Phase 6b: `skills/asc-theme-from-website/` — standalone skill

**Purpose**: Extract design tokens from a reference website; generate matching ASC theme.

**Workflow** (5 steps):
1. Extract CSS design tokens via Playwright headless rendering
2. Map extracted values to ASC token system
3. Generate `styles/themes/{name}.css`
4. Activate in `scripts/configurations.js`
5. Visual validation

**Deliverable**: Ready-to-use theme file

---

## 5. Refactoring Roadmap (Phase 7)

### Step 1: CSS Migration Preparation

- ✓ Finalize hybrid CSS convention in docs/CSS_CONVENTION.md
- ✓ Create migration script/checklist
- Communicate change to team

### Step 2: Block-by-block Migration

**Batches** (to parallelize):
- Batch 1: Search blocks (8 blocks) — low coupling
- Batch 2: Details blocks (6 blocks) — depends on details-modal
- Batch 3: Collection blocks (4 blocks) — depends on collection service events
- Batch 4: EDS standard blocks (6 blocks) — minimal ASC-specific logic

**Per-block steps**:
1. Change `.block.{name}` → `main .{name}` (root selector only)
2. Run `npm run lint:css` — fix any issues
3. Run `aem up`, test in browser
4. Commit with message: `refactor(css): migrate {name} selector to Adobe pattern`

### Step 3: Core File Updates

- Update `styles/styles.css` root-level selectors (if any)
- Update `styles/tokens.css` (no changes expected; structural tokens unchanged)

### Step 4: Verification

- Run `npm run lint` — full suite passes
- Run `aem up` and spot-check representative blocks
- Verify no regressions in existing functionality

### Step 5: Documentation Update

- Update AGENTS.md CSS convention table
- Add migration note to CLAUDE.md

---

## 6. Success Criteria for Future-State Architecture

The future-state architecture is successful when:

1. ✓ **CSS alignment**: All 24 blocks use `main .{name}` selector pattern (100% alignment with Adobe)
2. ✓ **Semantic tokens**: ASC's 16 `--color-*` tokens remain in use; themes continue to work (no regression)
3. ✓ **CDD adoption**: Documented as canonical workflow; future blocks follow CDD steps
4. ✓ **Extension model**: All 4 tiers clearly defined with examples; no ambiguity on where to extend
5. ✓ **Escape hatch**: Safe partial core override pattern documented (even if not yet implemented)
6. ✓ **Debug mode**: Extension registry and event logging available for troubleshooting
7. ✓ **Skill coverage**: Both asc-development and asc-theme-from-website skills created and tested
8. ✓ **Regression-free**: All 24 blocks render correctly; `npm run lint` passes; no console errors
9. ✓ **AI-friendly**: An AI agent can generate a compliant new block from scratch using the skill + AGENTS.md

---

## 7. Decision Record (ADRs)

### ADR-001: CSS Selector Alignment to Adobe Pattern

**Status**: Decided  
**Decision**: Migrate `.block.<name>` → `main .{name}`  
**Rationale**: Adobe pattern is proven and widely familiar; aligns ASC with EDS ecosystem standards  
**Tradeoff**: Restricts blocks to `main` context (acceptable; ASC blocks should live in `<main>`)  
**Implementation**: Phase 7, all 24 blocks

### ADR-002: Semantic Token Strategy (Intentional Divergence)

**Status**: Decided  
**Decision**: Keep ASC's 16 `--color-*` semantic tokens; do NOT align to Adobe's simpler set  
**Rationale**: DAM applications need more granular color roles; ASC themes benefit from semantic precision  
**Tradeoff**: More tokens to document; more for designers to learn  
**Note**: Structural tokens (`--spacing-*`, `--border-radius-*`, etc.) remain unchanged

### ADR-003: CDD Workflow Adoption

**Status**: Decided  
**Decision**: Adopt Adobe's 8-step CDD as canonical development process  
**Rationale**: Proven workflow; aligns ASC with Adobe ecosystem; improves code quality  
**Tradeoff**: Requires test content upfront; slower initial development  
**Benefit**: Better validation, fewer regressions, clearer acceptance criteria

### ADR-004: Extension Model — 4 Tiers

**Status**: Decided  
**Decision**: Formally define configuration, block, part, and service extension tiers  
**Rationale**: Clear categorization helps developers pick the right extension approach  
**Tradeoff**: Documentation burden; must maintain all 4 patterns  
**Benefit**: Self-service extensibility; no guessing where to extend

### ADR-005: Partial Core Override Pattern (Escape Hatch)

**Status**: Recommended (not yet implemented)  
**Decision**: Define `scripts/asc-overrides/` pattern for selective service re-exports  
**Rationale**: Allows safe partial core extension without forking entire `scripts/asc/`  
**Risk**: Compatibility on future upgrades if override interface changes  
**Recommendation**: Only use if Tier 1–4 extensions are insufficient

---

## Appendix: Alignment Matrix (ASC → Adobe EDS Standards)

| Dimension | Adobe standard | ASC current | ASC future | Gap |
|-----------|---|---|---|---|
| **Block structure** | `blocks/{name}/{name}.{js,css}` | ✓ Aligned | ✓ Aligned | None |
| **Block export** | `export default function decorate(block)` | ✓ Aligned | ✓ Aligned | None |
| **DOM re-use** | Re-use delivered DOM elements | ✓ Aligned | ✓ Aligned | None |
| **CSS root selector** | `main .{name}` | `.block.{name}` | `main .{name}` | **Closure in Phase 7** |
| **CSS custom properties** | Semantic tokens | Semantic tokens (16) | Semantic tokens (16) | ✓ Aligned |
| **Responsive** | Mobile-first, @media (width >= X) | ✓ Aligned | ✓ Aligned | None |
| **Development workflow** | CDD 8-step | Ad-hoc | ✓ CDD | **Closure in Phase 5** |
| **Extension model** | Implicit (skills provide patterns) | Implicit (AGENTS.md) | ✓ Explicit (4 tiers) | **Closure in Phase 4–6** |
| **Testing** | ESLint/Stylelint + browser | ✓ Linting | ✓ Linting + manual browser | ✓ Aligned |

---

**Document compiled from architecture review and gap analysis on June 2, 2026.**
