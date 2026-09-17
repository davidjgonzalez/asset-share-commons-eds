# SEO / Page Metadata

`scripts/asc/core/services/seo/seo.js` (`services.seo`) sets `document.title`, meta description,
canonical link, Open Graph + Twitter Card tags, and JSON-LD structured data. It applies once per
page type on load, and specially for the Asset Details overlay — which gets a canonical URL of
its own instead of inheriting whatever search/collection URL it happened to be opened from.

## The one thing this doesn't solve

Everything this service writes happens client-side, after JS runs. That's enough for
`document.title`/canonical/JSON-LD as far as Google's JS-rendering crawl pass is concerned — it
executes JS and reads the post-render DOM, and that's also the pass AI Overviews rides on. It is
**not** enough for any crawler that only fetches raw HTML and never executes JS — which covers two
overlapping audiences: classic link-preview bots (Slack, X/Twitter, Facebook, LinkedIn, iMessage)
**and** most dedicated AI/answer-engine crawlers (GPTBot, ClaudeBot, PerplexityBot, and similar —
i.e. the GEO/AEO side of things), which generally skip JS execution the same way. Both only ever
see whatever's authored directly into `<title>`/`<meta>` in da.live (including `{{ }}` tokens
already resolved into them — see `docs/CONTENT_VARIABLES.md`), never anything this service adds
afterward. Reliable coverage for either audience on a shared asset link would need a server/edge
component outside this repo's static-delivery model. That's a deliberate scope boundary, not an
oversight — solve it separately if it matters for your use case.

## Quick start

Auto-initializes on import, like every other core service (see `scripts/asc/core/services/
services.js`) — active on every page load, no setup needed. Everything below is optional
customization.

```js
seo: {
  enabled: true,
  siteName: 'Asset Library',
  defaultImage: '/path/to/default-social-share.jpg',
  canonicalBase: '/asset',
  pages: { search: (ctx) => ({ title: `Search — ${ctx.siteName}` }) },
  assetDetails: (asset) => ({ title: asset.title }),
  jsonLd: { assetDetails: (asset) => ({ creator: asset.getProperty('dc:creator').text }) },
},
```

## Config reference

| Key | Type | Purpose |
| --- | --- | --- |
| `enabled` | `boolean` | Master kill switch. Default `true`. |
| `siteName` | `string` | Written to `og:site_name` on every page/asset. |
| `defaultImage` | `string` | Fallback `og:image`/`twitter:image` when a page hook or the asset's own renditions don't supply one. |
| `canonicalBase` | `string` | Pathname used for the Asset Details canonical URL — see below. |
| `pages.<type>` | `(ctx) => object` | Opt-in override for `search`/`collections`/`sheet`/`board`/`default`. Return only the fields you want to set; omitted fields leave whatever's already authored untouched. |
| `assetDetails` | `(asset) => object` | Opt-in override for the Asset Details overlay. Has real defaults even without this (see below). |
| `jsonLd.<type>` | `(ctx) => object \| null` | JSON-LD for a page type. No default — omit for no `<script type="application/ld+json">` at all. |
| `jsonLd.assetDetails` | `(asset) => object \| null` | Merged over the built-in default (see below). Return `null` to suppress entirely. |
| `customListeners` | `[target, eventType, handler][]` | Extra refresh triggers, same shape as every other core service's `customListeners` (e.g. `analytics`, `activity`). |

`ctx` passed to `pages`/`jsonLd` page-type hooks: `{ type, url, searchParams, siteName }`.

## Why page-level hooks are opt-in only, but Asset Details isn't

`getMetadata()` (`scripts/aem.js`) and the `{{ }}` token resolver are the only other metadata
mechanisms in ASC, and neither has any concept of "this collection's name" or "this sheet's
description" — that only exists in each block's own JS/DOM at runtime, which `configurations.js`
hooks can't generically see. So `pages.*` hooks default to a no-op: whatever's already authored in
`<title>`/`<meta name="description">` (already token-resolved by the time `applyPage()` runs —
see "Interaction with the `{{ }}` token system" below) passes through untouched unless you supply
a hook.

`assetDetails`, by contrast, has a fully-typed `Asset` model with `title`/`description`/
`mimeType`/renditions already available with zero configuration, so it ships real defaults:
`asset.title`, `asset.description`, and an image resolved from
`services.renditions.getRendition(asset, 'web')?.url` → `asset.thumbnail` → `defaultImage`, in that
order. The `assetDetails` config hook only needs to return fields you want to *override*.

JSON-LD for an asset defaults to:

