# Search Results — Viewport Fill & Pagination Cleanup — Design Spec

**Date:** 2026-07-14
**Status:** Approved

---

## Intent & Purpose

Search results currently stop loading before they fill the visible viewport, even when more
results exist. This spec fixes the underlying cause and tightens three related loose ends in the
same code path: an authorable end-of-results message, confirmation that filter changes and
URL-driven page loads refill correctly, and removing the search-results display mode from the
shareable URL in favor of `localStorage` only.

All changes are scoped to user-owned files (`blocks/search-bar/`, `blocks/search-results/`).
`scripts/asc/core/services/search/search.js` and the provider files are ASC Core (`// ASC Core —
do not edit.`) and are not touched.

---

## Root Cause

`blocks/search-results/search-results.js` already implements infinite scroll: a sentinel `<div>`
after the results container, observed via `IntersectionObserver({ rootMargin: '600px 0px' })`.
When the sentinel intersects, it dispatches `asc:search:execute` with `type: 'load-more'`.

`IntersectionObserver` only invokes its callback on a **transition** (not-intersecting →
intersecting), not on "still intersecting." The existing code works around this once per fresh
search by calling `observer.unobserve(sentinel); observer.observe(sentinel);` after render, which
forces one re-evaluation. But if that single re-evaluation triggers a load-more round that *still*
doesn't fill the viewport, nothing fires again — the sentinel was already intersecting before and
after the append, so no transition occurs. Results stop loading well short of a full viewport on
tall screens or narrow/short result sets.

---

## Fix 1 — Explicit Fill Loop

Replace reliance on the observer transition (for the fill case) with a direct measurement,
performed after every `asc:search:complete` render (both fresh search and `load-more`):

```js
function shouldKeepFilling(sentinelEl, more) {
  if (!more || !sentinelEl) return false;
  const rect = sentinelEl.getBoundingClientRect();
  return rect.top < window.innerHeight + FILL_LEAD_PX;
}
```

If `shouldKeepFilling()` is true and a load isn't already in flight, immediately dispatch another
`asc:search:execute` with `type: 'load-more'` — the same event the observer would dispatch,
just triggered synchronously from render instead of waiting on a transition. This becomes the
primary fill mechanism for "did this page of results fill the viewport" (initial load, filter
reset, URL-driven load); the `IntersectionObserver` remains in place and continues to own genuine
user-scroll-driven loading further down the page (a real scroll is always a transition, so it's
unaffected by the bug above).

A hard iteration cap (e.g. 50 rounds per fresh search) guards against a pathological case where
`more` never turns false — not expected in practice, but cheap insurance against a runaway loop.

**Lead distance:** bump `rootMargin`/`FILL_LEAD_PX` from `600px` to `1200px` so both the fill loop
and real scrolling prefetch the next page well before the user reaches the current bottom,
avoiding visible pop-in.

---

## Fix 2 — Authorable "No more results" Bar

- New block config key, e.g. `no-more-results-text` (via the existing `readBlockConfig` /
  authoring convention), default `"No more results"`.
- Rendered once per search-results block: a footer element sibling to the sentinel, hidden by
  default, shown when `results.more === false` and at least one result has been rendered (i.e.
  not on the zero-results empty state, which already has its own messaging).
- Uses the `.asc-ui-badge` UI Kit primitive (default muted variant) per the UI Kit mandate — no
  new kit primitive needed. Centering/spacing around the badge is block-level layout CSS in
  `search-results.css`, not new kit CSS.

---

## Fix 3 — Filter Reset (verification only)

`SearchService.executeSearchFromFormData` (ASC Core, unmodified) already sets `p.offset` to `0`
whenever `event.detail.type !== 'load-more'`, and `search-results.js`'s render branch already does
a full rebuild (not append) for that case, including clearing masonry state
(`masonryState.delete(resultsEl)`). Fix 1's fill loop applies uniformly to this path — a filter
change is just another non-`load-more` `asc:search:complete`, so the same "keep filling until the
viewport is satisfied or results are exhausted" logic kicks in automatically. No separate code
path is needed; this section exists to document that the behavior is covered, not to introduce new
logic.

---

## Fix 4 — URL → Filter/Result Hydration (verification only)

Confirmed during design research: every filter block (`search-property`, `search-tags`,
`search-date-range`, `search-bar`, `search-path`) already reads `config.initial` — built from
`getInitialValues(window.location.search, group)` in `scripts/asc/core/utils/search.js` (a
non-core util) — and sets its own checked/value/selected state at `decorate()` time. Combined
with `SearchService`'s existing `executeSearchFromUrl()` (fired on `asc:blocks:loaded` whenever any
search block is present), loading a URL with search params already re-populates both the filter UI
and the result set. Fix 1's fill loop ensures that initial URL-driven load also fills the viewport,
not just the first page. No code change proposed here beyond that.

---

## Fix 5 — Display Mode: `localStorage` Only, Not URL

Today:
- `search-bar.js` hydrates the display `<select>` from `URL param || localStorage || default`.
- `search-results.js` separately reads the URL param directly for its initial `data-display`.
- The display field carries `form="asc-search-form"`, so its value is collected into the search
  query and written back to the URL by `SearchService.updateBrowserUrl()` (core, unmodified).

Change (user-owned files only):
- Drop the `form="asc-search-form"` attribute from the display `<select>` in `search-bar.js`,
  keeping its `name="asc.search-results.display"` attribute intact (other code, notably
  `search-results.js`'s `getDisplayMode()`, looks it up by that name via
  `document.querySelector('[name="..."]')`, not via form association). This removes it from
  `collectFormData()` entirely, so it's never sent as a search param and never appears in the URL
  that `updateBrowserUrl()` (core) writes.
- `search-bar.js` hydration becomes `localStorage.getItem(LS_DISPLAY) || viewOptions[0].value`
  (URL fallback removed).
- `search-results.js`'s initial `decorate()` reads `localStorage.getItem('asc.search-results.display')`
  directly instead of `new URLSearchParams(window.location.search).get(...)`.

---

## Verification Plan

1. Local dev server (`aem up`), manual pass:
   - Load a search page on a tall viewport (e.g. 1920x1200) with a query that has many results —
     confirm results keep auto-loading until the viewport is filled or results are exhausted, with
     no visible pop-in while scrolling further.
   - Change a filter (e.g. toggle a property checkbox) — confirm results reset to page 1 and refill
     the viewport again.
   - Load a URL with existing filter/search params — confirm both the filter UI (checkboxes,
     dropdowns) and the result set reflect those params on load, and the viewport fills.
   - Scroll to the true end of a small result set — confirm the "No more results" bar appears
     (and its text is authorable via block config), and does not appear while more results remain.
   - Switch display mode (grid/list/masonry) — confirm the URL no longer gains an
     `asc.search-results.display` param, the choice persists across a reload via `localStorage`,
     and it survives a filter change.
2. `npm run lint` (JS + CSS) clean.
3. After manual verification passes, update `asc-eds-docs` (gh-pages docs site) `blocks.md`
   search-results section to describe the viewport-fill behavior and the new authorable
   "No more results" text, following the existing docs conventions (no em-dashes/AI-tell phrasing
   per standing preference).

---

## Out of Scope

- No changes to `scripts/asc/core/services/search/**` (ASC Core).
- No new UI Kit primitive — `.asc-ui-badge` covers the "No more results" bar.
- No change to sort/orderby URL behavior (only display mode moves to localStorage-only).
- No pagination-position ("resume where you left off") URL encoding — `p.offset` continues to be
  excluded from the URL by core's `updateBrowserUrl()`, unchanged.
