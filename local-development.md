---
layout: page
title: Local Development
permalink: /local-development
sidebar:
  - label: Local Development
    items:
      - title: Overview
        url: "#overview"
      - title: What you need
        url: "#need"
      - title: Choosing your AEM
        url: "#aem-target"
      - title: The dev loop
        url: "#loop"
  - label: Single domain
    items:
      - title: Why one origin
        url: "#why"
      - title: Quick path (local SDK)
        url: "#quick"
      - title: Reverse proxy (recommended)
        url: "#proxy"
      - title: TLS for Secure cookies
        url: "#tls"
      - title: No proxy? Use CORS
        url: "#cors"
  - label: Auth locally
    items:
      - title: Validate the plumbing
        url: "#validate"
      - title: Troubleshooting
        url: "#trouble"
  - label: See also
    items:
      - title: Quick Start
        url: "/quickstart"
      - title: Authentication
        url: "/auth"
---

# Local Development

How to develop Asset Share Commons on your machine, and how to front Edge Delivery
Services (EDS) and AEM with a **single domain** so authenticated development works
the same way it will in production.

> This page is the day to day dev workflow. For the one time project bootstrap
> (fork, da.live workspace, deploy) see [Quick Start]({{ '/quickstart' | relative_url }}).
> For architecture and extension points see
> [Developer Reference]({{ '/developer' | relative_url }}).

---

## Overview {#overview}

There is no build step. `aem up` serves your local code at `http://localhost:3000`,
pulls authored content from your da.live workspace, and proxies everything else to
AEM. You edit files, save, and reload. The only part that needs extra setup is
**authentication**, because the AEM session cookie must reach AEM from the same
site as the front end. That is what the single domain section below solves.

---

## What you need {#need}

