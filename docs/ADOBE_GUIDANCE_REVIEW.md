# Adobe EDS Skills Guidance & Gap Analysis

**Date**: June 2, 2026  
**Scope**: Review of Adobe Edge Delivery Services skills and authoritative guidance; comparison with ASC v2 implementation

---

## 1. Adobe Skills Reviewed

### Core Workflow Skills

| Skill | Version | Key Guidance | Applicability to ASC |
|-------|---------|-------------|---|
| **content-driven-development** | 2.0.1 | 8-step workflow: dev server → analyze/plan → content model → test content → implement → lint → validate → ship | **High** — ASC needs CDD workflow adapted for its context |
| **building-blocks** | 2.0.0 | Block dev pattern: find similar → create structure → implement JS → add CSS → test | **High** — ASC blocks should follow this workflow |
| **analyze-and-plan** | 2.0.0 | Task-specific analysis, acceptance criteria, visual analysis, edge case identification | **High** — ASC developers need acceptance criteria framework |
| **block-inventory** | 1.0.0 | Survey available blocks before making authoring decisions | **Medium** — ASC has fixed block set; less relevant for inventory but pattern is valid |
| **testing-blocks** | Implied | Browser testing, linting, unit tests (for logic-heavy utilities), screenshot validation | **Medium** — ASC has linting but no unit tests; browser testing manual |

### Supporting Skills (referenced by Adobe workflow)

| Skill | Purpose | Status |
|-------|---------|--------|
| **scrape-webpage** | Extract content, metadata, images from URLs using Playwright | Will use for theme extraction in Phase 6b |
| **da-auth** | Obtain Adobe IMS token for DA access | Relevant for pushing test content programmatically |
| **find-test-content** | Search for existing content pages containing a specific block | Relevant for test content discovery |
| **content-modeling** | Design table structure and content models | Relevant for new block design |
| **page-import** | Top-level orchestrator for page imports | Less relevant for ASC (asset browsing, not page import) |

### Reference Materials (from building-blocks)

| Document | Status | ASC Need |
|-----------|--------|----------|
| `references/js-guidelines.md` | ✓ Fetched | Yes — ASC needs JS conventions aligned to Adobe patterns |
| `references/css-guidelines.md` | ✓ Fetched | Yes — ASC CSS diverges in selectors; structural tokens are similar |

---

## 2. Authoritative Adobe Patterns — Extracted

### 2.1 The Content-Driven Development (CDD) Workflow

Adobe prescribes an 8-step process for **all** code changes:

```
Step 0: Create TodoList
Step 1: Start dev server
Step 2: Analyze & plan (with accept criteria)
Step 3: Design content model
Step 4: Identify/create test content
Step 5: Implement (via building-blocks skill)
Step 6: Lint & test
Step 7: Final validation
Step 8: Ship it (create PR with preview links)
```

**Key principle**: Content first, code second. Never write code without identifying the content you'll test against.

**ASC implication**: ASC should adopt CDD as the canonical development process, with ASC-specific guidance in steps 2–5 (content model design for ASC blocks, search form naming, QB predicates, etc.).

### 2.2 Block Development Workflow (from building-blocks)

**Essential patterns**:

| Step | Pattern | ASC Alignment |
|------|---------|---|
| **Step 1: Find similar blocks** | Search codebase for reference implementations | ✓ ASC has 24 blocks; developers should study them |
| **Step 2: Create structure** | Create `blocks/{name}/{name}.js` + `.css` | ✓ ASC follows exactly |
| **Step 3: Implement JS** | Use `decorate(block)` function, re-use existing DOM | ✓ ASC follows exactly |
| **Step 4: Add CSS** | Mobile-first, use custom properties, scope to block root | ⚠ Selector divergence: Adobe uses `main .{name}`, ASC uses `.block.{name}` |
| **Step 5: Test** | Browser testing, linting, unit tests, screenshot capture | ⚠ ASC has linting; manual browser testing; no unit tests for blocks |

**DOM re-use principle** (critical):
> "Essential pattern — re-use existing DOM elements. Platform delivers images as `<picture>` elements with `<source>` tags. Create new structure, re-using existing elements."

**ASC follows this**: Parts and blocks consistently re-use delivered DOM.

### 2.3 CSS Conventions (from building-blocks/references/css-guidelines.md)

**Adobe's prescribed pattern**:

```css
/* Selector scoped to block */
main .{block-name} { /* block styles */ }
main .{block-name} h2 { /* child */ }
main .{block-name} &.variant { /* variant */ }

/* Use CSS custom properties for all styling decisions */
color: var(--text-color);
background-color: var(--background-color);

/* Mobile-first responsive */
@media (width >= 600px) { /* tablet */ }
@media (width >= 900px) { /* desktop */ }
```

