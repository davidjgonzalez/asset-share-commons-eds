---
layout: page
title: Authentication
permalink: /auth
sidebar:
  - label: Authentication
    items:
      - title: Overview
        url: "#overview"
      - title: The model
        url: "#model"
      - title: Cookie, not token
        url: "#why-cookie"
      - title: Domain requirement
        url: "#domain"
      - title: Configuration
        url: "#config"
      - title: Login / logout UI
        url: "#ui"
      - title: Custom strategies
        url: "#custom"
  - label: Setup guides
    items:
      - title: OAuth / OIDC
        url: "/auth-oauth"
      - title: SAML
        url: "/auth-saml"
---

# Authentication

Asset Share Commons gets identity and attaches credentials to AEM requests through
a single pluggable **auth strategy**. Everything auth related flows through that
one seam, so adding a new scheme never touches ASC Core. You write a strategy class
and register it from `configurations.js`, exactly like a custom search provider or
rendition resolver.

> **Setup guides:** [OAuth / OIDC]({{ '/auth-oauth' | relative_url }}) and
> [SAML]({{ '/auth-saml' | relative_url }}). Both end at the same place, so they
> share one ASC configuration and differ only in how you set up AEM.

---

## Overview {#overview}

There is exactly one credential ASC relies on in the built in authenticated
strategy: the **AEM `login-token` session cookie**. Federation (OAuth/OIDC or SAML)
is configured on **AEM Publish**, not in ASC. However the user signs in, AEM
terminates the login and sets its cookie. The browser then rides that cookie on
every request to AEM automatically: `fetch()` API calls and `<img>` or rendition
loads alike. ASC never implements OAuth or SAML and never stores a token.

Three built in pieces:

- **Strategy registry** in `scripts/asc/core/services/users/` (`users.js` plus
  `strategies/`: `anonymous`, `aem`, and any you add).
- **Request chokepoint** `services.aem.authorizedFetch(url, init)`, which applies
  the active strategy to AEM requests and leaves foreign CDN or delivery URLs as a
  plain fetch.
- **Config** at `configurations.js` under `users`.

---

## The model {#model}

```
Browser                         AEM Publish
   |  1. click Sign in             |
   |------------------------------>|  AEM runs OAuth or SAML, sets login-token cookie
   |  2. redirected back to EDS    |
   |<------------------------------|
   |  3. every later request       |
   |     (fetch AND <img>)         |
   |---- login-token cookie ------>|  authenticated as the user
```

ASC only triggers step 1 (a redirect), detects the resulting session, and opts its
`fetch()` calls into sending the cookie. Steps that establish identity happen
entirely inside AEM.

---

## Cookie, not token {#why-cookie}

A Bearer token can only be attached to requests ASC issues in JavaScript
(`fetch`/XHR). Browser initiated resource loads (`<img>`, `<video>`, `<source>`,
CSS `url()`) cannot carry an `Authorization` header. For a DAM whose whole job is
showing images from AEM, a token cannot authenticate the images. A cookie can: the
browser sends it on everything, with no code. That is why the built in path is
cookie based.

---

## The one deployment requirement {#domain}

Because the credential is a cookie sent to AEM Publish, **EDS and AEM Publish must
share a registrable domain** (the same eTLD+1). Two ways to get there:

1. **Reverse proxy to one origin** (recommended). For example
   `assets.example.com/` serves EDS, and `assets.example.com/content/dam`,
   `/bin/*`, `/adobe/*` are proxied to AEM Publish. Everything is same origin, so
   the cookie is first party and there is no CORS.
2. **Shared parent domain.** Give AEM Publish a custom domain under your apex
   (`aem.example.com`) and serve EDS from the same apex (`www.example.com`). These
   are same site (same registrable domain), so the cookie is sent on `<img>` and
   `fetch` subresources. The cookie's `SameSite=Lax` or `Strict` value does not
   matter here, and Safari ITP or Chrome partitioning do not apply, because those
   affect only cross site cookies.

