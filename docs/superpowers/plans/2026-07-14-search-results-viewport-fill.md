# Search Results Viewport Fill & Pagination Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix search-results infinite scroll so it reliably fills the viewport (not just one round), add an authorable "No more results" bar, and move search-results display mode from URL+localStorage to localStorage-only.

**Architecture:** All changes live in two user-owned blocks, `blocks/search-results/search-results.js`/`.css` and `blocks/search-bar/search-bar.js`. No changes to `scripts/asc/core/**` (ASC Core). The existing `asc:search:execute` / `asc:search:complete` event contract (owned by core `SearchService`) is unchanged — every fix works by changing how the user-owned blocks react to those events and what they put in the DOM/URL/localStorage.

**Tech Stack:** Vanilla ES modules (AEM Edge Delivery Services), no build step, no JS test runner in this repo (only `eslint`/`stylelint` via `npm run lint`). Verification is manual, via the local `aem up` dev server and browser devtools, per this project's established convention (see CLAUDE.md: "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete").

## Global Constraints

- Do not modify anything under `scripts/asc/core/**` — every file there starts with `// ASC Core — do not edit.`
- Reuse the existing `.asc-ui-badge` UI Kit primitive for the "No more results" bar — do not add a new kit primitive or bespoke badge-like CSS (see `docs/UI_KIT.md` catalog, confirmed during design that no better-fitting primitive exists).
- JS: 2-space indent, airbnb-base ESLint (`npm run lint:js`). CSS: 4-space indent, stylelint-config-standard (`npm run lint:css`), root selector `.block.search-results { ... }` with CSS nesting.
- No new localStorage/URL keys beyond what's specified — display mode continues to use the existing key `asc.search-results.display`.
- Docs (`asc-eds-docs` repo, `blocks.md`) must not use em-dashes or other "AI-tell" phrasing — plain punctuation only (standing preference for that repo).
- Only update `asc-eds-docs` after the manual verification task (Task 4) passes — do not document unverified behavior.

---

### Task 1: Fix the viewport-fill loop in search-results.js

**Files:**
- Modify: `blocks/search-results/search-results.js:9-10` (module-scope constants)
- Modify: `blocks/search-results/search-results.js:230-258` (`addEventListeners` / `setupSentinel`)
- Modify: `blocks/search-results/search-results.js:317-328` (tail of the `asc:search:complete` handler)

