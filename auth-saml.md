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
      - title: OAuth setup
        url: "/auth-oauth"
      - title: Local Development
        url: "/local-development"
---

# Auth Setup: SAML

This guide configures **AEM Publish** as a SAML 2.0 service provider (SP) so a user who
signs in at your identity provider ends up with an AEM `login-token` cookie. Asset
Share Commons then rides that cookie. Read the [Auth overview]({{ '/auth' | relative_url }})
first for the model and the single domain requirement.

> ASC does not implement SAML. AEM is the service provider that handles the assertion
> and sets the cookie, so ASC uses the same `strategy: 'aem'` as OAuth. The AEM side
> follows Adobe's
> [SAML 2.0 on AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/authentication/saml-2-0){:target="_blank"}
> guide. Property names can change between releases, so treat that page as the source
> of truth if anything here disagrees.

---

## How it fits {#how}

```
Sign in -> /system/sling/login -> your IdP -> POST to {publish}/saml_login
-> AEM sets login-token cookie -> redirect to saml_request_path -> ASC sees the session
```

Unlike OIDC, login goes through `/system/sling/login` and the destination is the
`saml_request_path` parameter. Both are set in ASC config, not code.

---

## Prerequisites {#prereqs}

- AEM as a Cloud Service with a publish tier. An
  [RDE]({{ '/local-development' | relative_url }}#aem-target) works.
- A SAML 2.0 identity provider (Okta, Entra ID, Ping, and so on).
- EDS and AEM on one origin. See
  [Local Development]({{ '/local-development' | relative_url }}).

---

## 1. Exchange metadata with your IdP {#metadata}

- **From the IdP:** its SSO URL, its identifier (entity ID), and its signing
  certificate. Upload the certificate in AEM at **Tools > Security > Trust Store** and
  note the alias, which becomes `idpCertAlias`. Replicate it to publish.
- **To the IdP:** register AEM as a service provider. The assertion consumer service
  (ACS) URL is `https://<your-host>/saml_login`, and the SP entity ID is the value you
  set as `serviceProviderEntityId`.
- If you enable assertion encryption, add the SP private key and certificate chain
  under **Tools > Security > Users > authentication-service > Keystore**, note the
  alias for `spPrivateKeyAlias`, and keep the keystore password as a secret.

Map a NameID or attribute (for example `uid` or email) so AEM can identify the user.

---

## 2. Configure AEM {#aem}

Put these in your project's `ui.config` under `.../osgiconfig/config.publish/`.

**SAML handler** `com.adobe.granite.auth.saml.SamlAuthenticationHandler~asc.cfg.json`

```json
{
  "path": ["/content/dam"],
  "idpCertAlias": "your-idp-cert-alias",
  "idpIdentifier": "https://your-idp.example.com/entity-id",
  "idpUrl": "https://your-idp.example.com/sso/saml",
  "serviceProviderEntityId": "https://asc.localtest.me",
  "useEncryption": false,
  "createUser": true,
  "userIntermediatePath": "asc/idp",
  "addGroupMemberships": true,
  "groupMembershipAttribute": "groupMembership",
  "defaultRedirectUrl": "/",
  "userIDAttribute": "uid",
  "nameIdFormat": "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
  "handleLogout": false,
  "clockTolerance": 60,
  "service.ranking": 5002
}
```

If you turn on `useEncryption`, also set `spPrivateKeyAlias` and
`"keyStorePassword": "$[secret:SAML_AEM_KEYSTORE_PASSWORD]"`.

**Referrer filter** `org.apache.sling.security.impl.ReferrerFilter.cfg.json`

```json
{
  "allow.empty": true,
  "allow.hosts": ["your-idp.example.com"],
  "filter.methods": ["POST"],
  "exclude.agents.regexp": []
}
```

**CORS policy** `com.adobe.granite.cors.impl.CORSPolicyImpl~saml.cfg.json`

```json
{
  "alloworigin": ["https://your-idp.example.com", "null"],
  "allowedpaths": [".*/saml_login"],
  "supportedmethods": ["POST"]
}
```

**Dispatcher** must allow the SAML endpoints:

```
/0190 { /type "allow" /method "POST" /url "*/saml_login" }
/0191 { /type "allow" /method "GET"  /url "/system/sling/login" /query "*" }
/0192 { /type "allow" /method "POST" /url "/system/sling/login" }
```

Finally the protected content needs a login requirement, either a Closed User Group
with authentication required or ACLs that deny anonymous read, with authentication
support enabled and a login page set. See Adobe's guide for the exact steps.

---

## 3. Configure ASC {#asc}

```js
// scripts/asc/configurations.js
aem: { host: 'https://asc.localtest.me' },   // your single origin
users: {
  strategy: 'aem',
  aem: {
    loginPath: '/system/sling/login?resource=/content/dam&saml_request_path={returnTo}',
    logoutPath: '/system/sling/logout?resource=/content/dam&redirect={returnTo}',
    profilePath: '/libs/granite/security/currentuser.json',
  },
},
```

`{returnTo}` becomes a relative path to the page the user was on. The OAuth and SAML
setups differ only in these two URLs and the AEM configuration above.

---

## 4. Verify {#verify}

1. Load the site over your single origin. The `auth` block shows **Sign in**.
2. Click it. You go to AEM, then the IdP, then back through `/saml_login`.
3. Confirm a `login-token` cookie for your host.
4. `/libs/granite/security/currentuser.json` should name your user.
5. Confirm search and images load, and that the cookie is sent on `<img>` requests.

---

## Troubleshooting {#trouble}

- **Assertion rejected or invalid signature.** The IdP certificate in the Trust Store
  does not match the IdP, was not replicated to publish, or the clocks differ by more
  than `clockTolerance`.
- **POST to `/saml_login` blocked.** The Referrer filter, CORS policy, or dispatcher
  rule above is missing.
- **Lands on `/` instead of your page.** `saml_request_path` is missing from
  `loginPath`, so AEM falls back to `defaultRedirectUrl`.
- **Always shows Sign in after returning.** The probe is not seeing the cookie. Check
  the cookie and that the request is same site.
- **Login works, images broken.** EDS and AEM are not same site. See
  [Local Development]({{ '/local-development' | relative_url }}).
