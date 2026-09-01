# Component-Driven Development (CDD) Workflow for ASC

ASC adopts the Adobe Component-Driven Development (CDD) methodology adapted for Edge Delivery Services context.

---

## What is CDD?

CDD is an **8-step iterative workflow** that prioritizes incremental, validated development. Instead of building everything upfront, you:
1. Define requirements & acceptance criteria
2. Design the component (content model, behavior)
3. Build HTML + CSS (no JS yet)
4. Build JavaScript interactivity
5. Integrate with services/data
6. Test on real data
7. Document
8. Deploy & iterate

CDD ensures **every step is validated before moving to the next**. It's especially valuable for EDS because there's no build step—you deploy immediately.

---

## The 8 Steps

### Step 0: Triage / Understanding

**Before you start**: Read [extension-decision.md](extension-decision.md) to understand what type of work this is.

- **Copy-modify block?** → Copy existing block, modify CSS/content model
- **New block?** → Follow steps 1–8
- **New service?** → Design the API first (step 2)
- **Custom property?** → Register in `configurations.js` (no CDD needed)
- **Custom theme?** → Create CSS file, configure (no CDD needed)

---

### Step 1: Define Requirements

Write down what the component should do, not how. Include:
- **User stories**: "As a [user], I want [action] so that [outcome]"
- **Acceptance criteria**: "Given [context], when [action], then [result]"
- **Content model**: What data does this component display?
- **Responsive behavior**: How does it change on mobile/tablet/desktop?
- **Accessibility**: Keyboard navigation? Screen reader labels?
- **Performance**: Does it load async? Preload? Cache?

**Example** (Search Results Block):

```
User Story:
  As a user, I want to see search results in a grid
  so that I can quickly scan and preview assets

Acceptance Criteria:
  Given search returns 10 assets
  When the page loads
  Then all 10 assets are displayed in a responsive grid
  
  Given I'm on mobile (< 768px)
  When the page loads
  Then grid shows 1 column
  
  Given I'm on desktop (>= 1024px)
  When the page loads
  Then grid shows 3 columns
  
Content Model:
  For each asset, show: thumbnail, title, file-type, file-size
  
Accessibility:
  - Each asset card is keyboard-focusable
  - Alt text on images
  - Semantic HTML: <article> for each card

Performance:
  - Lazy-load images (native browser)
  - Render max 50 results per page, load more on scroll
```

---

### Step 2: Design the Component

Sketch the **structure**, **content model**, and **behavior**. Not pixel-perfect—conceptual.

#### Content Model (da.live)

What does an author configure?

```
Block name: search-results
Properties:
  | itemsPerPage | 20 | How many results to show initially |
  | viewMode     | cards | cards | masonry | list |
  | sortBy       | relevance | Sorting order |
```

#### HTML Structure

What does the markup look like?

```html
<div class="block search-results">
  <div class="search-results__grid" data-view="cards">
    <article class="search-results__item" data-asc-asset="uuid">
      <img src="..." alt="...">
      <h3>Asset Title</h3>
      <p>File Type</p>
      <p>File Size</p>
      <button data-asc-action="asset:details:open@click">View Details</button>
    </article>
    <!-- More items... -->
  </div>
  <button class="search-results__load-more">Load More</button>
</div>
```

#### Behavior (State Machine)

What are the component's states?

```
States:
  - idle (no search yet)
  - loading (search in progress)
  - complete (results displayed)
  - error (search failed)
  - no-results (search returned empty)

Transitions:
  idle -> loading (on asc:search:execute)
  loading -> complete (on asc:search:complete with assets)
  loading -> no-results (on asc:search:complete without assets)
  loading -> error (on asc:search:error)
  * -> idle (user clears filters)
```

#### Wireframe / Sketch

Draw a simple box diagram (use pencil, whiteboard, or Figma):

