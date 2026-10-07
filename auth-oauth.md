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
      - title: 3. Configure ASC
        url: "#asc"
      - title: 4. Verify
        url: "#verify"
      - title: Troubleshooting
        url: "#trouble"
  - label: See also
    items:
      - title: Auth overview
        url: "/auth"
      - title: SAML setup
        url: "/auth-saml"
      - title: Local Development
        url: "/local-development"
---

# Auth Setup: OAuth / OIDC

This guide configures **AEM Publish** as an OpenID Connect (OIDC) client so a user
who signs in at your identity provider ends up with an AEM `login-token` cookie.
Asset Share Commons then rides that cookie. Read the
[Auth overview]({{ '/auth' | relative_url }}) first for the model and the single
domain requirement, and [Local Development]({{ '/local-development' | relative_url }})
to put EDS and AEM on one origin.

> ASC does not implement OAuth. AEM performs the OIDC flow and sets the cookie.
> The AEM side below follows Adobe's documentation,
> [Open ID Connect Support for AEM as a Cloud Service on Publish Tier](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/open-id-connect-support-for-aem-as-a-cloud-service-on-publish-tier){:target="_blank"}.
> Property names can change between AEM releases, so treat that page as the source of
> truth if anything here disagrees.

---

## How it fits {#how}

```
Sign in -> AEM protected path -> AEM OIDC handler -> your IdP -> back to
{protected path}/j_security_check -> AEM sets login-token cookie
-> redirect to the page named in ?redirect= -> ASC sees the session
```

Two facts shape the ASC side:

- Login is triggered by requesting a **path the handler protects**. There is no
  separate login endpoint.
- The post login destination is the **`redirect` query parameter**, and it must be a
  **relative path**. Absolute URLs are rejected (open redirect protection). That is
  why ASC and AEM sharing one origin matters.

---

## Prerequisites {#prereqs}

