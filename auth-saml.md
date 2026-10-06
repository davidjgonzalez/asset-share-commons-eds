---
layout: page
title: Auth Setup: SAML
permalink: /auth-saml
sidebar:
  - label: SAML
    items:
      - title: How it fits
        url: "#how"
      - title: Prerequisites
        url: "#prereqs"
      - title: 1. Exchange metadata
        url: "#metadata"
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
      - title: OAuth setup
        url: "/auth-oauth"
---

# Auth Setup: SAML

This guide configures **AEM Publish** as a SAML 2.0 service provider (SP) so that a
user signing in through your SAML identity provider ends up with an AEM
`login-token` cookie. Asset Share Commons then rides that cookie. Read the
[Auth overview]({{ '/auth' | relative_url }}) first for the model and the domain
requirement.

> ASC does not implement SAML. SAML is a server terminated, redirect and POST based
> protocol; AEM is the service provider that handles the assertion and sets the
> cookie. From ASC's point of view SAML and OAuth are identical: both end at the
> `login-token` cookie, so both use `strategy: 'aem'`.

---

## How it fits {#how}

```
User -> AEM protected path -> AEM SAML SP -> your IdP (SAML assertion)
     -> back to AEM ACS endpoint -> AEM sets login-token cookie
     -> redirect to EDS -> ASC sees the session
```

As with OAuth, the only ASC setting that matters is `loginPath`: the AEM URL that
triggers the SAML flow and then returns to EDS.

---

## Prerequisites {#prereqs}

- AEM as a Cloud Service (the SAML 2.0 authentication handler ships with AEM).
- A SAML 2.0 identity provider (Okta, Azure AD / Entra ID, Ping, ADFS, Shibboleth,
  and so on).
- EDS and AEM Publish served from the **same registrable domain**. See the
  [domain requirement]({{ '/auth#domain' | relative_url }}). Set this up before
  testing, or the cookie will not reach your images.

---

## 1. Exchange metadata with your IdP {#metadata}

SAML is a two way trust:

- **From the IdP:** obtain its metadata XML (or the signing certificate, issuer or
  entityID, and single sign on URL). AEM needs these to validate assertions.
- **To the IdP:** register AEM as a service provider. The IdP needs AEM's
  entityID and its assertion consumer service (ACS) URL, which is the AEM SAML
  handler endpoint on your AEM domain. Confirm the exact ACS path for your AEM
  version.

Map at least a NameID or email attribute so AEM can identify the user.

---

## 2. Configure the AEM SAML authentication handler {#aem}

Add an OSGi configuration to your AEM Publish configuration in the repository
(`/apps/<your-app>/osgiconfig/config.publish/`). The relevant factory is the
Adobe Granite SAML 2.0 authentication handler. A representative configuration:

```json
// com.adobe.granite.auth.saml.SamlAuthenticationHandler~asc.cfg.json
{
  "path": ["/content/dam", "/bin/querybuilder", "/adobe/assets"],
  "idpUrl": "https://your-idp.example.com/sso/saml",
  "idpCertAlias": "asc-idp",
  "serviceProviderEntityId": "https://<your-aem-domain>",
  "assertionConsumerServiceURL": "https://<your-aem-domain>/saml_login",
  "spPrivateKeyAlias": "asc-sp",
  "createUser": true,
  "addGroupMemberships": true,
  "userIDAttribute": "email",
  "nameIdFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
}
```

Notes:

- Import the IdP signing certificate into the AEM trust store under the alias you
  reference in `idpCertAlias`, and configure the SP key pair for
  `spPrivateKeyAlias`.
- `createUser: true` provisions a user record on first login, so each visitor is a
  real principal, which is what enforces per user asset access.
  `addGroupMemberships` can map IdP groups to AEM groups for finer access control.
- The exact PID and property names vary by AEM version. Confirm against your AEM
  release documentation.

---

## 3. Protect the resource paths {#protect}

AEM only runs the handler on paths it guards. The `path` values above cover the
endpoints ASC calls (QueryBuilder, OpenAPI assets, and DAM renditions). Close
anonymous access to those paths if you want authentication enforced, or leave it
open for public browse with optional sign in. The `aem` strategy sends the cookie
whenever one is present, so both modes work.

---

## 4. Configure ASC {#asc}

```js
// scripts/asc/configurations.js
users: {
  strategy: 'aem',
  aem: {
    // A path AEM guards with the SAML handler. Hitting it while unauthenticated
    // starts the SAML flow; afterward AEM returns to the resource in `resource`.
    loginPath: '/content/dam',
    logoutPath: '/system/sling/logout.html',
    profilePath: '/libs/granite/security/currentuser.json',
  },
},
```

This is the **same ASC configuration as OAuth**. Only the AEM handler differs.

---

## 5. Verify {#verify}

1. Deploy AEM config and publish. Set ASC `strategy: 'aem'`.
2. Place the `auth` block in your header. Load the site signed out: you should see
   **Sign in**.
3. Click **Sign in**. You are redirected to AEM, then to your IdP, then back
   through the ACS endpoint.
4. Confirm the `login-token` cookie exists for your AEM domain.
5. Confirm images load and search returns results while signed in, and that the
   cookie appears on `<img>` requests to AEM.
6. The `auth` block should now show your name and **Sign out**.

---

## Troubleshooting {#trouble}

- **Images broken when signed in, search works.** The cookie is not reaching
  `<img>` requests, which means EDS and AEM are not same site. Fix the
  [domain topology]({{ '/auth#domain' | relative_url }}).
- **Assertion rejected / invalid signature.** The IdP certificate in AEM's trust
  store does not match the IdP, or clock skew is too large. Re import the cert and
  check server time.
- **Returns to AEM instead of EDS after login.** Confirm ASC passes `resource` (it
  does by default) and that the AEM handler honors the post login redirect.
- **Always shows Sign in after returning.** The session probe (`profilePath`) is
  not seeing the cookie. Check it is on the AEM host and the request is same site.
- **Blocked by CORS.** If any ASC request is still cross origin, AEM must return
  `Access-Control-Allow-Origin` for your EDS origin plus
  `Access-Control-Allow-Credentials: true`. A same origin reverse proxy avoids this
  entirely.