```
┌─────────────────────────────┐
│  Search Results (20 items)  │
├─────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │ ⊞ img│ │ ⊞ img│ │ ⊞ img│ │  Cards view
│ │ Title │ │ Title │ │ Title │ │
│ │ 1.2 MB│ │ 2.3 MB│ │ 3.5 MB│ │
│ └─────┘ └─────┘ └─────┘   │
│ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │ ⊞ img│ │ ⊞ img│ │ ⊞ img│ │
│ └─────┘ └─────┘ └─────┘   │
├─────────────────────────────┤
│       [Load More Results]    │
└─────────────────────────────┘
```

---

### Step 3: Build HTML + CSS (No JS)

Create a **static HTML file** with all the CSS. No JavaScript, no data binding—just markup and styles.

**File**: `blocks/search-results/search-results-static.html` (temporary, for design review)

```html
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="search-results.css">
  </head>
  <body>
    <main>
      <div class="block search-results search-results--loaded">
        <div class="search-results__grid search-results__grid--cards">
          <article class="search-results__item">
            <img class="search-results__thumbnail" src="https://..." alt="Asset title">
            <h3 class="search-results__title">Asset Title</h3>
            <dl class="search-results__meta">
              <dt>Type</dt>
              <dd>JPEG</dd>
              <dt>Size</dt>
              <dd>1.2 MB</dd>
            </dl>
            <button class="btn btn--primary btn--sm">View Details</button>
          </article>
          
          <article class="search-results__item">
            <!-- Repeat -->
          </article>
        </div>
        
        <button class="search-results__load-more btn btn--secondary">Load More</button>
      </div>
    </main>
  </body>
</html>
```

**CSS** (`blocks/search-results/search-results.css`):

```css
.block.search-results {
  padding: var(--spacing-lg);
}

.search-results__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.search-results__item {
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-m);
  padding: var(--spacing-md);
  text-align: center;
  transition: box-shadow var(--transition-normal);
}

.search-results__item:hover {
  box-shadow: var(--shadow-md);
}

.search-results__thumbnail {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: var(--border-radius-m);
  margin-bottom: var(--spacing-md);
}

.search-results__title {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--heading-font-size-s);
}

/* ... more styles ... */
```

**Validation**:
- [ ] Open static HTML in browser
- [ ] Looks good on mobile, tablet, desktop
- [ ] Matches design requirements
- [ ] Get design review/approval
- [ ] CSS applies tokens correctly (no hardcoded colors)

---

### Step 4: Add JavaScript Interactivity

Now wire up the JS. Start with event listeners and DOM manipulation. No services yet.

**File**: `blocks/search-results/search-results.js`

```js
export default function decorate(block) {
  const config = readBlockConfig(block);
  const grid = block.querySelector('.search-results__grid');
  const loadMore = block.querySelector('[data-load-more]');
  
  let offset = 0;
  
  // Listen for search completion
  document.addEventListener('asc:search:complete', (e) => {
    const { results } = e.detail;
    const { assets, more } = results;
    
    // Update grid
    if (assets.length === 0) {
      grid.innerHTML = '<p>No results</p>';
      loadMore.style.display = 'none';
    } else {
      grid.innerHTML = assets.map(asset => renderAsset(asset)).join('');
      loadMore.style.display = more ? 'block' : 'none';
    }
    
    // Update offset for pagination
    offset = results.offset + results.size;
  });
  
  // Load more button
  loadMore.addEventListener('click', () => {
    // Trigger search with new offset (for pagination)
    document.dispatchEvent(new CustomEvent('asc:search:execute', {
      detail: { offset }
    }));
  });
}

function renderAsset(asset) {
  return `
    <article class="search-results__item" data-asc-asset="${asset.uuid}">
      <img src="${asset.thumbnail}" alt="${asset.title}">
      <h3>${asset.title}</h3>
      <p>${asset.fileType}</p>
      <button class="btn btn--primary btn--sm">View</button>
    </article>
  `;
}
```