- **Node.js 18+** and the AEM CLI: `npm install -g @adobe/aem-cli`
- The repo cloned, with `npm install` run once (lint tooling only, nothing builds)
- A **da.live** workspace for authored content (see Quick Start)
- An **AEM instance** with DAM assets. This choice matters for ASC, see
  [Choosing your AEM](#aem-target) below.
- For authenticated dev: a way to put EDS and AEM on **one origin** (the
  [reverse proxy](#proxy) below) and, because AEM's cookie is `Secure`,
  [local HTTPS](#tls)

### Choosing your AEM {#aem-target}

ASC relies on AEM features that only exist on **AEM as a Cloud Service**, not in the
local quickstart jar. Pick your target with that in mind:

| Target | Web-optimized delivery, DM OpenAPI, smart crops, asset-microservice renditions | Use it for |
|--------|:---:|-----------|
| **RDE** (Rapid Development Environment) **(recommended)** | yes | Full-feature ASC development with a fast deploy loop. A real Cloud Service environment, so everything works, deployed to in seconds with the `aio aem rde` CLI. |
| **Cloud dev / stage publish** | yes | Full-feature development against a shared environment. |
| **Local AEM SDK** (quickstart jar) | **no** | Front end, blocks, styling, QueryBuilder search, and the auth cookie plumbing only. The SDK does not run asset microservices, so web-optimized delivery, the `openapi` search provider, smart crops, and cloud rendition generation are unavailable, and many thumbnails will not resolve. |

> **Why not the SDK by default?** The local SDK is great for front-end iteration,
> but it cannot reproduce the cloud delivery and search surfaces ASC uses most. If
> you point `aem.host` at an SDK and images or OpenAPI search come back empty, this
> is why. Use **RDE** (or a Cloud dev instance) for anything rendition, delivery,
> or OpenAPI related.

**RDE in brief.** RDE is an AEMaaCS program environment tuned for rapid iteration.
It runs the same stack as every other Cloud Service environment (so all asset
features work) but lets you deploy bundles and content in seconds without a full
Cloud Manager pipeline, via the Adobe I/O CLI
(`aio plugins:install @adobe/aio-cli-plugin-aem-rde`, then `aio aem rde install`).
Point ASC's `aem.host` at the RDE **publish** host.

---

## The dev loop {#loop}

```bash
aem up            # serves local code at http://localhost:3000, proxies content
npm run lint      # ESLint + StyleLint; npm run lint:fix to autofix
```

- **Code** is served from your working copy. Change a block's JS or CSS, save,
  reload. No bundling.
- **Content** (pages, nav, footer) comes from da.live via your `fstab.yaml`
  mountpoint.
- **AEM data** (search, renditions, downloads) comes from the host in
  `scripts/asc/configurations.js` under `aem.host`.

For a public DAM this is all you need. Set `aem.host`, make sure AEM allows your
requests, and go. Authentication is the only thing that needs the single origin.

---

## Why a single origin {#why}

ASC authenticates by riding AEM's `login-token` **cookie** (see
[Authentication]({{ '/auth' | relative_url }})). A cookie only reaches AEM if the
browser considers the request **same site** as the cookie's domain. A Bearer token
cannot help here, because `<img>` and rendition requests cannot carry a header.

So for authenticated development, EDS and AEM must share a registrable domain. The
cleanest way, locally and in production, is to put both **behind one origin** with
a reverse proxy. Then the cookie is first party and there is no CORS at all.

---

## Quick path: local SDK ports {#quick}

This shortcut applies **only if you develop against the local AEM SDK**, and it
inherits all of the SDK's [feature limitations](#aem-target), so it is for front
end and auth-plumbing work, not rendition or OpenAPI work. For RDE or a Cloud
instance, skip to the [reverse proxy](#proxy).

With the SDK it needs **no proxy**: the browser treats "site" as scheme plus
registrable domain and **ignores the port**, so `localhost:3000` (EDS) and
`localhost:4503` (AEM) are already **same site**. The `login-token` cookie (domain
`localhost`) rides your `<img>` and fetch requests.

```js
// scripts/asc/configurations.js
aem: { host: 'http://localhost:4503' },   // local SDK publish
users: {
  strategy: 'aem',
  aem: { profilePath: '/libs/granite/security/currentuser.json' },
},
```

Two caveats:

- A credentialed fetch from `:3000` to `:4503` is still **cross origin**, so AEM
  must return CORS headers for `http://localhost:3000` with credentials (see
  [No proxy? Use CORS](#cors)).
- AEM's `login-token` is marked `Secure` in most configurations, which requires
  **HTTPS**. Over plain `http://localhost` a Secure cookie will not be set. If that
  bites you, use the reverse proxy with [local TLS](#tls) instead.

Good enough to validate auth logic fast against an SDK; the reverse proxy below is
what you use for RDE or Cloud, and mirrors production more faithfully.

---

## Reverse proxy: one origin (recommended) {#proxy}

Front both services with a single hostname. Everything on AEM paths proxies to AEM;
everything else goes to `aem up`. The browser sees one origin, so the cookie is
first party and CORS disappears.

Use a local hostname that resolves to your machine. `*.localtest.me` always points
at `127.0.0.1`, so `asc.localtest.me` needs no `/etc/hosts` edit. The AEM upstream
here is your **RDE or Cloud publish** host, so all delivery and OpenAPI features
work; swap in `https://localhost:4503` only if you accept the
[SDK limitations](#aem-target).

**Caddy** (easiest, gives automatic local HTTPS):

```
# Caddyfile
asc.localtest.me {
    # AEM paths ASC calls: APIs, renditions, auth handler, profile probe, logout.
    @aem path /content/* /bin/* /adobe/* /libs/* /system/* /saml_login* /callback/*
    handle @aem {
        # Your RDE/Cloud publish host (or https://localhost:4503 for a local SDK).
        reverse_proxy https://publish-pXXXX-eYYYY.adobeaemcloud.com {
            header_up Host {upstream_hostport}
        }
    }
    # Everything else is the EDS dev server.
    handle {
        reverse_proxy localhost:3000
    }
}
```

```bash
aem up                 # EDS on :3000
caddy run              # proxy on https://asc.localtest.me
```

```js
// scripts/asc/configurations.js : AEM is now same origin as the site
aem: { host: 'https://asc.localtest.me' },
users: {
  strategy: 'aem',
  aem: {
    loginPath: '/',
    logoutPath: '/system/sling/logout.html',
    profilePath: '/libs/granite/security/currentuser.json',
  },
},
```

Open `https://asc.localtest.me` (not `localhost:3000`). API calls to
`/bin/*`, `/adobe/*`, `/content/*` route to AEM; the cookie rides everything.

> **Local SDK upstream over HTTPS?** Add `transport http { tls_insecure_skip_verify }` inside the Caddy `reverse_proxy` block to accept the SDK's self signed certificate. A real RDE/Cloud host has a valid certificate and needs nothing extra.

> **nginx** works the same way: `location ~ ^/(content|bin|adobe|libs|system|saml_login|callback)` proxies to AEM, `location /` proxies to `http://localhost:3000`. Add `proxy_set_header Host` and, for a local SDK upstream over https, `proxy_ssl_verify off` for its self signed certificate.

Adjust the AEM path list to your deployment. If your download initiate endpoint or
auth callback lives elsewhere, add its prefix to the `@aem` matcher.

---

## TLS for Secure cookies {#tls}

AEM's `login-token` is typically `Secure`, so it is only set and sent over HTTPS.
Caddy issues a trusted local certificate automatically, which is why the proxy
example uses `https://asc.localtest.me`. If you prefer another proxy, generate a
local cert with [`mkcert`](https://github.com/FiloSottile/mkcert) and terminate TLS
at the proxy. Plain `http://localhost` will silently fail to store a Secure cookie.

---

## No proxy? Use CORS {#cors}

If you develop against separate origins (the [localhost ports](#quick) path, or a
Cloud dev AEM on a different host), AEM must explicitly allow credentialed requests
from your EDS origin. On AEM, configure the CORS policy
(`com.adobe.granite.cors.impl.CORSPolicyImpl`) to allow:

- **Allowed origins:** your EDS origin, e.g. `http://localhost:3000`
- **Allow credentials:** `true`
- **Allowed paths:** the API paths ASC calls (`/bin/querybuilder`, `/adobe/assets`,
  `/content/dam`, `/libs/granite/security/currentuser.json`)

Note this covers only `fetch()` calls. It does **not** make a cross origin cookie
reach `<img>` requests, so for a Cloud dev AEM on an unrelated domain, images will
still be unauthenticated. That is exactly why the single origin proxy is the
recommended local setup.

---

## Validate auth locally {#validate}

Before wiring a real identity provider, confirm the cookie plumbing with AEM's
**native login**:

1. Start `aem up` and the proxy; set `strategy: 'aem'` and `aem.host` as above.
2. Log into AEM directly in another browser tab (native AEM login), so a
   `login-token` cookie exists for the AEM domain.
3. Place the `auth` block in a page and load the site through your single origin.
4. The `auth` block should show your AEM user and a **Sign out** button, and search
   results and images should load as that user.

Once that works, layer federation on AEM (OAuth or SAML) without changing any ASC
config. See the setup guides linked from
[Authentication]({{ '/auth' | relative_url }}).

---

## Troubleshooting {#trouble}

- **`auth` block always shows Sign in.** The session probe is not seeing the
  cookie. Confirm you loaded the single origin host (not `localhost:3000`), that a
  `login-token` cookie exists for the AEM domain, and that the request is same site.
- **No `login-token` cookie is ever set.** The cookie is `Secure` and you are on
  plain HTTP. Use the [TLS proxy](#tls).
- **Search works but images are broken when signed in.** The cookie reaches
  `fetch()` (CORS) but not `<img>` (cross site). Move to the
  [single origin proxy](#proxy).
- **CORS errors in the console.** Either front both with the proxy (removes CORS
  entirely) or configure AEM's [CORS policy](#cors) for your origin with
  credentials.
- **`aem up` content looks wrong behind the proxy.** Make sure the proxy forwards
  the `Host` header and that only AEM path prefixes are routed to AEM; everything
  else must reach `localhost:3000`.
