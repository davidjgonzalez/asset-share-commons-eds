# Activity History

`scripts/asc/core/services/activity/activity.js` (`services.activity`) records a local,
per-user timeline of what someone has done on the site — searches, asset-detail views (with
how long they looked), collection changes, shares, downloads, and rendition copy/download
actions. It's the same `asc:{noun}:{verb}` event bus the analytics service uses (see `AGENTS.md`
→ "Custom Events — Full Reference" and `docs/ANALYTICS.md`), just funneled into local storage
instead of a vendor SDK — one more consumer of the same bus, not a separate integration.

This service is purely the *recorder*. It doesn't render anything — pair it with your own UI
(a "recent activity" timeline, a sidebar list, etc.) that reads `services.activity.getActivity()`.

## Quick start

Auto-initializes on import, like every other core service (see `scripts/asc/core/services/
services.js`) — active on every page load, no setup needed.

```js
import services from './scripts/asc/core/services/services.js';

const entries = services.activity.getActivity(); // newest first
services.activity.clearActivity();                // wipe the current user's history
```

Configure in `scripts/asc/configurations.js` → `activity`:

```js
activity: {
  enabled: true,
  max: 200, // capped list length; oldest entries drop off first
},
```

## Storage

Entries live under the `activity` key in the storage service (`scripts/asc/core/services/
storage/storage.js`), so they're scoped per-user exactly like `collections`/`recentlyViewed` —
anonymous and logged-in users each get their own list (`storage.get('activity')` /
`storage.set('activity', entries)`; see `AGENTS.md` → "Storage Service").

**Known limitation:** `storage.mergeUserData(fromId, toId)` (used by `loginAs`) only merges
`recentlyViewed` today — logging in on top of an anonymous session does not carry the anonymous
session's activity history forward. Fixing that means editing `storage.mergeUserData` itself,
which is out of scope for this doc/service pair to decide unilaterally — flag it if you need it.

## Entry shape

Every entry has these fields, plus type-specific ones below:

```js
{
  id: string,              // crypto.randomUUID()
  type: string,             // see table below
  at: string,                // ISO timestamp — when the activity started
  durationMs: number | null, // elapsed time, only for types where a start/end pair exists
  ...
}
```

| `type` | Source event(s) | Extra fields | Duration? |
| --- | --- | --- | --- |
| `search` | `asc:search:complete` (not `load-more`) | `query` (form data as a plain object), `total` | No |
| `asset-view` | `asc:asset:details:open` → `:close` | `assetId`, `assetName`, `assetPath` | Yes — open to close |
| `asset-share` | `asc:asset:share` | `assetId`, `assetName`, `assetPath` | No |
| `rendition-download` | `asc:rendition:download` | `assetId`, `assetName`, `renditionId`, `renditionLabel` | No |
| `rendition-copy-url` | `asc:rendition:copy-url` | Same as above | No |
| `rendition-copy-image` | `asc:rendition:copy-image` | Same as above | No |
| `rendition-share` | `asc:rendition:share` | Same as above | No |
| `collection-add` | `asc:collection:add` | `assetId`, `assetName`, `collectionId`, `collectionName` | No |
| `collection-remove` | `asc:collection:remove` | Same as above | No |
| `collection-create` | `asc:collection:created` | `collectionId`, `collectionName` | No |
| `collection-delete` | `asc:collection:deleted` | `collectionId` only — the collection is already gone by the time this fires, so there's no name left to look up | No |
| `share-create` | `asc:share:created` | `url`, `title`, `collectionId` | No |
| `download` | `asc:download:started` → `:complete`/`:failed` | `jobId`, `assetPaths`, `collectionId`, `status` (`running`/`complete`/`failed`), `downloadUrl` or `error` | Yes — started to complete/failed |

Asset/rendition names come from `window.asc.cache.assets` (see `CLAUDE.md` → "Global Cache") —
whichever hydrated `Asset` the search/board/collection UI that led here already cached. If an
asset somehow isn't cached when its event fires, the entry still records `assetId`; `assetName`/
`assetPath` are just `null`.

## Why some rendition-scoped events needed adding

`details-renditions.js` already dispatched `asc:rendition:download`/`copy-url`/`share` via the
declarative Actions system (`data-asc-action="rendition:download@click"`, etc. — see AGENTS.md
→ "Actions system"). `details-actions.js` (the details-view action-button toolbar) did the same
work — download, copy URL, copy image, copy asset link — with its own hand-rolled click handler
and no `data-asc-action` at all, so none of it was visible on the event bus. It now carries the
same attributes `details-renditions.js` uses, so both blocks' buttons are indistinguishable to
anything listening on the bus (this service, the analytics service, or your own code) regardless
of which one the user actually clicked. `asc:rendition:copy-image` is the one genuinely new event
name this required — `download`/`copy-url` already existed, and the "Copy asset link" / deprecated
"Share" button now dispatches the existing (previously unused) `asc:asset:share` event.

## The Escape-key gap (and why it doesn't matter here)

`asc:asset:details:close` only fires when the user clicks the modal's own close button
(`data-asc-action="asset:details:close@click"` in `details-modal.js`) — dismissing the native
`<dialog>` via Escape or backdrop click closes it directly with no custom event at all. Fixing
that at the source would mean editing `details-modal.js`'s dialog-close wiring carefully enough
to avoid double-dispatching when the close button *is* used. Rather than take on that risk for
one consumer, this service sidesteps it: a `pagehide` listener finalizes any still-open
asset-view entry (filling in `durationMs` from however long it was actually open) when the user
navigates away, so an Escape-dismissed view still gets a real duration instead of staying
`durationMs: null` forever. If you build something else that needs a fully reliable close
signal, you'll want to fix `details-modal.js` directly rather than route around it a second time.

## Extending

Add a new entry type the same way `docs/ANALYTICS.md` documents adding a tracker: add one
`[document, 'asc:my-feature:did-thing', (e) => services.activity.record('my_feature_thing', { ...fields })]`
tuple to `configurations.js` → `activity.customListeners` (same shape as the service's own
built-in `LISTENERS`, merged in at init time) — no edits to the service itself needed.
