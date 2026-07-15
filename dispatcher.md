---
layout: page
title: AEM Publish Dispatcher
permalink: /dispatcher
sidebar:
  - label: Dispatcher
    items:
      - title: Why This Matters
        url: "#why"
      - title: What Publish Is Responsible For
        url: "#responsibilities"
      - title: Endpoint Inventory
        url: "#endpoints"
      - title: CORS
        url: "#cors"
      - title: Sample Filter Rules
        url: "#sample-filters"
      - title: Caching Notes
        url: "#caching"
      - title: Security Notes
        url: "#security"
      - title: Troubleshooting
        url: "#troubleshooting"
---

# AEM Publish Dispatcher

Asset Share Commons runs entirely as **client-side JavaScript in the browser**. There is no
server-side rendering layer between the visitor and AEM Publish. Every search, thumbnail,
rendition download, and bulk-download job is a `fetch()` call made directly from the page to
`aem.host` (and `aem.deliveryHost`, when configured). That's different from a typical
AEM-rendered site, where the Dispatcher only ever needs to serve fully rendered HTML pages to
the browser. Here, the Dispatcher sitting in front of Publish also has to pass through a small,
well-defined set of API and binary paths, cross-origin, straight to the visitor's browser.

This page is a checklist for whoever owns `dispatcher.any` or the Cloud Manager dispatcher
module for your AEM environment. It doesn't replace Adobe's baseline Dispatcher security
configuration. It documents the additional allow rules this front-end needs layered on top of
it, and only for the features you actually have enabled in `scripts/asc/configurations.js`.

> This repository does not ship a `dispatcher.any`. The Dispatcher module lives in your AEM
> Cloud Manager or AMS repository, separate from this EDS front-end codebase. Use this page as
> the spec for what to add there.

## Why This Matters {#why}

By default, a hardened AEM Dispatcher denies almost everything except `.html` requests to known
page paths: no selectors, no extra extensions, no query strings on cacheable requests, and no
arbitrary JSON. That's the correct default. It's what stops a public Dispatcher from becoming an
open door onto the repository. Because ASC's blocks call AEM's own APIs directly from the
browser (QueryBuilder, Dynamic Media, the AEM download framework), those specific paths need
narrow, explicit allow rules, not a blanket loosening of the filter set.

## What Publish Is Responsible For {#responsibilities}

Strip away the specific paths and this front-end only asks AEM Publish to do three things:

1. **QueryBuilder.** Every search-* block ends up calling QueryBuilder (or the DM OpenAPI
   search endpoint, if that provider is configured) to find matching assets and return their
   metadata as JSON.
2. **Serving asset and rendition binaries.** The actual image, video, and PDF bytes rendered
   inline in the browser: thumbnails in search results, the preview in the details modal, and
   any configured rendition. Publish serves these directly, either from a JCR rendition node or
   through a Dynamic Media delivery path.
3. **Downloading assets and rendition binaries.** A separate concern from serving them inline.
   The bulk download job that the `collections`/`board` "Download" action triggers zips up one
   or more assets' renditions and hands back a file for the browser to save.

