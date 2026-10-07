# Authentication

ASC obtains identity and attaches credentials to AEM requests through a single
pluggable **auth strategy**. Everything auth-related flows through that one seam,
so adding a new scheme never touches ASC Core — you write a strategy class and
register it from `configurations.js`, exactly like a custom search provider or
rendition resolver.

- **Code:** `scripts/asc/core/services/users/` — `users.js` (registry + delegation)
  and `strategies/` (`strategy.js` base, `anonymous.js`, `aem.js`).
- **Config:** `configurations.js` → `users`.
- **Request chokepoint:** `services.aem.authorizedFetch(url, init)`.
- **Step-by-step setup guides** (OAuth, SAML) live on the docs site under
  *Authentication*.

## The model in one paragraph

There is exactly one credential ASC relies on in the built-in authenticated
strategy: the **AEM `login-token` session cookie**. Federation — OAuth/OIDC or
SAML — is configured on **AEM Publish**, not in ASC. However the user signs in,
AEM terminates the login and sets its cookie; the browser then rides that cookie
on *every* request to AEM automatically — `fetch()` API calls **and** `<img>` /
rendition loads alike. ASC never implements OAuth or SAML and never stores a
token.

## Why cookie, not Bearer token

A Bearer token can only be attached to requests ASC issues in JS (`fetch`/XHR).
Browser-initiated resource loads — `<img>`, `<video>`, `<source>`, CSS `url()` —
**cannot carry an `Authorization` header**. For a DAM whose whole job is showing
images from AEM, a token can't authenticate the images. A cookie can: the browser
sends it on everything, with no code. So the built-in path is cookie-based.

## The one deployment requirement

Because the credential is a cookie sent to AEM Publish, **EDS and AEM Publish must
share a registrable domain** (eTLD+1). Two ways to get there:

1. **Reverse proxy to one origin** (recommended) — e.g. `assets.example.com/` →
   EDS, and `assets.example.com/content/dam`, `/bin/*`, `/adobe/*` → AEM Publish.
   Everything is same-origin: the cookie is first-party and there is no CORS.
2. **Shared parent domain** — give AEM Publish a custom domain under your apex
   (`aem.example.com`) and serve EDS from the same apex (`www.example.com`). These
   are **same-site** (same registrable domain), so the cookie is sent on `<img>`
   and `fetch` subresources — `SameSite=Lax`/`Strict` is a non-issue, and Safari
   ITP / Chrome partitioning do **not** apply (those hit only cross-*site*
   cookies).

> Keeping EDS and AEM on **different registrable domains** (e.g. stock `*.aem.live`
> vs `*.adobeaemcloud.com`) is **not supported by the cookie strategy**: a
> cross-site cookie needs `SameSite=None` and is then blocked/partitioned by
> modern browsers, and it still can't reach `<img>` reliably. For that topology
> you need self-authorizing media URLs (AEM Asset Delivery signed URLs) — see
> *Cross-domain / signed URLs* below.

## Configuration

```js
// configurations.js
users: {
  strategy: 'aem',                 // 'anonymous' (default) | 'aem' | <custom id>
  aem: {
    // URL templates: handler-specific params live in config, not code.
    // {returnTo} is replaced with the page to come back to (relative path).
    loginPath:   '/content/dam.html?redirect={returnTo}',   // OIDC; SAML uses /system/sling/login?...&saml_request_path={returnTo}
    logoutPath:  '/system/sling/logout?redirect={returnTo}',
    profilePath: '/libs/granite/security/currentuser.json', // session probe
  },
},
```

- `anonymous` (default): public DAM. No identity, no credentials attached, media
  URLs untouched. Safe to ship as-is.
- `aem`: AEM native session. `decorateRequest` sets `credentials:'include'`;
  `authorizeMediaUrl` is a no-op (the cookie rides media on its own); `login()` /
  `logout()` redirect to AEM; `isSignedIn()` / `getProfile()` probe `profilePath`
  (the cookie is `HttpOnly`, so JS can't read it — ASC asks AEM "who am I?").

The OAuth-vs-SAML choice is **purely AEM-side** and does not change any ASC
config: both end at the `login-token` cookie, so `strategy: 'aem'` covers both.
The setup guides differ only in how you configure AEM and what `loginPath` points
at.

## The request chokepoint

All AEM requests go through one method — no call site decides headers or
`credentials` itself:

```js
const res = await services.aem.authorizedFetch(url, init);
```

It applies the active strategy to AEM-host URLs and leaves foreign URLs (CDN / DM
delivery) as a plain `fetch`. This is what unifies the whole codebase on one auth
decision.

## Login / logout UI

The user-owned `blocks/auth` block renders a sign-in button (signed out) or the
current user + sign-out (signed in), driven entirely by the strategy. Under
`anonymous` it renders nothing, so it is safe to place in the site header
unconditionally. Register it in the DA block library like any author-placed block.

## Writing a custom auth strategy

Extend `AuthStrategy` and register it — **no core edits**:

```js
// blocks/.../my-auth.js  (user-owned)
import AuthStrategy from '../../scripts/asc/core/services/users/strategies/strategy.js';

export default class MyAuth extends AuthStrategy {
  static id = 'my-auth';

  async init() { /* load SDK, restore/probe session */ }
  isSignedIn() { return /* … */; }
  async getProfile() { return { userId, displayName, email }; }

  // Headers and/or credentials for fetch() API calls:
  async decorateRequest(init = {}) {
    return { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${this.token}` } };
  }

  // Authorize a browser-loaded media URL (<img>/<video>/css). Cookie strategies
  // leave it unchanged; a signed-URL strategy returns a pre-authorized URL:
  authorizeMediaUrl(url) { return signed(url); }

  async login(returnTo) { /* redirect or popup */ }
  async logout() { /* … */ }
}
```

```js
// configurations.js
import MyAuth from '../../blocks/.../my-auth.js';
users: { strategy: 'my-auth', strategies: { 'my-auth': MyAuth } },
```

A custom id matching a built-in overrides it. Because every credential-delivery
lever (header, credentials mode, media-URL rewrite, login/logout, identity) is a
method on the strategy, any future scheme drops in without changing a single call
site.

### Cross-domain / signed URLs

The `authorizeMediaUrl` seam exists for the one case the cookie can't cover:
**EDS and AEM on different registrable domains**, where images must carry their
own auth. A strategy that uses **AEM Asset Delivery signed URLs** rewrites media
URLs there (and uses a token in `decorateRequest` for the API `fetch()` calls),
so no cross-site cookie is needed. For exhaustive media coverage, pair such a
strategy with a **custom rendition resolver** (`renditions.resolvers`) — the layer
where rendition URLs are actually minted — since `authorizeMediaUrl` is applied at
the primary display emission points, not inside the lower-level URL utilities.
This combination is the supported way to run fully cross-domain; it is a
deployment choice, not something ASC builds by default.