**Validation**:
- [ ] Events fire (check console)
- [ ] DOM updates when search completes
- [ ] Load More button works (pagination)
- [ ] No errors in console
- [ ] No hardcoded data (all dynamic)

---

### Step 5: Integrate with Services & Data

Now fetch **real data** from services. Use actual assets, not mock data.

```js
import services from '../../scripts/asc/core/services/services.js';

export default async function decorate(block) {
  // ... same as Step 4, but now fetch real assets ...
  
  document.addEventListener('asc:search:complete', async (e) => {
    const { results } = e.detail;
    const { assets, more } = results;
    
    // Render using actual asset properties
    grid.innerHTML = assets.map(asset => `
      <article class="search-results__item" data-asc-asset="${asset.uuid}">
        <img 
          src="${asset.getProperty('thumbnail')}"
          alt="${asset.getProperty('title')}"
          loading="lazy"
        >
        <h3>${asset.getProperty('title') ?? 'Untitled'}</h3>
        <dl class="search-results__meta">
          <dt>Type</dt>
          <dd>${asset.getProperty('file-type') ?? '—'}</dd>
          <dt>Size</dt>
          <dd>${asset.getProperty('file-size') ?? '—'}</dd>
        </dl>
        <button 
          class="btn btn--primary btn--sm"
          data-asc-action="asset:details:open@click"
        >
          View Details
        </button>
      </article>
    `).join('');
  });
}
```

**Validation**:
- [ ] Real assets load from AEM
- [ ] Asset properties display correctly (no "undefined")
- [ ] Null safety: missing properties show `—` or default
- [ ] Images load (check Network tab)
- [ ] Pagination works with real data
- [ ] Performance acceptable (no slow requests)

---

### Step 6: Test on Real Data

Test the component against actual AEM data in realistic scenarios.

**Test Cases**:

```
✓ Search with 0 results → shows "No results"
✓ Search with 1 result → displays 1 asset, no "Load More"
✓ Search with 50 results → displays 20, "Load More" shown
✓ Click "Load More" → displays next 20
✓ Click asset → opens details modal
✓ Mobile (375px) → 1 column
✓ Tablet (768px) → 2 columns
✓ Desktop (1024px) → 3 columns
✓ Keyboard: Tab through items → focus visible
✓ Screen reader: announces "article" elements
✓ Search errors → shows error message
✓ No search yet → shows empty state or message
✓ Filter → re-renders with new results
```

**Testing Steps**:
1. Start dev server: `aem up`
2. Perform various searches
3. Test responsive behavior (DevTools device mode)
4. Test keyboard navigation (Tab key)
5. Check console for errors
6. Check Network tab for performance

---

### Step 7: Document

Add JSDoc comments, authoring guide, and examples.

```js
/**
 * search-results — Display search results in a responsive grid.
 * 
 * Authoring (da.live):
 *   | property      | value           | Description |
 *   | itemsPerPage  | 20              | Results per page |
 *   | viewMode      | cards (default) | cards | masonry | list |
 *   | sortBy        | relevance       | Sort order |
 * 
 * Listens to:
 *   - asc:search:complete — fetches new results
 *   - asc:search:error — shows error message
 * 
 * Dispatch:
 *   - (none — communicates via DOM updates)
 * 
 * Dependencies:
 *   - readBlockConfig from scripts/aem.js
 *   - services from scripts/asc/core/services/services.js
 * 
 * @author Your Name
 * @since 2026-06
 * @requires readBlockConfig, services
 * @example
 * // da.live table:
 * // | itemsPerPage | 30 |
 * // | viewMode | masonry |
 * 
 * // Renders results in masonry layout, 30 per page
 */

export default function decorate(block) { ... }
```

**Documentation**:
- [ ] JSDoc comments added
- [ ] Authoring model documented
- [ ] Event listeners documented
- [ ] Dependencies listed
- [ ] Example usage shown
- [ ] Troubleshooting tips added

