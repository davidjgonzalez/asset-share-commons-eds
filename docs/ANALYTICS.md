# Web Analytics

ASC does not ship a bundled analytics vendor. Instead, it exposes two mechanisms so any
vendor — GA4, Adobe Analytics/Launch, Adobe Client Data Layer, Segment, a home-grown
endpoint — can be wired in without touching ASC Core or block code:

1. **A custom-event bus.** Every meaningful user action already dispatches a
   documented `asc:{noun}:{verb}` event (full catalog: `AGENTS.md` → "Custom Events —
   Full Reference"). This is the primary hook — one listener file can observe the
   entire site.
2. **Declarative data attributes.** Every asset/collection element in the DOM carries
   `data-asc-asset` / `data-asc-collection` (see `AGENTS.md` → "Data Attributes — Full
   Reference"), so you can attach your own observers (e.g. scroll-based impression
   tracking) without any ASC code changes at all.

Because both mechanisms already exist for the framework's own internal wiring,
analytics is purely additive — it never requires new coupling between blocks and a
vendor SDK.

## Quick start

`scripts/asc/analytics.js` (user-owned, not ASC Core) is a working starter that
listens to the event bus and funnels everything through one `trackEvent(name,
payload)` function. It's wired into `ascDelayed()` in `scripts/asc.js`, so it's
active on every page load, after the critical path — matching the EDS lifecycle
convention of doing non-critical work in the delayed phase (see `CLAUDE.md` →
"Page Lifecycle").

To connect a real vendor, configure `analytics.trackers` in
`scripts/asc/configurations.js` — no edits to `analytics.js` itself needed:

```js
analytics: {
  trackers: [
    // GA4 (gtag.js)
    (name, payload) => window.gtag?.('event', name, payload),

    // Adobe Client Data Layer
    (name, payload) => window.adobeDataLayer?.push({ event: name, ...payload }),

    // Adobe Analytics via Launch/AppMeasurement
    (name, payload) => window._satellite?.track(name, payload),

    // Segment
    (name, payload) => window.analytics?.track(name, payload),

    // Your own endpoint
    (name, payload) => navigator.sendBeacon?.('/analytics', JSON.stringify({ name, payload })),
  ],
},
```

`console.debug('[ASC Analytics]', name, payload)` always fires alongside your
trackers (not just while `trackers` is empty) — open devtools and interact with
the site to see every event and its exact payload, including any consent-driven
identity fields and captured UTM params, at any time.

## Configuration (`configurations.js` → `analytics`)

| Key | Default | Purpose |
| --- | --- | --- |
| `enabled` | `true` | Master kill switch — set `false` to disable tracking entirely. |
| `level` | `'anonymous'` | Consent/PII level for general engagement events. `'anonymous'` never attaches user identity; `'identified'` attaches `{ userId, email }` from the `users` service to every event. Can be a function (`() => 'anonymous' \| 'identified'`) so it's re-evaluated per event — a cookie-consent banner or preference-center toggle takes effect on the very next event, no reload required. |
| `identifyEvents` | `[]` | `trackEvent()` names that always carry user identity regardless of `level` — for audit/governance trails tied to gated access (e.g. per-partner download accountability under a DAM's usage terms), which are a condition of access rather than opt-in marketing tracking. Example: `['download_start', 'download_complete']`. |
| `enrich` | `undefined` | `(name, payload) => payload`. Runs after the built-in payload (including captured UTM params and any identity fields) is assembled, before trackers fire. Return a modified payload to redact fields or attach extra context (e.g. asset category/campaign pulled from the cached `Asset` instance via `window.asc.cache.assets`); return `null`/`undefined` to drop the event entirely. |
| `trackers` | `[]` | Array of `(name, payload) => void` functions, one per vendor. All run for every tracked event. |

### Consent and identity

Two independent controls decide whether a given event carries user identity:

1. **`level`** — the general policy. Sites with PII constraints should leave
   this at the default `'anonymous'`, or wire it to a consent-management
   platform so it flips to `'identified'` only after explicit opt-in — and back
   to `'anonymous'` immediately on withdrawal, since `level` is re-read on
   every event rather than cached.
2. **`identifyEvents`** — a fixed override list for events where identity is
   inherent to the action, not a marketing preference (typically: downloads of
   gated assets, where "who downloaded what" is an audit requirement of the
   access grant itself). These fire identified even when `level` resolves to
   `'anonymous'`.

Anything not in `identifyEvents` follows `level`. If your install has no PII
constraints at all, set `level: 'identified'` and leave `identifyEvents: []`.

### UTM capture

`analytics.js` captures `utm_source` / `utm_medium` / `utm_campaign` / `utm_term`
/ `utm_content` from the landing URL once per session and stashes them in
`sessionStorage` (`asc:analytics:utm`) — plain `location.search` reads would
lose them the moment a gated page redirects through IMS/SSO login. Every event
payload automatically includes whichever of these were present at landing,
before `enrich` runs.

## Event catalog → analytics mapping

| ASC event | `trackEvent()` name | Payload | Notes |
| --- | --- | --- | --- |
| `asc:search:complete` (`results.total === 0`) | `search_no_results` | `{ formData }` | Derived from the existing event — no new event needed |
| `asc:search:complete` (`type === 'load-more'`) | `search_paginate` | `{ total, size, offset }` | Infinite-scroll page load |
| `asc:search:complete` (otherwise) | `search` | `{ total, size, offset }` | Initial search or filter change |
| `asc:search:error` | `search_error` | `{ error }` | |
| `asc:asset:details:open` | `asset_detail_view` | `{ assetId }` | |
| `asc:asset:share` | `asset_share` | `{ assetId }` | |
| `asc:rendition:activate` | `rendition_select` | `{ assetId, renditionId }` | Sticky rendition pick in the details view |
| `asc:collection:add` | `add_to_collection` | `{ assetId, collectionId }` | |
| `asc:collection:remove` | `remove_from_collection` | `{ assetId, collectionId }` | |
| `asc:collection:created` | `collection_create` | `{ collectionId }` | |
| `asc:share:created` | `collection_share` | `{ collectionId, url }` | |
| `asc:download:started` | `download_start` | `{ jobId, assetPaths, collectionId }` | `assetPaths`/`collectionId` are looked up from the job record, not carried on the event — needed for per-asset download audit trails; see `identifyEvents` below |
| `asc:download:complete` | `download_complete` | `{ jobId, assetPaths, collectionId }` | Same lookup as `download_start` |
| `asc:download:failed` | `download_failed` | `{ jobId, error }` | |

This list is deliberately not exhaustive — see `AGENTS.md`'s full event table for
every `asc:*` event and its `detail` shape; add a listener for any you need
(`asc:collection:activated`, `asc:collection:deleted`, `asc:download:change`, etc.
follow the identical pattern).

### Why derive no-results / pagination instead of adding new events?

`asc:search:complete`'s `detail` already carries everything needed
(`results.total`, `type`) — adding `asc:search:no-results` or
`asc:search:paginate` as separate events would just be two more places for the
search service to remember to dispatch, for information the existing event already
contains. Prefer deriving a signal from an existing event's payload over adding a
new event whenever the data is already there.

## Recipes for signals with no dedicated event

**Asset impressions (card scrolled into view).** ASC doesn't hard-wire this — an
observer on every card would cost something on every search-results page even for
sites that don't want impression tracking. Since every card already carries
`data-asc-asset` (search results, board items, collection rows all do), add this to
your own analytics file:

```js
const impressionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    trackEvent('asset_impression', { assetId: entry.target.dataset.ascAsset });
    impressionObserver.unobserve(entry.target); // fire once per asset
  });
});

document.body.addEventListener('asc:search:complete', () => {
  document.querySelectorAll('[data-asc-asset]:not([data-impression-observed])')
    .forEach((el) => {
      el.dataset.impressionObserved = '1';
      impressionObserver.observe(el);
    });
});
```

**Click-level detail beyond what an event payload carries** (e.g. which quick-action
icon was clicked, not just that a collection changed). Every declaratively-wired
element carries `data-asc-action`, and the Actions service (`scripts/asc/core/services/
actions/actions.js`) passes every `data-*` attribute up the DOM tree as
`event.detail.data` — so add whatever extra `data-*` attributes you need on a
button/link and read them from the same event you're already listening to. No new
ASC code required.

## Extending: adding a new `asc:*` event for a custom feature

Any block or Part you add that dispatches its own event following the
`asc:{noun}:{verb}` convention (see `AGENTS.md` → "Event Convention") is
automatically analytics-observable — just add one line to the `LISTENERS` array in
`scripts/asc/analytics.js`:

```js
[document, 'asc:my-feature:did-thing', (e) => trackEvent('my_feature_thing', { ...e.detail })],
```

No changes to `trackEvent()`, no changes to any block. This is the same reason the
event bus exists in the first place (see `AGENTS.md`'s Actions system) — analytics
is just one more consumer of it.

## Debugging

- Every event fired through `scripts/asc/analytics.js` logs via `console.debug`
  until you wire a real vendor in `trackEvent()` — use this to verify an event
  fires with the payload you expect before connecting anything external.
- If an event you expect isn't firing, check `AGENTS.md`'s event table for the
  correct dispatch scope: most events bubble to `document`, but
  `asc:rendition:activate` / `asc:rendition:preview` are dispatched directly on
  `document.body` with `bubbles: false` — a listener on `document` will never see
  them.
