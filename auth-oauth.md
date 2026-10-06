---
layout: page
title: Auth Setup: OAuth / OIDC
permalink: /auth-oauth
sidebar:
  - label: OAuth / OIDC
    items:
      - title: How it fits
        url: "#how"
      - title: Prerequisites
        url: "#prereqs"
      - title: 1. Register the IdP app
        url: "#idp"
      - title: 2. Configure AEM
        url: "#aem"
      - title: 3. Protect the path
        url: "#protect"
      - title: 4. Configure ASC
        url: "#asc"
      - title: 5. Verify
        url: "#verify"
      - title: Troubleshooting
        url: "#trouble"
  - label: See also
    items:
      - title: Auth overview
        url: "/auth"
      - title: SAML setup
        url: "/auth-saml"
---

# Auth Setup: OAuth / OIDC

This guide configures **AEM Publish** as an OpenID Connect relying party so that a
user signing in through your OAuth or OIDC identity provider ends up with an AEM
`login-token` cookie. Asset Share Commons then rides that cookie. Read the
[Auth overview]({{ '/auth' | relative_url }}) first for the model and the domain
requirement.

> ASC does not implement OAuth. AEM performs the OIDC flow and sets the cookie.
> ASC only triggers the redirect and detects the resulting session.

---

## How it fits {#how}

```
User -> AEM protected path -> AEM OIDC handler -> your IdP -> back to AEM
     -> AEM sets login-token cookie -> redirect to EDS -> ASC sees the session
```

The only ASC setting that matters is `loginPath`: the AEM URL that triggers the
OIDC flow and then returns to EDS.

---

## Prerequisites {#prereqs}

- AEM as a Cloud Service (the OIDC authentication handler ships with AEMaaCS).
- An OAuth/OIDC identity provider (Okta, Azure AD / Entra ID, Ping, Auth0, Google,
  Adobe IMS, and so on).
- EDS and AEM Publish served from the **same registrable domain**. See the
  [domain requirement]({{ '/auth#domain' | relative_url }}). Set this up before
  testing, or the cookie will not reach your images.

---

## 1. Register the application with your IdP {#idp}

In your IdP, create an OIDC web application and record:

- **Client ID** and **Client secret**.
- **Issuer** (the OIDC discovery base, for example
  `https://your-idp.example.com/`).
- **Redirect URI**: the AEM callback. For the AEMaaCS OIDC handler this is
  typically `https://<your-aem-domain>/system/console` style callback or the
  handler's configured callback path. Use the callback path you set in step 2.
- **Scopes**: at least `openid profile email`.

---

## 2. Configure the AEM OIDC authentication handler {#aem}

Add an OSGi configuration to your AEM Publish configuration in the repository
(`/apps/<your-app>/osgiconfig/config.publish/`). The relevant factory is the
Adobe Granite OAuth / OIDC authentication handler. A representative configuration:

```json
// com.adobe.granite.auth.oauth.impl.OidcAuthenticationHandler~asc.cfg.json
{
  "path": ["/content/dam", "/bin/querybuilder", "/adobe/assets"],
  "callbackUri": "https://<your-aem-domain>/callback/oidc",
  "clientId": "$[env:OIDC_CLIENT_ID]",
  "clientSecret": "$[secret:OIDC_CLIENT_SECRET]",
  "issuer": "https://your-idp.example.com/",
  "scopes": ["openid", "profile", "email"],
  "createUser": true,
  "userIDProperty": "email"
}
```

Notes:

- Store `clientSecret` as a Cloud Manager secret environment variable, never in
  source.
- `createUser: true` lets AEM provision a user record on first login so each
  visitor is a real principal (which is what enforces per user asset access).
- The exact PID and property names vary by AEM version. Confirm against your
  AEM release documentation.

---

## 3. Protect the resource paths {#protect}

AEM only runs the handler on paths it guards. The `path` values above cover the
endpoints ASC calls (QueryBuilder, OpenAPI assets, and DAM renditions). Make sure
anonymous access to those paths is closed if you want authentication enforced, and
left open if you want a public browse with optional sign in. Decide this
deliberately: ASC supports both because the `aem` strategy simply sends the cookie
when present.

---

## 4. Configure ASC {#asc}

```js
// scripts/asc/configurations.js
users: {
  strategy: 'aem',
  aem: {
    // A path AEM guards with the OIDC handler. Hitting it while unauthenticated
    // starts the OIDC flow; afterward AEM returns to the resource in `resource`.
    loginPath: '/content/dam',
    logoutPath: '/system/sling/logout.html',
    profilePath: '/libs/granite/security/currentuser.json',
  },
},
```

`loginPath` should be a path the handler protects, so navigating to it triggers
login. ASC appends the current page as `resource` so AEM returns the user to EDS
after authenticating.

---

## 5. Verify {#verify}

1. Deploy AEM config and publish. Set ASC `strategy: 'aem'`.
2. Place the `auth` block in your header. Load the site signed out: you should see
   **Sign in**.
3. Click **Sign in**. You are redirected to AEM, then to your IdP, then back.
4. Confirm the `login-token` cookie exists for your AEM domain (browser dev tools,
   Application, Cookies).
5. Confirm images load and search returns results while signed in. The network
   panel should show the cookie on requests to AEM, including `<img>` requests.
6. The `auth` block should now show your name and **Sign out**.

---

## Troubleshooting {#trouble}

- **Images broken when signed in, search works.** The cookie is not reaching
  `<img>` requests, which means EDS and AEM are not same site. Fix the
  [domain topology]({{ '/auth#domain' | relative_url }}).
- **Always shows Sign in after returning from IdP.** The session probe
  (`profilePath`) is not seeing the cookie. Check that `profilePath` is on the AEM
  host, that the cookie was set, and that the probe request is same site.
- **Redirect loop.** `loginPath` is not actually protected, so AEM never
  challenges, or the callback URI does not match what the IdP has registered.
- **Blocked by CORS on the probe or search.** If any ASC request is still cross
  origin, AEM must return `Access-Control-Allow-Origin` for your EDS origin plus
  `Access-Control-Allow-Credentials: true`. A same origin reverse proxy avoids this
  entirely.