---

### Step 8: Deploy & Iterate

Deploy the component to production and gather feedback.

**Before Deploying**:
- [ ] ESLint passes: `npm run lint:js`
- [ ] Styles pass: `npm run lint:css`
- [ ] Console has no errors or warnings
- [ ] Performance is acceptable
- [ ] Accessibility is tested
- [ ] Code is reviewed by a peer

**After Deploying**:
- [ ] Monitor for errors (Sentry, logs)
- [ ] Gather user feedback
- [ ] Track performance (Core Web Vitals)
- [ ] Iterate based on feedback → return to Step 1

---

## CDD Checklist

Use this for every new component:

```
[ ] Step 0: Triage — understand what type of work this is
[ ] Step 1: Requirements — user stories, acceptance criteria
[ ] Step 2: Design — content model, HTML structure, state machine
[ ] Step 3: HTML + CSS — static page, design review
[ ] Step 4: JavaScript — interactivity, events, DOM updates
[ ] Step 5: Services — real data, AEM integration
[ ] Step 6: Testing — real data, responsive, accessibility
[ ] Step 7: Documentation — JSDoc, authoring guide, troubleshooting
[ ] Step 8: Deploy — lint, peer review, deploy, monitor
```

---

## CDD in Practice

### Example 1: Create a New Search Filter

**Step 0**: This is a "new block" (search-color-filter).

**Step 1**: 
```
User Story: Filter assets by color (red, blue, green, yellow)
Acceptance: Show checkboxes, user selects colors, search re-runs
Content: List of color options from a QB property (dam:color)
```

**Step 2**: HTML + state machine sketch

**Step 3**: Static HTML with CSS

**Step 4**: Add JS — checkboxes → `asc:search:execute`

**Step 5**: Integrate with QB field names, test search

**Step 6**: Test with real colored assets

**Step 7**: Document QB field mapping

**Step 8**: Deploy

### Example 2: Modify Existing Block

**Step 0**: This is a "copy-modify" task.

**Step 1**: Requirement: "Add file-size to search-results display"

**Step 2**: Add file-size to HTML; add CSS for new column

**Step 3**: Update static HTML and CSS

**Step 4**: Add JS to fetch file-size property

**Step 5**: Test with real assets

**Step 6**: No new step — already tested

**Step 7**: Update JSDoc

**Step 8**: Deploy

### Example 3: New Service

**Step 0**: This is a "new service" task.

**Step 1**: Requirement: "Cache search results to reduce API calls"

**Step 2**: Design the API:
```js
await cache.get(key)
await cache.set(key, value)
cache.clear()
cache.settings.ttl = 5 * 60 * 1000  // 5 minutes
```

**Step 3-4**: Build service class with unit tests

**Step 5**: Integrate into SearchService

**Step 6-8**: Test, document, deploy

---

## Key Principles

**1. Validate Early, Iterate Often**
Don't wait until Step 8 to test. Get feedback at Steps 3, 5, 6.

**2. Incremental Development**
Each step builds on the previous one. Don't skip steps.

**3. Real Data, Real Users**
Step 6 tests with actual AEM data. Mock data doesn't count.

**4. Documentation Over Comments**
Write code that's obvious, then document why (not what).

**5. Accessibility First**
Don't add accessibility last—include it from Step 2.

**6. Responsive by Default**
Mobile-first CSS in Step 3, not bolted on later.

**7. Performance Matters**
Test performance at Step 5; lazy-load, cache, debounce.

---

## When to Deviate

- **Design system component**: More emphasis on Step 2 (design)
- **High-performance critical**: Add performance testing at Step 5
- **Accessibility-critical**: Add WCAG testing at Step 6
- **Bug fix**: Start at Step 4 (you know what's broken)
- **Tiny config change**: Skip to Step 7 (document only)

---

See: [extension-decision.md](extension-decision.md) for what type of work you're doing.
