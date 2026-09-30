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
      - title: Apache vhost CORS Headers
        url: "#cors-httpd"
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

- **Classic Dynamic Media (Scene7 / IS-IR)**: `dm-scene7`, and any `url-template`/`url`
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

### Setting CORS headers in the Apache vhost {#cors-httpd}

If you'd rather emit the CORS headers at the Dispatcher tier than configure them in AEM Publish,
add them to the Apache virtual host. On AEM as a Cloud Service that is a file under
`dispatcher/src/conf.d/available_vhosts/` (for example `asc.vhost`); on AMS or on-premise it is
your existing `.vhost` or `conf.d` include. This requires `mod_headers` and `mod_rewrite`, both
enabled in the standard Dispatcher image.

The allowlist must contain exact origins. Because bulk downloads send credentials, the
response has to echo the single matching origin rather than `*`.

```apache
# Asset Share Commons: CORS response headers.
#
# Paste into your Dispatcher virtual host (AEMaaCS: dispatcher/src/conf.d/available_vhosts/<name>.vhost),
# inside or after the <VirtualHost> block that fronts AEM Publish. Requires mod_headers and mod_rewrite.
#
# 1. Edit the origin allowlist below (EDS hostnames, custom domain, localhost).
# 2. Remove the localhost line on production environments.
# 3. Do NOT also emit CORS headers from AEM Publish's CORS policy (duplicate headers are rejected).

# Origins allowed to call this host from the browser.
SetEnvIfExpr "req_novary('Origin') =~ m#^https://(main--YOUR-REPO--YOUR-OWNER\.aem\.(page|live)|assets\.example\.com)$#" ASC_CORS_ORIGIN=%{HTTP:Origin}
SetEnvIfExpr "req_novary('Origin') == 'http://localhost:3000'" ASC_CORS_ORIGIN=%{HTTP:Origin}

<IfModule mod_headers.c>
    # Echo the matching origin, never '*', so credentialed requests (bulk downloads) work.
    Header always set Access-Control-Allow-Origin "%{ASC_CORS_ORIGIN}e" env=ASC_CORS_ORIGIN
    Header always set Access-Control-Allow-Credentials "true" env=ASC_CORS_ORIGIN
    Header always set Access-Control-Allow-Methods "GET, POST, HEAD, OPTIONS" env=ASC_CORS_ORIGIN
    Header always set Access-Control-Allow-Headers "Authorization, Content-Type" env=ASC_CORS_ORIGIN
    Header always set Access-Control-Max-Age "86400" env=ASC_CORS_ORIGIN

    # The response differs by Origin, so shared caches must key on it.
    Header always merge Vary "Origin"
</IfModule>

# Answer preflight requests at the web tier so they never reach Publish.
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} =OPTIONS
    RewriteCond %{ENV:ASC_CORS_ORIGIN} !=""
    RewriteRule ^ - [R=204,L]
</IfModule>
```

Notes:

- `Authorization` and `Content-Type` are the only non-simple request headers ASC sends. Add to
  `Access-Control-Allow-Headers` if you customize `users.getAuthHeaders()`.
- Replace `YOUR-REPO` and `YOUR-OWNER` in the regex with your values, and swap
  `assets.example.com` for your custom domain (or remove it).
- Do not also emit these headers from AEM Publish's CORS policy. Duplicate
  `Access-Control-Allow-Origin` headers make browsers reject the response.
- The `OPTIONS` filter rules under [Sample Filter Rules](#sample-filters) are still needed if you
  let preflights reach Publish. With the rewrite rule above they are answered by Apache first.
- Verify with `curl -i -X OPTIONS -H "Origin: https://main--repo--owner.aem.page" -H
  "Access-Control-Request-Method: POST" https://{aem.host}/content/dam.downloads.initiateDownload.json`
  and confirm a `204` with the headers above.

## Sample Filter Rules {#sample-filters}

Drop these `/filters` rules into your farm's filter file (`dispatcher.any`, or
`conf.dispatcher.d/filters/filters.any` on AEM as a Cloud Service), alongside (not in place of)
your baseline security filters. Delete the rules for features you don't use.

```
# Asset Share Commons: Dispatcher filter rules.
#
# Paste into your farm's filter file (AEMaaCS: dispatcher/src/conf.dispatcher.d/filters/filters.any),
# alongside your baseline security filters, not in place of them. Rule names only need to be unique.
# Delete the rules for features you don't use (for example, the OpenAPI block if search.provider
# is 'querybuilder').

# QueryBuilder search
/asc-001 { /type "allow" /method "GET" /url "/bin/querybuilder.json" }

# DM OpenAPI search, only if search.provider: 'openapi'
/asc-002 { /type "allow" /method "GET" /url "/adobe/assets/search" }
/asc-003 { /type "allow" /method "GET" /url "/adobe/assets/*" }

# Static renditions and thumbnails
/asc-004 { /type "allow" /method "GET" /url "/content/dam/*/_jcr_content/renditions/*" }

# Web-optimized / DM OpenAPI delivery
/asc-005 { /type "allow" /method "GET" /url "/adobe/dynamicmedia/deliver/*" }

# Bulk download initiate and poll
/asc-006 { /type "allow" /method "POST" /url "/content/dam.downloads.initiateDownload.json" }
/asc-007 { /type "allow" /method "GET"  /url "/content/dam.downloads.initiateDownload.json" }

# CORS preflight for the authenticated calls above (only needed if preflights reach Publish;
# asc-cors.vhost answers them at Apache first)
/asc-008 { /type "allow" /method "OPTIONS" /url "/bin/querybuilder.json" }
/asc-009 { /type "allow" /method "OPTIONS" /url "/content/dam.downloads.initiateDownload.json" }
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

See also [Quick Start, Verify](/quickstart#step-7) for the equivalent "reachable from the
browser" checklist during initial setup, and [Renditions](/renditions) for the full
resolver-type reference these paths back to.