**Key tokens** (Adobe's token set):
- `--text-color`, `--background-color` (primary color role tokens)
- `--body-font-family`, `--heading-font-family`
- `--body-font-size-sm` / `--body-font-size-md` / `--body-font-size-lg`
- `--max-content-width`
- Modern CSS features: grid, logical properties, native nesting

**ASC divergence**:

| Area | Adobe pattern | ASC pattern | Justification |
|------|---|---|---|
| **Root selector** | `main .{name}` | `.block.{name}` | ASC: avoids polluting `main` namespace; enables reusable blocks across contexts |
| **Color tokens** | `--text-color`, `--background-color` | `--color-fg`, `--color-bg`, `--color-primary`, etc. (16 semantic tokens) | ASC: semantic tokens are more granular and support theming; intentional divergence |
| **Structural tokens** | Not explicitly documented | `--spacing-*`, `--border-radius-*`, `--shadow-*` | ASC: explicit structural tokens enforcing consistent design |
| **Typography** | `--body-font-size-sm/md/lg` | `--body-font-size-xs/s/m/l/xl` | Similar approach; ASC has more granularity |
| **Font family override** | In theme context | `--body-font-family` (in themes only) | Similar approach; ASC is correct |

**CSS compliance**: ASC's CSS is largely compliant with Adobe's guidance — the selector divergence is intentional and documented.

### 2.4 JavaScript Patterns (from building-blocks/references/js-guidelines.md)

**Adobe's prescribed patterns**:

1. **Essential: Re-use existing DOM**
   ```js
   const picture = block.querySelector('picture');
   const heading = block.querySelector('h2');
   const figure = document.createElement('figure');
   figure.append(picture);  // Re-use, don't replace
   ```

2. **Performance: Lazy-load modules and resources**
   - Use dynamic `import()` where practical
   - Load CSS via `loadCSS()` helper
   - Defer non-critical logic

3. **Event binding: Use `delegateEvent()` helper**
   - Global listeners instead of element-specific
   - jQuery-like `.on()` pattern from `aem.js`

4. **Variants: Check `block.classList` for CSS-only variants**
   - Only use JS when behavior differs, not just styling

5. **Error handling**: Graceful degradation
   - Missing optional fields → no error
   - Invalid content → render safely

**ASC compliance**:
- ✓ Re-uses DOM (verified in code)
- ✓ Uses `import()` for services
- ✓ Has `delegateEvent()` utility; uses data-asc-action for declarative binding
- ✓ Checks block variants correctly
- ✓ Graceful degradation throughout

---

## 3. Gap Analysis — ASC vs. Adobe Guidance

### 3.1 Critical Gaps (block implementation)

| Gap | Adobe guidance | ASC current state | Impact | Priority | Solution |
|-----|---|---|---|---|---|
| **CSS root selector alignment** | `main .{name}` | `.block.{name}` | Visual/parsing difference if both patterns in codebase | **High** | Align selectors to Adobe pattern (Phase 7: CSS migration) |
| **CDD workflow adoption** | 8-step CDD in all code changes | Not currently used | New features may skip content design, test content | **High** | Adapt CDD workflow for ASC; document in skill (Phase 5–6) |
| **Acceptance criteria framework** | analyze-and-plan skill defines criteria template | Not formally adopted | Ambiguous done-ness; hard to validate | **High** | Adopt criteria template in Phase 5 docs |
| **Test content strategy** | CDD Step 4 mandates identified test content | Ad-hoc or missing | Blocks implemented without real test data | **Medium** | Document test content discovery pattern (Phase 6) |

### 3.2 Medium Gaps (testing & validation)

| Gap | Adobe guidance | ASC current state | Impact | Priority | Solution |
|-----|---|---|---|---|---|
| **Unit tests** | Optional for logic-heavy utilities | Not implemented | No regression detection; debugging harder | **Medium** | Add unit test pattern docs (Phase 6 recipe) |
| **Browser testing framework** | testing-blocks skill (Playwright-based) | Manual | Regression risk; slow validation | **Medium** | Document browser testing checklist (Phase 6) |
| **Screenshot capture for validation** | Part of testing-blocks workflow | Manual | No automated regression detection | **Low** | Reference testing-blocks in Phase 6 |
| **Linting & code review** | Standard via ESLint/Stylelint | ✓ Implemented | — | ✓ Good | — |

### 3.3 Low Gaps (documentation & extensibility)

| Gap | Adobe guidance | ASC current state | Impact | Priority | Solution |
|-----|---|---|---|---|---|
| **Extension documentation** | block-collection-and-party skill | Not formalized | Custom blocks harder to write | **Low** | Create EXTENSION_GUIDE.md (Phase 5) |
| **Recipe collection** | Expected in skill references | Not comprehensive | Developers repeat work | **Low** | Create RECIPES.md (Phase 5) |
| **Service layer documentation** | Not in Adobe skills (EDS-specific) | ✓ AGENTS.md comprehensive | — | ✓ Good | — |
| **Cross-block communication patterns** | Not explicitly documented in Adobe skills | ✓ ASC has event system | — | ✓ Good | Document as cross-block-communication.md (Phase 6) |
| **Modal/dialog conventions** | Native `<dialog>` in Adobe examples | ✓ ASC uses `.asc-dialog` | — | ✓ Good | Document formally in modals-and-dialogs.md (Phase 6) |

---

## 4. Intentional ASC Divergences (Justified)

### 4.1 CSS Root Selector: `.block.<name>` vs. `main .{name}`

**Adobe pattern**: `main .{name}`  
**ASC pattern**: `.block.{name}`

**Justification**:
- Blocks can appear outside `<main>` (search results in a sidebar, details in a modal overlay)
- Using `main` namespace limits block reusability
- ASC philosophy: blocks are composable, context-independent UI components
- No functional difference when blocks are always in `<main>`; allows flexibility

**Decision**: Align to Adobe for consistency (Phase 7 refactoring)

### 4.2 CSS Semantic Tokens: 16 tokens vs. Adobe's simpler set

**Adobe approach**: `--text-color`, `--background-color`, `--primary-color` (fewer tokens)  
**ASC approach**: `--color-bg`, `--color-fg`, `--color-primary`, `--color-primary-fg`, `--color-secondary`, `--color-secondary-fg`, `--color-muted`, `--color-muted-fg`, `--color-accent`, `--color-accent-fg`, `--color-destructive`, `--color-destructive-fg`, `--color-border`, `--color-input`, `--color-ring`, `--color-card`, `--color-card-fg` (16 tokens)

**Justification**:
- ASC is a DAM application; needs more color roles (card surfaces, borders, inputs, distinct secondary/muted states)
- Themes can express fine-grained design intent
- Keeps structural tokens separate (never overridden in themes)
- More granular = easier to theme and maintain

**Decision**: Keep ASC semantic token set; document as intentional (in future docs)

### 4.3 Declarative Events: ASC-specific `data-asc-action`

**Adobe approach**: Not formalized in skills; EDS uses standard DOM events  
**ASC approach**: `data-asc-action="noun:verb@event"` declarative binding + Actions service

**Justification**:
- Decouples blocks from direct JS coupling
- Centralizes event routing
- Enables blocks to be added/removed without breaking interconnections
- Documented in AGENTS.md

**Decision**: Keep ASC event system; document formally in cross-block-communication.md (Phase 6)

---

## 5. Adobe Skills Applicability Matrix

| ASC Phase | Adobe Skill | How to Use | ASC Adaptation |
|-----------|-------------|-----------|---|
| Phase 1 | block-inventory | Survey available blocks | ASC: document all 24 blocks, describe purpose |
| Phase 4 | analyze-and-plan | Generate acceptance criteria | ASC: adapt template for block context |
| Phase 5 | content-driven-development | Adopt as canonical workflow | ASC: create ASC-specific step guidance |
| Phase 5 | building-blocks | Block development pattern | ASC: adapt with ASC-specific CSS/JS guidance |
| Phase 6 | building-blocks/references | JS & CSS guidelines | ASC: create ASC-specific versions |
| Phase 6b | scrape-webpage | Extract CSS from target URL | ASC: use for theme generation |

---

## 6. Recommended Actions

### Immediate (Phase 2–3 completion)
1. ✓ Review all relevant Adobe skills (this document)
2. ✓ Document gap analysis (this document)
3. Decide: implement CSS selector migration as part of Phase 7 (recommended: yes)
4. Decide: adopt CDD workflow as canonical (recommended: yes)

### Short-term (Phase 4–5)
5. Create FUTURE_STATE_ARCHITECTURE.md with architecture alignment decisions
6. Adapt CDD workflow for ASC context (Phase 5)
7. Create acceptance criteria framework for ASC blocks (Phase 5)

### Medium-term (Phase 6)
8. Create asc-development skill with Adobe-aligned guidance
9. Create asc-theme-from-website skill

### Long-term (Phase 7)
10. Migrate CSS selectors (all 24 blocks)
11. Verify no regressions

---

## Appendix: Adobe Tokens Reference (for alignment)

**Adobe's recommended token set** (from building-blocks/references/css-guidelines.md):

```css
:root {
  /* Colors */
  --text-color: #000;
  --background-color: #fff;
  --primary-color: #0078d4;
  
  /* Typography */
  --body-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --heading-font-family: var(--body-font-family);
  --body-font-size-sm: 0.875rem;
  --body-font-size-md: 1rem;
  --body-font-size-lg: 1.125rem;
  --heading-font-size-m: 1.5rem;
  --heading-font-size-l: 2rem;
  --heading-font-size-xl: 2.5rem;
  
  /* Spacing */
  --max-content-width: 1200px;
}
```

**ASC's semantic token set** (from styles/tokens.css):
- 16 `--color-*` semantic tokens
- Font families + sizes (similar granularity)
- Spacing, radius, shadow, transition tokens
- Never overridden in themes

Both approaches are valid; ASC's is more granular by design.

---

**Document compiled from Adobe skills review on June 2, 2026.**