- AEM as a Cloud Service with a **publish** tier (OIDC is a publish tier feature).
  An [RDE]({{ '/local-development' | relative_url }}#aem-target) works.
- An OIDC provider. The example below uses a free **Auth0** tenant.
- EDS and AEM on one origin, for example `https://asc.localtest.me` from the
  [Local Development]({{ '/local-development' | relative_url }}) page. The values
  below use that host; substitute yours.

---

## 1. Register the application at Auth0 {#idp}

1. In the Auth0 dashboard open **Applications > Applications > Create Application**.
   Choose **Regular Web Applications**.
2. On the **Settings** tab, note the **Domain** (for example
   `dev-abc123.us.auth0.com`), **Client ID**, and **Client Secret**.
3. Set **Allowed Callback URLs** to the AEM callback. AEM requires it to be the
   protected path plus `/j_security_check`:

   ```
   https://asc.localtest.me/content/dam/j_security_check
   ```

4. Set **Allowed Logout URLs** to where users return after sign out, for example
   `https://asc.localtest.me/`.
5. Save, then create a test user under **User Management > Users**.

The OIDC metadata lives at
`https://<your-domain>/.well-known/openid-configuration`. AEM reads it from the
`baseUrl` you configure next.

---

## 2. Configure AEM {#aem}

OIDC on AEMaaCS publish needs five OSGi configurations. Put them in your project's
`ui.config` under `.../osgiconfig/config.publish/` (or deploy them to an RDE).
Replace the Auth0 domain, secret name, and host with yours. Use `auth0` as the
unique suffix and connection name throughout.

**1. Connection** `org.apache.sling.auth.oauth_client.impl.OidcConnectionImpl~auth0.cfg.json`

```json
{
  "name": "auth0",
  "scopes": ["openid", "profile", "email"],
  "baseUrl": "https://dev-abc123.us.auth0.com",
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "$[secret:AUTH0_CLIENT_SECRET]",
  "endSessionEndpoint": "https://dev-abc123.us.auth0.com/oidc/logout"
}
```

Store the secret as a Cloud Manager environment secret named `AUTH0_CLIENT_SECRET`.
Never commit it.

**2. Handler** `org.apache.sling.auth.oauth_client.impl.OidcAuthenticationHandler~auth0.cfg.json`

```json
{
  "path": ["/content/dam"],
  "callbackUri": "https://asc.localtest.me/content/dam/j_security_check",
  "pkceEnabled": false,
  "defaultConnectionName": "auth0",
  "idp": "auth0-idp"
}
```

`path` is what gets protected, and `callbackUri` must be that path plus
`/j_security_check` and match what you registered at Auth0 exactly. Protecting
`/content/dam` means anonymous visitors are challenged for any asset, which is a good
first test. See [a login only path](#opt-in) for keeping the DAM public.

**3. User info** `org.apache.sling.auth.oauth_client.impl.SlingUserInfoProcessorImpl~auth0.cfg.json`

```json
{
  "connection": "auth0",
  "groupsInIdToken": false,
  "storeAccessToken": false,
  "storeRefreshToken": false,
  "storeIdToken": true,
  "idpNameInPrincipals": true
}
```

**4. Sync** `org.apache.jackrabbit.oak.spi.security.authentication.external.impl.DefaultSyncHandler~auth0.cfg.json`

```json
{
  "handler.name": "auth0",
  "user.pathPrefix": "auth0",
  "group.pathPrefix": "oidc",
  "user.expirationTime": "1h",
  "user.membershipExpTime": "1h",
  "group.expirationTime": "1d",
  "user.membershipNestingDepth": "1",
  "user.dynamicMembership": true,
  "user.enforceDynamicMembership": true,
  "group.dynamicGroups": true,
  "user.propertyMapping": [
    "profile/givenName=profile/given_name",
    "profile/familyName=profile/family_name",
    "rep:fullname=profile/name",
    "profile/email=profile/email",
    "id_token=id_token"
  ]
}
```

**5. Login module** `org.apache.jackrabbit.oak.spi.security.authentication.external.impl.ExternalLoginModuleFactory~auth0.cfg.json`

```json
{
  "sync.handlerName": "auth0",
  "idp.name": "auth0-idp"
}
```

The names must line up: `idp` in the handler equals `idp.name` in the login module,
and `handler.name` in the sync handler equals `sync.handlerName`.

Deploy these to publish. Also confirm your **dispatcher and CDN** allow the callback
path and `j_security_check`, and do not cache the authenticated responses. Adobe's
OIDC page does not cover this, so check it against your own dispatcher config.

> **Single logout** (clearing the Auth0 session too) needs
> `enableSPInitiatedSingleLogout`, `logoutRedirectPath`, and
> `logoutRedirectAllowedHosts` on the handler, plus syncing the stored ID token to
> publish. Skip it for the first test; sign out will still clear the AEM cookie.

---

## 3. Configure ASC {#asc}

The AEM URLs above carry handler specific parameters, so they live in config, not in
code. `{returnTo}` is replaced with the page to return to, as a relative path.

```js
// scripts/asc/configurations.js
aem: { host: 'https://asc.localtest.me' },   // your single origin
users: {
  strategy: 'aem',
  aem: {
    // Requesting a protected path starts the OIDC flow.
    loginPath: '/content/dam.html?redirect={returnTo}',
    logoutPath: '/system/sling/logout?redirect={returnTo}',
    profilePath: '/libs/granite/security/currentuser.json',
  },
},
```

Place the `auth` block in your header so users have a **Sign in** button.

---

## 4. Verify {#verify}

1. Load the site over your single origin. The `auth` block shows **Sign in**.
2. Click it. You go to AEM, then Auth0, then back to the page you were on.
3. In dev tools (Application, Cookies) confirm a `login-token` cookie for your host.
4. Open `/libs/granite/security/currentuser.json`. It should name your user instead of
   `anonymous`.
5. Confirm search and images still load, and that the cookie is sent on `<img>`
   requests.
6. The `auth` block shows your name and **Sign out**.

---

## Keeping the DAM public: a login only path {#opt-in}

Protecting `/content/dam` forces everyone to sign in. To keep it public and make login
optional, protect a small dedicated path instead (for example `/content/asc-login`),
point `path`, `callbackUri`, and `loginPath` at it, and give signed in users extra
access with ACLs. This needs a content node at that path, so create and deploy one
first. Verify the behavior on your environment before relying on it.

---

## Troubleshooting {#trouble}

- **Always shows Sign in after returning.** The probe is not seeing the cookie. Check
  the cookie exists for your single origin host and the probe request is same site.
- **Redirect loop or error at the IdP.** The callback URL registered at Auth0 does not
  match `callbackUri` exactly, or `loginPath` is not under the handler's `path`.
- **Lands on a raw AEM page after login.** The `redirect` parameter was dropped or was
  not a relative path. Check `loginPath` includes `?redirect={returnTo}`.
- **Login works, images broken.** The cookie is not reaching `<img>` requests, so EDS
  and AEM are not same site. See [Local Development]({{ '/local-development' | relative_url }}).
- **Issuer or metadata errors.** Some IdPs publish an issuer with a trailing slash. If
  `baseUrl` discovery fails, replace it with the manual endpoints
  (`authorizationEndpoint`, `tokenEndpoint`, `jwkSetURL`, `issuer`) shown on Adobe's
  OIDC page.
- **Blocked by CORS.** Only appears when ASC and AEM are different origins. A single
  origin proxy avoids it.