The [Endpoint Inventory](#endpoints) below maps each of these three responsibilities to the
exact paths and methods that need to reach the browser.

## Endpoint Inventory {#endpoints}

Every path below is called with `fetch()` from `scripts/asc/core/services/`. Only enable the
rows that match your actual configuration. Skip the OpenAPI row entirely if `search.provider`
is `'querybuilder'` (the default).

| Feature | Method | Path | Enabled by |
|---------|--------|------|------------|
| QueryBuilder search | `GET` | `/bin/querybuilder.json` | Default, `search.provider: 'querybuilder'` |
| DM OpenAPI search | `GET` | `/adobe/assets/search`, `/adobe/assets/{id}` | `search.provider: 'openapi'` |
| Static renditions & thumbnails | `GET` | `{assetPath}/_jcr_content/renditions/*` | Always: `type: 'static'` resolvers, default thumbnail fallback |
| Web-optimized delivery | `GET` | `/adobe/dynamicmedia/deliver/dm-aid--{uuid}/...` | Any `type: 'web-optimized-delivery'` rendition or thumbnail definition |
| DM with OpenAPI delivery | `GET` | `{aem.deliveryHost}/adobe/dynamicmedia/deliver/{uuid}/...` | Any `type: 'dm-openapi'` rendition definition |
| Bulk download, initiate | `POST` | `/content/dam.downloads.initiateDownload.json` | `collections`/`board` "Download" action |
| Bulk download, poll | `GET` | `/content/dam.downloads.initiateDownload.json?jobId=...` | Same as above |

Two delivery paths are not Dispatcher concerns at all, because they never touch your Publish
tier:

- **Classic Dynamic Media (Scene7 / IS-IR)**: `dm-smartcrop`, and any `url-template`/`url`
  rendition built from `${dm.domain}`, resolves to the Scene7 delivery CDN
  (`dam:scene7Domain`, e.g. `https://s7d1.scene7.com/`), served by Adobe directly.
- **Action-page fragments** (`/actions/*.plain.html`) and the **search config sheet**
  (`configurations.search.sheet`): these are EDS/da.live content paths fetched from the site's
  own origin, not from `aem.host`.

Custom rendition resolvers you add via `renditions.resolvers` (see
[Renditions, Custom resolvers](/renditions#custom-resolvers)) may introduce additional AEM
paths. Audit any `fromDefinition`/`url` function you write the same way.

### Static renditions & thumbnails {#endpoints-static}

`_jcr_content` (underscore-prefixed, not `jcr:content`) is the standard public-safe encoding
AEM uses for JCR binary URLs, and most baseline Dispatcher filter sets already allow it for
`/content/dam`. Confirm it isn't shadowed by a broader deny rule before assuming it works. This
is the path every `type: 'static'` rendition, and the default `cq5dam.thumbnail.319.319` teaser
fallback, resolve to.

### Bulk downloads {#endpoints-downloads}

The [downloads service](/collections#downloads) POSTs `path`/`renditions` form fields to
initiate a job, then polls the same URL with `?jobId=...` until AEM reports `DONE`. Both calls
send `credentials: 'include'` (browser session cookies) in addition to any IMS bearer token.
See [CORS](#cors) below: this has direct implications for your CORS config.

## CORS {#cors}

Because every request originates from the EDS site's own origin
(`https://main--{repo}--{owner}.aem.page` / `.aem.live`, or your custom domain) and targets a
different origin (`aem.host`), these are cross-origin requests. The Dispatcher's job is only to
let the request and its headers through. The actual `Access-Control-Allow-*` response headers
are emitted by AEM Publish itself (typically via the CORS support built into AEM, or
`org.apache.sling.cors.impl.CORSPolicyImpl` bound to the relevant paths). Two auth modes are in
play, and they have different CORS requirements:

- **Anonymous requests**: no `Authorization` header is sent, only cookies the browser already
  holds for `aem.host` are forwarded. Works fine with a wildcard
  `Access-Control-Allow-Origin: *`.
- **Signed-in requests (IMS/SSO)**: `users.getAuthHeaders()` adds an `Authorization: Bearer
  {token}` header (`scripts/asc/core/services/users/users.js`). A custom request header
  triggers a CORS preflight `OPTIONS` request, which the Dispatcher must not block.
- **Bulk downloads specifically**: sent with `credentials: 'include'`, which the CORS spec
  disallows combining with a wildcard origin. `Access-Control-Allow-Origin` must echo the exact
  requesting origin, and `Access-Control-Allow-Credentials: true` must be set, for
  `/content/dam.downloads.initiateDownload.json`.

The lazy `HEAD` file-size fetch (see [Renditions, File size](/renditions#filenames)) uses
`credentials: 'omit'` specifically so it stays compatible with a wildcard-origin CORS policy on
Scene7/CDN URLs that aren't yours to configure.

> Confirm `OPTIONS` is not blanket-denied by your Dispatcher's `/filters` section. A common
> hardening mistake is allowing only `GET`/`POST`/`HEAD`, which silently breaks every
> authenticated cross-origin call without any error visible outside the browser console.

## Sample Filter Rules {#sample-filters}

Illustrative `/filters` additions for `dispatcher.any`. Adapt paths/globbing to your existing
rule set and place them alongside (not in place of) your baseline security filters:

```
/filters {
    # ... your existing baseline rules ...

    # QueryBuilder search
    /0011 { /type "allow" /method "GET" /url "/bin/querybuilder.json" }

    # DM OpenAPI search, only if search.provider: 'openapi'
    /0012 { /type "allow" /method "GET" /url "/adobe/assets/search" }
    /0013 { /type "allow" /method "GET" /url "/adobe/assets/*" }

    # Static renditions & thumbnails
    /0014 { /type "allow" /method "GET" /url "/content/dam/*/_jcr_content/renditions/*" }

    # Web-optimized / DM OpenAPI delivery
    /0015 { /type "allow" /method "GET" /url "/adobe/dynamicmedia/deliver/*" }

    # Bulk download initiate + poll
    /0016 { /type "allow" /method "POST" /url "/content/dam.downloads.initiateDownload.json" }
    /0017 { /type "allow" /method "GET"  /url "/content/dam.downloads.initiateDownload.json" }

    # CORS preflight for the authenticated calls above
    /0018 { /type "allow" /method "OPTIONS" /url "/bin/querybuilder.json" }
    /0019 { /type "allow" /method "OPTIONS" /url "/content/dam.downloads.initiateDownload.json" }
}
```

Keep every rule as narrow as the exact path in the [endpoint inventory](#endpoints). Resist the
temptation to allow `*.json` or `/bin/*` broadly. That reopens the class of vulnerability these
filters exist to prevent: arbitrary recursive JSON dumps, servlet enumeration.

## Caching Notes {#caching}

- `querybuilder.json` and `/adobe/assets/search` requests always carry a query string and
  should not be cached by the Dispatcher. Leave them out of any `/cache/allowedClientHeaders`
  or query-string-caching overrides. Search results must reflect the live index.
- `/content/dam.downloads.initiateDownload.json` is a `POST`/dynamic-`GET` pair. Dispatchers
  don't cache `POST` by default, and the poll `GET` always carries a `jobId` query string, so no
  extra `/cache` rule is needed.
- Rendition binaries under `_jcr_content/renditions/*` are static and cacheable at the CDN or
  Dispatcher layer. Standard AEM replication/activation already triggers the usual dispatcher
  cache invalidation on asset republish. No ASC-specific invalidation hook exists or is needed.

## Security Notes {#security}

- This front-end never sends AEM admin/service credentials from the browser, only an end
  user's own IMS bearer token (when signed in) or their existing anonymous session cookie. The
  Dispatcher/CORS config should scope access no further than what that user already has read
  access to in the JCR.
- Every allow rule above is a new attack surface on an internet-facing Dispatcher. Scope each
  one to the exact path/method combination in the table, not a wildcard, and confirm your
  QA/verification pass (see [Troubleshooting](#troubleshooting)) checks that unrelated `/bin/*`
  or `/content/dam.*` servlets stay denied.
- If `search.provider` is `'querybuilder'`, QueryBuilder itself enforces the requesting user's
  JCR ACLs; it does not bypass them. Don't rely on the Dispatcher filter as the only access
  control. It's a network-level gate in front of AEM's own permission checks, not a replacement
  for them.

## Troubleshooting {#troubleshooting}

| Symptom | Likely cause |
|---------|--------------|
| Search returns no results; DevTools shows a 404 on `querybuilder.json` | `/bin/querybuilder.json` not allowed in `/filters` |
| Console error: "No 'Access-Control-Allow-Origin' header" | AEM CORS config missing for the EDS origin, or the Dispatcher is blocking the `OPTIONS` preflight |
| Thumbnails/rendition images broken (broken-image icon) | `_jcr_content/renditions/*` blocked, or the asset hasn't been republished since the rule was added |
| Bulk download button spins forever, job never completes | `POST` to `initiateDownload.json` blocked, or CORS is missing `Access-Control-Allow-Credentials: true` for that exact origin |
| DM OpenAPI renditions 403 or blank | `aem.deliveryHost` misconfigured, or DM OpenAPI isn't entitled/enabled on this AEMaaCS program |
| Everything works signed-out, breaks after IMS login | `Authorization` header preflight is being denied; check `OPTIONS` allow rules and CORS `Access-Control-Allow-Headers` |

See also [Quick Start, Verify](/quickstart#step-6) for the equivalent "reachable from the
browser" checklist during initial setup, and [Renditions](/renditions) for the full
resolver-type reference these paths back to.