**Interfaces:**
- Produces: two new closures inside `addEventListeners` — `requestLoadMore()` (dispatches the existing `asc:search:execute` / `{ type: 'load-more' }` event, sets `isLoadingMore = true`) and `sentinelNearViewport()` (returns `boolean`, true when the sentinel element's top is within `FILL_LEAD_PX` of the viewport bottom). A closure variable `fillRounds` (number, reset to `0` on every non-`load-more` complete event). Task 2 and Task 3 do not depend on these directly, but Task 2's edit lands inside the same `asc:search:complete` handler, after this task's edit.

- [ ] **Step 1: Reproduce the bug on the dev server**

  Run: `aem up` (starts the local proxy at `http://localhost:3000`).

  Open `http://localhost:3000/` in a browser at a tall viewport (devtools → toggle device toolbar → responsive, set to e.g. 1920x1400, or simply maximize a tall monitor window). Run a fulltext search with enough matching assets to span more than one page (`limit` defaults to 24). Confirm the bug: after the page finishes its network calls (watch the Network tab for `querybuilder.json` / OpenAPI search requests), there is visible empty space below the last row of results and above the footer, even though more results exist. This confirms the IntersectionObserver-transition bug described in the spec (`docs/superpowers/specs/2026-07-14-search-results-viewport-fill-design.md`).

- [ ] **Step 2: Add the fill-lead constant and bump `rootMargin`**

  In `blocks/search-results/search-results.js`, after the existing constants:

  ```js
  const MASONRY_SIZES = '(min-width: 1400px) 25vw, (min-width: 1000px) 33vw, (min-width: 640px) 50vw, 100vw';
  const MASONRY_COL_WIDTH = 360; // target column width — smaller value = more columns at wider viewports
  const FILL_LEAD_PX = 1200; // how far below the viewport bottom triggers a load, in px
  const MAX_AUTO_FILL_ROUNDS = 50; // safety cap on consecutive auto-triggered loads per fresh search
  ```

- [ ] **Step 3: Replace `addEventListeners`'s sentinel/observer setup**

  Replace the current `addEventListeners` opening block (from `let isLoadingMore = false;` through the closing of `setupSentinel`, i.e. current lines 233-258):

  ```js
  let isLoadingMore = false;
  let sentinel = null;
  let observer = null;
  let fillRounds = 0;

  function requestLoadMore() {
    isLoadingMore = true;
    document.dispatchEvent(new CustomEvent('asc:search:execute', {
      detail: { type: 'load-more' },
    }));
  }

  function sentinelNearViewport() {
    if (!sentinel) return false;
    return sentinel.getBoundingClientRect().top < window.innerHeight + FILL_LEAD_PX;
  }

  function setupSentinel() {
    // Create a sentinel element just below the results; IntersectionObserver
    // triggers load-more when it enters the viewport instead of polling on scroll.
    if (sentinel) return;

    sentinel = document.createElement('div');
    sentinel.className = 'search-results__sentinel';
    block.querySelector('[data-asc-results]').after(sentinel);

    observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      const moreInput = block.querySelector('[name="asc.search-results.more"]');
      if (!moreInput || moreInput.value === 'false' || isLoadingMore) return;

      // A real user scroll is always a fresh not-intersecting -> intersecting
      // transition, so it always gets its own fill budget.
      fillRounds = 0;
      requestLoadMore();
    }, { rootMargin: `${FILL_LEAD_PX}px 0px` });

    observer.observe(sentinel);
  }
  ```

- [ ] **Step 4: Replace the tail of the `asc:search:complete` handler**

  Replace the current tail (current lines 317-328):

  ```js
      isLoadingMore = false;
      setupSentinel();  // no-op after first call; observer handles subsequent loads

      // After a page-load search (filter change, new query), the IntersectionObserver
      // only fires on transitions. If the sentinel was already visible before the new
      // (potentially shorter) results rendered, no transition occurs and load-more
      // would never fire. Re-observe to force immediate re-evaluation.
      if (event.detail.type !== 'load-more' && sentinel && observer) {
        observer.unobserve(sentinel);
        observer.observe(sentinel);
      }
    });
  ```

  with:

  ```js
      isLoadingMore = false;
      setupSentinel(); // no-op after first call; observer handles further scroll-driven loads

      if (event.detail.type !== 'load-more') fillRounds = 0;

      // IntersectionObserver only fires on a not-intersecting -> intersecting transition.
      // If a page of results doesn't fill the viewport, the sentinel stays continuously
      // intersecting across appends and the observer never fires again on its own. Measure
      // directly and keep requesting more until the viewport is satisfied, results run out,
      // or the safety cap is hit.
      if (results.more && fillRounds < MAX_AUTO_FILL_ROUNDS && sentinelNearViewport()) {
        fillRounds += 1;
        requestLoadMore();
      }
    });
  ```

  Note `results` is already destructured at the top of this handler (`const { results } = event.detail;`), so it's in scope here unchanged.

- [ ] **Step 5: Lint**

  Run: `npm run lint:js`
  Expected: no new errors in `blocks/search-results/search-results.js`.

- [ ] **Step 6: Manually confirm the fix**

  Reload `http://localhost:3000/` at the same tall viewport and repeat the search from Step 1. Confirm results now keep auto-loading (watch the Network tab: multiple `querybuilder.json`/search requests fire in quick succession with no user scrolling) until either the viewport is fully filled or the "No more results" condition is reached (there is no visible bar yet — that's Task 2 — but the network tab / `asc.search-results.more` hidden input, inspectable via devtools Elements panel, should read `"false"` once results are exhausted). Also scroll further down manually on a search with many more pages and confirm loading continues smoothly with no visible pop-in near the bottom of the viewport (the bigger `1200px` lead should load well before you reach the current end).

- [ ] **Step 7: Commit**

  ```bash
  git add blocks/search-results/search-results.js
  git commit -m "Fix search-results infinite scroll to reliably fill the viewport"
  ```

---

### Task 2: Authorable "No more results" bar

**Files:**
- Modify: `blocks/search-results/search-results.js:202-205` (block config defaults)
- Modify: `blocks/search-results/search-results.js:219-228` (`html()` template)
- Modify: `blocks/search-results/search-results.js` (inside the `asc:search:complete` handler, right after the `more`/`total` hidden-input updates — the two lines Task 1 left unchanged, currently around what was originally lines 269-270)
- Modify: `blocks/search-results/search-results.css:1-8` (add footer styling near the existing `.search-results__sentinel` rule)

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: a `.search-results__end` element (sibling of `[data-asc-results]` and `.search-results__sentinel`), toggled via its `hidden` attribute. No other task depends on this.

- [ ] **Step 1: Add the authorable config default**

  In `decorate()`, change:

  ```js
  const config = readBlockConfig(block, {}, {
    'asc.search-results.display': 'masonry',
    limit: 100,
  });
  ```

  to:

  ```js
  const config = readBlockConfig(block, {}, {
    'asc.search-results.display': 'masonry',
    limit: 100,
    'no-more-results-text': 'No more results',
  });
  ```

  (EDS's `readBlockConfig` lowercases and dashes authored row labels, so an authored da.live row like `No More Results Text` maps to the `no-more-results-text` key — consistent with how `limit` and other keys are already authored.)

- [ ] **Step 2: Render the footer element**

  Change the `html()` function from:

  ```js
  function html(config) {
    return `
      <input type="hidden" name="p.limit" value="${config.limit || 24}" form="${SEARCH_FORM}"/>
      <input type="hidden" name="p.offset" value="0" form="${SEARCH_FORM}"/>
      <input type="hidden" name="asc.search-results.more" value="true"/>
      <input type="hidden" name="asc.search-results.total" value="0"/>

      <div data-asc-results data-loading></div>
    `;
  }
  ```

  to:

  ```js
  function html(config) {
    return `
      <input type="hidden" name="p.limit" value="${config.limit || 24}" form="${SEARCH_FORM}"/>
      <input type="hidden" name="p.offset" value="0" form="${SEARCH_FORM}"/>
      <input type="hidden" name="asc.search-results.more" value="true"/>
      <input type="hidden" name="asc.search-results.total" value="0"/>

      <div data-asc-results data-loading></div>
      <p class="search-results__end" hidden>
        <span class="asc-ui-badge">${esc(config['no-more-results-text'])}</span>
      </p>
    `;
  }
  ```

  (`esc()` is already defined earlier in this file at line 46 and used elsewhere for authored/asset-derived text.)

- [ ] **Step 3: Toggle the footer's visibility**

  In the `asc:search:complete` handler, right after the two lines that update the `more`/`total` hidden inputs:

  ```js
    block.querySelector('[name="asc.search-results.more"]').value = results.more;
    block.querySelector('[name="asc.search-results.total"]').value = results.total || 0;
  ```

  add:

  ```js
    const endEl = block.querySelector('.search-results__end');
    endEl.hidden = results.more || !(results.total > 0);
  ```

  This hides the bar whenever more results remain, and also whenever the total is `0` (the separate "No results found" empty state already covers that case).

- [ ] **Step 4: Style the footer**

  In `blocks/search-results/search-results.css`, add right after the existing `.search-results__sentinel` rule:

  ```css
      .search-results__sentinel {
          height: 1px;
          visibility: hidden;
      }

      .search-results__end {
          display: flex;
          justify-content: center;
          margin-block: var(--spacing-xl) 0;
      }

      .search-results__end[hidden] {
          display: none;
      }
  ```

- [ ] **Step 5: Lint**

  Run: `npm run lint`
  Expected: no new JS or CSS errors.

- [ ] **Step 6: Manually confirm**

  On `http://localhost:3000/`, run a search with a small number of matching results (fewer than one page, e.g. a narrow fulltext term) and scroll to the end. Confirm the "No more results" badge appears centered below the results. Then run a broad search with many results and confirm the badge stays hidden (`hidden` attribute present, inspect via devtools) until you've scrolled through every page. Change the block's authored config (temporarily, in a scratch da.live section or by editing the `no-more-results-text` default in a local test) to confirm the text is genuinely authorable — reverting the default value change afterward is not necessary since `'No more results'` is the intended shipped default.

- [ ] **Step 7: Commit**

  ```bash
  git add blocks/search-results/search-results.js blocks/search-results/search-results.css
  git commit -m "Add authorable No more results bar to search-results"
  ```

---

### Task 3: Move display mode to localStorage-only

**Files:**
- Modify: `blocks/search-bar/search-bar.js:88-91` (hydration priority)
- Modify: `blocks/search-bar/search-bar.js:124` (display `<select>` markup)
- Modify: `blocks/search-results/search-results.js:212-213` (initial `data-display` read)

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: no new exports; this task only changes where two blocks read/write the existing `asc.search-results.display` key. `search-results.js`'s `getDisplayMode()` (unchanged, looks up `[name="asc.search-results.display"]` by attribute, not form membership) continues to work unmodified.

- [ ] **Step 1: Stop writing/reading the display mode via the URL in search-bar.js**

  Change:

  ```js
  // Priority: URL param > localStorage > first authored option
  const params = new URLSearchParams(window.location.search);
  const display    = params.get(LS_DISPLAY)    || localStorage.getItem(LS_DISPLAY)    || viewOptions[0].value;
  const orderby    = params.get('orderby')      || localStorage.getItem(LS_ORDERBY)    || sortOptions[0].value;
  const orderbySort= params.get('orderby.sort') || localStorage.getItem(LS_ORDERBY_SORT) || orderOptions[0].value;
  ```

  to:

  ```js
  // Display mode: localStorage only, never part of the shareable URL.
  // Sort/order: URL param > localStorage > first authored option (unchanged).
  const params = new URLSearchParams(window.location.search);
  const display    = localStorage.getItem(LS_DISPLAY) || viewOptions[0].value;
  const orderby    = params.get('orderby')      || localStorage.getItem(LS_ORDERBY)    || sortOptions[0].value;
  const orderbySort= params.get('orderby.sort') || localStorage.getItem(LS_ORDERBY_SORT) || orderOptions[0].value;
  ```

  (`params` stays, since `orderby`/`orderby.sort` still read it, and it's also used further down in `html()` for the fulltext input's initial value.)

- [ ] **Step 2: Detach the display `<select>` from the shared search form**

  In the `html()` function, change:

  ```js
        <select name="asc.search-results.display" form="${SEARCH_FORM}" aria-label="View">
  ```

  to:

  ```js
        <select name="asc.search-results.display" aria-label="View">
  ```

  Leave the `orderby` and `orderby.sort` `<select>` elements' `form="${SEARCH_FORM}"` attributes unchanged — only display mode moves out of the form. This is what stops the core `collectFormData()`/`buildParams()`/`updateBrowserUrl()` pipeline (all in `scripts/asc/core/services/search/search.js`, unmodified) from ever including this field in the network request or the written-back URL, without touching any core file.

- [ ] **Step 3: Read the initial display mode from localStorage in search-results.js**

  Change:

  ```js
    const params = new URLSearchParams(window.location.search);
    block.querySelector('[data-asc-results]').dataset.display = params.get('asc.search-results.display') || config['asc.search-results.display'] || 'masonry';
  ```

  to:

  ```js
    block.querySelector('[data-asc-results]').dataset.display = localStorage.getItem('asc.search-results.display') || config['asc.search-results.display'] || 'masonry';
  ```

  Removing the `params` declaration entirely here (not just its usage) — it was only used on this one line in `decorate()`, and leaving it declared-but-unused would fail `npm run lint:js` (airbnb-base `no-unused-vars`).

- [ ] **Step 4: Lint**

  Run: `npm run lint:js`
  Expected: no errors (specifically, no `no-unused-vars` on `params` in `search-results.js`).

- [ ] **Step 5: Manually confirm**

  On `http://localhost:3000/`, switch the view control to "List", then reload the page. Confirm:
  - The URL bar never gains an `asc.search-results.display=list` param (inspect the address bar after the switch and after any subsequent filter change).
  - The list view persists across the reload (read from `localStorage`, inspect via devtools Application tab → Local Storage → key `asc.search-results.display`).
  - Switching to "Masonry", then changing an unrelated filter (e.g. a property checkbox), keeps the display mode as masonry (i.e. the localStorage value isn't clobbered by a filter-triggered search).

- [ ] **Step 6: Commit**

  ```bash
  git add blocks/search-bar/search-bar.js blocks/search-results/search-results.js
  git commit -m "Move search-results display mode to localStorage only"
  ```

---

### Task 4: Full manual verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Lint the whole repo**

  Run: `npm run lint`
  Expected: exits `0`, no errors.

- [ ] **Step 2: Verify viewport fill on initial load**

  `aem up`, open `http://localhost:3000/` at a tall viewport (≥1400px tall), run a broad fulltext search with well over 100 matching assets. Confirm the results fill the viewport with no visible gap, and that this happens automatically with zero manual scrolling (watch the Network tab: several search requests fire back-to-back immediately after page load, then stop once the viewport is filled).

- [ ] **Step 3: Verify filter-change reset + refill**

  With results already loaded from Step 2, toggle a `search-property`/`search-tags` filter checkbox. Confirm: the results grid is fully replaced (not appended to — check that the total result count, in the `asc.search-results.total` hidden input via devtools, drops to the new filtered count), and the fresh set of results also fills the viewport automatically (same auto-load behavior as Step 2, not just a single page).

- [ ] **Step 4: Verify URL-driven hydration**

  From the state at the end of Step 3, copy the current URL (it should contain the group-scoped filter param(s) `updateBrowserUrl` wrote, e.g. `..._group.property=...`). Open that URL in a new tab. Confirm: the same filter checkbox appears already checked, the same result set loads, and it fills the viewport the same way.

- [ ] **Step 5: Verify "No more results" bar**

  Run a narrow search that returns fewer than the `limit` (default 24) results. Confirm the "No more results" badge appears at the bottom, showing the default text "No more results", and that it does not appear at all for the zero-results case (confirm the existing "No results found" empty state shows instead).

- [ ] **Step 6: Verify display mode is localStorage-only**

  Repeat Task 3 Step 5's checks end to end once more, now against the fully assembled set of changes (all three tasks applied together), to catch any interaction effects between the fill loop and the display-mode change (e.g. switching display mode while results are still auto-loading should not throw a console error — check the browser console for errors during this whole pass).

- [ ] **Step 7: No commit for this task**

  This task only verifies; it produces no file changes. If any check above fails, fix the relevant Task 1-3 code, re-run `npm run lint`, and amend that task's commit (or add a small follow-up commit) before proceeding to Task 5.

---

### Task 5: Update the gh-pages docs

**Files:**
- Modify: `/Users/davidg/Code/asc-eds-docs/blocks.md:96-127` (`search-bar` section)
- Modify: `/Users/davidg/Code/asc-eds-docs/blocks.md:274-303` (`search-results` section)

**Interfaces:** none (documentation only).

- [ ] **Step 1: Update the `search-bar` section's priority note**

  In `/Users/davidg/Code/asc-eds-docs/blocks.md`, find:

  ```md
  Priority for the active view/sort/order on load: **URL param > localStorage > first authored option.**
  ```

  Replace with:

  ```md
  Priority for the active sort/order on load: **URL param > localStorage > first authored option.** The display mode (view) is different: it is stored in `localStorage` only and never appears in the URL, so switching views doesn't change the shareable link.
  ```

- [ ] **Step 2: Update the `search-results` section**

  Find the block (currently lines 274-303, starting `## search-results {#search-results}` through the `---` separator) and replace its body (keep the heading and the existing screenshot/caption lines as-is) with updated config table and new prose describing the fill behavior and the new config key. Specifically:

  - Add a row to the config table:

    ```md
    | `no-more-results-text` | `No more results` | Text shown in the badge once every result has loaded |
    ```

  - Add a new paragraph after the "Display modes" table and before "Card/list/masonry columns are controlled by...":

    ```md
    **Viewport fill:** search-results auto-loads additional pages as needed until the viewport is filled or there are no more results, not just one page at a time. It also keeps loading further as you scroll, well before you reach the current bottom, so there's no visible pop-in. Once every matching result has loaded, a small "No more results" badge appears below the last row.
    ```

  - Update the existing line "Supports four layout modes — the active mode and sort/order are controlled by `search-bar`, not by config on this block." to also mention persistence, since this is where a reader would look for it:

    ```md
    **Search** · Renders the asset grid or list. Listens to `asc:search:complete` and renders asset teasers. Supports four layout modes — the active mode is controlled by `search-bar`'s view control and persisted in `localStorage` (never the URL); sort/order are also controlled by `search-bar`.
    ```

- [ ] **Step 3: Grep for em-dashes in the touched sections**

  Run: `grep -n "—" /Users/davidg/Code/asc-eds-docs/blocks.md`
  Expected: no new hits inside the `search-bar`/`search-results` sections you just edited (pre-existing hits elsewhere in the file, if any, are out of scope for this task).

- [ ] **Step 4: Build the docs site**

  Run (from `/Users/davidg/Code/asc-eds-docs`): `bundle exec jekyll build`
  Expected: clean build, no warnings.

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/davidg/Code/asc-eds-docs
  git add blocks.md
  git commit -m "Document search-results viewport-fill behavior and no-more-results config"
  ```