> Keeping EDS and AEM on **different registrable domains** (for example stock
> `*.aem.live` versus `*.adobeaemcloud.com`) is not supported by the cookie
> strategy. A cross site cookie needs `SameSite=None`, is then blocked or
> partitioned by modern browsers, and still cannot reach `<img>` reliably. For that
> topology you need self authorizing media URLs (AEM Asset Delivery signed URLs).
> See [custom strategies](#custom).

---

## Configuration {#config}

```js
// scripts/asc/configurations.js
users: {
  strategy: 'aem',                 // 'anonymous' (default) | 'aem' | <custom id>
  aem: {
    // URL templates: handler specific params live here. {returnTo} = page to return to.
    loginPath:   '/content/dam.html?redirect={returnTo}',   // OIDC example; see the setup guides
    logoutPath:  '/system/sling/logout?redirect={returnTo}',
    profilePath: '/libs/granite/security/currentuser.json', // session probe
  },
},
```

- `anonymous` (default): a fully public DAM. No identity, no credentials attached,
  media URLs untouched. Safe to ship as is.
- `aem`: AEM native session. `decorateRequest` sets `credentials:'include'`,
  `authorizeMediaUrl` is a no op (the cookie rides media on its own), `login()` and
  `logout()` redirect to AEM, and `isSignedIn()` or `getProfile()` probe
  `profilePath`. The `login-token` cookie is `HttpOnly`, so JavaScript cannot read
  it; ASC asks AEM "who am I?" instead.

The OAuth versus SAML choice is entirely AEM side and does not change any ASC
config. Both end at the `login-token` cookie, so `strategy: 'aem'` covers both. The
setup guides differ only in how you configure AEM and the `loginPath` / `logoutPath` URLs.

---

## Login and logout UI {#ui}

The user owned `blocks/auth` block renders a sign in button when signed out, or the
current user plus a sign out button when signed in, driven entirely by the strategy.
Under `anonymous` it renders nothing, so it is safe to place in the site header
whether or not auth is configured. Register it in the DA block library like any
author placed block.

---

## Writing a custom strategy {#custom}

Extend `AuthStrategy` and register it, with no core edits:

```js
// blocks/.../my-auth.js  (user owned)
import AuthStrategy from '../../scripts/asc/core/services/users/strategies/strategy.js';

export default class MyAuth extends AuthStrategy {
  static id = 'my-auth';

  async init() { /* load SDK, restore or probe session */ }
  isSignedIn() { return /* ... */; }
  async getProfile() { return { userId, displayName, email }; }

  // Headers and/or credentials for fetch() API calls:
  async decorateRequest(init = {}) {
    return { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${this.token}` } };
  }

  // Authorize a browser loaded media URL. Cookie strategies leave it unchanged;
  // a signed URL strategy returns a pre authorized URL:
  authorizeMediaUrl(url) { return signed(url); }

  async login(returnTo) { /* redirect or popup */ }
  async logout() { /* ... */ }
}
```

```js
// configurations.js
import MyAuth from '../../blocks/.../my-auth.js';
users: { strategy: 'my-auth', strategies: { 'my-auth': MyAuth } },
```

A custom id matching a built in overrides it. Because every credential delivery
lever (header, credentials mode, media URL rewrite, login or logout, identity) is a
method on the strategy, any future scheme drops in without changing a single call
site.

**Cross domain and signed URLs.** The `authorizeMediaUrl` seam exists for the one
case the cookie cannot cover: EDS and AEM on different registrable domains, where
images must carry their own auth. A strategy that uses AEM Asset Delivery signed
URLs rewrites media URLs there and uses a token in `decorateRequest` for API
`fetch()` calls, so no cross site cookie is needed. For exhaustive media coverage,
pair such a strategy with a custom rendition resolver (`renditions.resolvers`), the
layer where rendition URLs are actually minted.
