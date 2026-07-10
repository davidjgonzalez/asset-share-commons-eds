# Path Filter Block Implementation — Phase 1-2 Complete

**Date**: June 3, 2026  
**Status**: ✅ Working Demo + Documentation Complete

---

## What Was Built

A complete end-to-end demonstration of the Path filter block (DAM folder filtering) that validates the entire ASC v2 development workflow, design patterns, and search architecture.

### Deliverables

#### 1. **Working Demo Page** → `search-demo.html`
Live, functional page showcasing:
- Multiple search filters working together (path, property, date-range, tags)
- Search bar for full-text search
- Search results grid with infinite scroll
- Real QueryBuilder integration
- Debug panel showing live form state changes
- All filters coordinate via shared `asc-search-form`

**How to run**:
```bash
aem up --no-open
# Visit http://localhost:3000/search-demo.html
```

**Try it**:
1. Select "Brand" path → results filter to `/content/dam/brand`
2. Select "Image" file type → AND with path filter
3. Click a result → details modal opens
4. Watch form fields update in debug panel (bottom-right)

#### 2. **Comprehensive Path Filter Documentation** → `skills/asc-development/templates/search-filter.md` (updated)

Added complete "Path Filter Example" section showing:
- Real authoring config (da.live table format)
- Generated QueryBuilder request
- Form field names showing QB naming pattern
- Full JS implementation with comments
- CSS (reuses search-property helpers)
- Provider support matrix (QB ✅, OpenAPI ⚠️)

#### 3. **Updated Extension Decision Guide** → `skills/asc-development/references/extension-decision.md`

- Path filter already listed as reference: "Filter by a DAM path → Copy search-path block"
- Links correctly to template
- Quick decision tree for developers adding custom filters

---

## Architecture Patterns Demonstrated

### Pattern 1: QB Form Field Naming (Provider Agnostic)

All search inputs use `{group}_group.{predicateName}.{paramKey}` pattern:

```
Authored config:
  | options | Brand: /content/dam/brand        |
  |         | Campaigns: /content/dam/campaigns |

Generated form fields:
  1_group.path.0_value = /content/dam/brand
  1_group.path.1_value = /content/dam/campaigns

Sent to QueryBuilder:
  path.0_value=/content/dam/brand&path.1_value=/content/dam/campaigns&path.exact=false&...
```

**Why this matters**:
- Decouples UI layer from search provider implementation
- Each provider's `buildParams()` translates QB → API-specific format
- Adding new filters requires NO provider-specific UI code

### Pattern 2: Hidden Predicate Parameters

Path filter sets QB flags as hidden inputs:

```js
<input type="hidden" name="${config.parameter('exact')}" value="false" />
<input type="hidden" name="${config.parameter('flat')}" value="false" />
<input type="hidden" name="${config.parameter('self')}" value="true" />
```

**Result**: DAM path searches include descendants by default, configurable at block level.

### Pattern 3: Reusable HTML Helpers

Path filter reuses `htmlCheckboxes`, `htmlRadio`, `htmlDropdown` from search-property block:

```js
import { htmlCheckboxes, htmlRadio, htmlDropdown } from '../search-property/search-property.js';

// Use directly in html() function
${type === 'checkbox' ? htmlCheckboxes(config) : ''}
${type === 'radio' ? htmlRadio(config) : ''}
${type === 'dropdown' ? htmlDropdown(config) : ''}
```

**Benefit**: DRY principle; new filters don't re-implement UI patterns.

### Pattern 4: Declarative Event Binding

Filters wire to search service via `addSearchEventListeners()`:

```js
import { addSearchEventListeners } from '../../scripts/asc/core/utils/search.js';

block.innerHTML = html(config);
addSearchEventListeners(block, config);  // ← No manual listener binding
```

**Why**: Prevents duplicate listeners; dynamic elements automatically handled; form field changes always route to SearchService.

### Pattern 5: URL State Preservation

Selected filters pre-populate on page load via `config.initial`:

```js
const checked = config.initial[name] === option.value;  // Restore from URL

// Result: ?1_group.path.0_value=/content/dam/brand pre-checks "Brand"
```

**Benefit**: Shareable filtered search URLs; deep linking works out-of-box.

---

## CDD Workflow Validation

The path filter implementation validates all 8 CDD steps:

| Step | Artifact | Status |
|------|----------|--------|
| 1. Decide | "Filter DAM assets by folder path" | ✅ |
| 2. Design | Authoring model: options with labels/values | ✅ |
| 3. Build | `search-path.js` + CSS implementation | ✅ |
| 4. Document | Template updated with full example | ✅ |
| 5. Test | Demo page + browser testing | ✅ |
| 6. Integrate | Filters work with search service | ✅ |
| 7. Review | Follows conventions (QB naming, CSS selectors, etc.) | ✅ |
| 8. Ship | Code committed; documentation live | ✅ |

---

## How Developers Use This

### Scenario 1: "Add a folder filter to my search page"

1. **Read**: [extension-decision.md](skills/asc-development/references/extension-decision.md) → "Filter by a DAM path"
2. **Navigate**: Links to [search-filter.md](skills/asc-development/templates/search-filter.md)
3. **Find**: "Path Filter Example" section with real config
4. **Copy**: Block reference from [AGENTS.md](AGENTS.md#block-inventory)
5. **Author**: Create da.live table with path options
6. **Test**: Filters update search results live

### Scenario 2: "Create a custom filter for file size"

1. **Read**: [search-filter.md](skills/asc-development/templates/search-filter.md) → "Step 1-5"
2. **Study**: Path filter example → understand QB naming, config pattern
3. **Copy**: `blocks/search-path/` → `blocks/search-size-range/`
4. **Adapt**: Change predicate to `sizebucket` (or custom `property` for dam:size)
5. **Follow**: Checklist to validate; test with demo page approach

---

## Technical Validation

✅ **Form Field Names**: Follow QB pattern `1_group.path.0_value` (verified in demo)  
✅ **Provider Agnostic**: QB handles query, OpenAPI has fallback (documented)  
✅ **CSS Selectors**: Use `main .search-path` (Phase 7 migration ✓)  
✅ **Event Binding**: Via `addSearchEventListeners()`; no manual wiring  
✅ **URL Restoration**: `config.initial` preserves selections on page reload  
✅ **Reusability**: Uses search-property HTML helpers (DRY ✓)  
✅ **Documentation**: Template + demo + decision guide complete  

---

## Next Steps (Phase 3+)

Optional enhancements (not required for MVP):

1. **Slider Type**: Support range slider UI (ASCv1 had this)
2. **Dynamic Options**: Load paths from DAM structure via Sling DataSource
3. **OpenAPI Full Support**: Extend `buildParams()` to handle multiple paths
4. **Advanced Path Predicates**: UI for exact/flat/self flags (currently hidden)

---

## References

- **Demo Page**: [search-demo.html](search-demo.html)
- **Implementation**: [blocks/search-path/search-path.js](blocks/search-path/search-path.js)
- **Documentation**: [search-filter template](skills/asc-development/templates/search-filter.md)
- **Decision Guide**: [extension-decision.md](skills/asc-development/references/extension-decision.md)
- **Architecture**: [AGENTS.md](AGENTS.md) - Search system, event reference, predicate mapping
- **Historical**: [DECISIONS.md](docs/DECISIONS.md#d002-querybuilder-form-field-naming-provider-agnostic)

---

**Implementation complete.** Path filter validates all core ASC v2 patterns and provides a template for future search filter development.