```json
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "name": "...",
  "description": "...",
  "contentUrl": "...",
  "url": "...",
  "width": 1280,
  "height": 960
}
```

`@type` is chosen by MIME type: `image/*` → `ImageObject`, `video/*` → `VideoObject`, everything
else → `DigitalDocument`. `width`/`height` come from the `web` rendition when present.
`jsonLd.assetDetails` shallow-merges over this default, or suppresses it entirely if it returns
`null`.

## Canonical URL for Asset Details

Asset Details opens via `?asset={uuid}` appended to whatever page triggered it — often a
search-results URL loaded with filter/pagination params. Using that raw URL as the canonical would
mean the "canonical" reference for a given asset changes depending on which search led there, and
carries irrelevant query noise. Instead, the canonical URL:

1. Starts from the current URL.
2. Strips every existing query param and the hash.
3. Replaces the pathname with `canonicalBase` if configured, otherwise keeps the current pathname.
4. Sets exactly one query param: `asset={uuid}`.

`AssetDetails` (`scripts/asc/core/services/asset-details/asset-details.js`) auto-opens off the
`?asset=` query param alone, with **no pathname check** — so any page works as `canonicalBase`.
But the canonical URL is still a real link a crawler or a copy-pasted share might visit directly;
point `canonicalBase` at an actual authored page (a plain page is enough — the modal auto-opens on
top of it), or it 404s.

## Why this observes the DOM instead of listening for `asc:asset:details:open`/`:close`

`AssetDetails.open()` is called from four places, and only one dispatches
`asc:asset:details:open`:

| Trigger | Dispatches the event? |
| --- | --- |
| Click a teaser (Actions service dispatches it) | Yes |
| Initial page load with `?asset=` already in the URL | No — direct `open()` call |
| Browser back/forward (`popstate`) | No — direct `open()` call |
| Prev/Next arrows inside the open modal | No — direct `open()` call |

A pure event-listener design would go stale on exactly the cases that matter most here — a fresh
deep-link load (i.e. someone opening a shared link) never fires the event at all. Every one of the
four paths, though, ends the same way: the fragment swapped into `.details-modal .content` always
carries `data-asc-asset="{uuid}"`, and dismissing the dialog — button, Escape, or a programmatic
`.close()` — always fires the dialog's native `close` event (this modal has no backdrop-click
wiring, so those two are the only dismiss paths, both covered). `seo.js` wires its own
`MutationObserver` on `.content` and a `close` listener on the `<dialog>` in its constructor, with
no edits to `asset-details.js` or `details-modal.js`. **Don't "simplify" this back to
`asc:asset:details:open`/`:close` listeners** — it would silently stop updating metadata on
exactly the deep-link and Prev/Next cases that make this feature worth having.

The asset ID read off the DOM is resolved to a full `Asset` via `search.getAssetById()`, which
reads from `window.asc.cache.assets` first (see `CLAUDE.md` → "Global Cache") — no duplicate
network fetch beyond whatever `AssetDetails.open()` already awaited.

## Ordering with page-level metadata

A fresh load with `?asset=` already in the URL races `applyPage()` (called from `ascLazy()`)
against the modal's own async auto-open, with no guaranteed order. `applyPage()` handles this: if
the asset overlay is currently active, it doesn't touch the live DOM at all — it updates the
pending snapshot that `restore()` will reveal on close, instead. So regardless of which runs
first, the asset's metadata stays visible while the modal is open, and the correct page-level
metadata comes back once it's closed.

## Interaction with the `{{ }}` token system

`ascDecorateMain()` resolves `{{ }}` tokens (see `docs/CONTENT_VARIABLES.md`) synchronously inside
`decorateMain()`, which runs during `loadEager()` — strictly before `applyPage()` ever runs (from
`ascLazy()`, called from `loadLazy()`, which only runs after `loadEager()` resolves). So by the
time `applyPage()` reads the current `<title>`/`<meta name="description">` as the authored
baseline, any `{{sheet.title}}`-style token an author typed directly into those tags has already
resolved to real text. `pages.*` hooks only override fields they explicitly return — there's no
race and no special-casing needed.

## A caveat worth knowing: block-load timing for `pages.*` hooks

`applyPage()` runs once, early in `loadLazy()`. If a `pages.collections`/`pages.sheet` hook
depends on data a block only populates once it renders (e.g. `collection-controls.js`'s own
`registerTokens()` call for `collection.title`), and that block hasn't loaded yet at that point,
the hook won't see it. If you need metadata that depends on a block's own async data, use
`customListeners` to re-run `applyPage()` off whatever event that block fires once it's ready —
the same escape hatch `analytics`/`activity` use for equivalent gaps.
