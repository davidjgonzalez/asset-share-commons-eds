// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import AuthStrategy from './strategy.js';
import serviceConfigurations from '../../configurations.js';

const DEFAULT_PROFILE_PATH = '/libs/granite/security/currentuser.json';

/**
 * AemSessionStrategy — authenticates straight to AEM Publish using AEM's own
 * session. Federation (OAuth/OIDC or SAML) is configured on AEM, not here: in
 * every case AEM terminates the login and sets its `login-token` cookie, which
 * the browser then attaches to *every* request to AEM automatically — fetch()
 * API calls AND `<img>`/rendition loads alike. That single cookie is the only
 * credential ASC relies on.
 *
 * Because the credential is a cookie going to AEM Publish, EDS and AEM Publish
 * MUST share a registrable domain (reverse proxy to one origin, or give AEM a
 * custom domain under your apex). See docs/AUTH.md. The `login-token` cookie's
 * SameSite=Lax/Strict is a non-issue once same-site.
 *
 * ASC does not implement OAuth or SAML itself and never stores a token:
 *  - decorateRequest → `credentials:'include'` (opt the fetch into sending the cookie)
 *  - authorizeMediaUrl → unchanged (the cookie rides media loads on its own)
 *  - login()/logout() → redirect to AEM's auth entry / logout
 *  - isSignedIn()/getProfile() → probe AEM (the cookie is HttpOnly, so JS can't
 *    read it; we ask AEM "who am I?")
 *
 * Config (configurations.users.aem):
 *   loginPath   URL (path + query) that triggers federation. Handler-specific params live
 *               here, not in code. `{returnTo}` is replaced with where to land afterward.
 *   logoutPath  AEM logout URL; `{returnTo}` supported the same way
 *   profilePath session probe (default /libs/granite/security/currentuser.json)
 */
export default class AemSessionStrategy extends AuthStrategy {
  static id = 'aem';

  constructor(config = {}, rootConfig = {}) {
    super(config, rootConfig);
    this.host = (serviceConfigurations.aem?.host || '').replace(/\/$/, '');
    this.loginPath = config.loginPath || '/';
    this.logoutPath = config.logoutPath || '';
    this.profilePath = config.profilePath || DEFAULT_PROFILE_PATH;
    this._signedIn = false;
    this._profile = null;
  }

  async init() {
    // The login-token cookie is HttpOnly and unreadable from JS, so detect the
    // session by asking AEM. credentials:'include' sends the cookie (same-site).
    try {
      const resp = await fetch(`${this.host}${this.profilePath}`, { credentials: 'include' });
      if (!resp.ok) return;
      const data = await resp.json();
      const userId = data.userId || data.authorizableId || data.id;
      if (userId && userId !== 'anonymous') {
        this._signedIn = true;
        this._profile = {
          userId,
          displayName: data.name || data.displayName || userId,
          email: data.email || data['profile/email'],
          ...data,
        };
      }
    } catch {
      // AEM unreachable or CORS-blocked — treat as anonymous.
    }
  }

  isSignedIn() {
    return this._signedIn;
  }

  async getProfile() {
    return this._profile || { userId: 'anonymous', displayName: 'Guest' };
  }

  // eslint-disable-next-line class-methods-use-this
  async decorateRequest(init = {}) {
    // Cookie-based: no Authorization header, just opt into sending credentials.
    return { ...init, credentials: 'include' };
  }

  /** Redirect the browser to the configured AEM login URL. */
  login(returnTo = window.location.href) {
    window.location.assign(this._url(this.loginPath, returnTo));
  }

  /** Redirect to the configured AEM logout URL (or just reload if none). */
  logout(returnTo = window.location.href) {
    if (!this.logoutPath) {
      window.location.reload();
      return;
    }
    window.location.assign(this._url(this.logoutPath, returnTo));
  }

  /** Resolve a path template against the AEM host, substituting {returnTo}. */
  _url(template, returnTo) {
    const path = template.replace('{returnTo}', encodeURIComponent(this._relativeReturn(returnTo)));
    return new URL(path, `${this.host}/`).toString();
  }

  /**
   * AEM's OIDC/SAML handlers accept only a RELATIVE post-login/logout redirect
   * (no scheme, no `//`) as open-redirect protection. That is workable when EDS and
   * AEM share an origin (reverse proxy), where a path means the same thing on both.
   * Across different hosts a relative path would resolve against AEM, so pass the
   * absolute URL through and let AEM's own allow-list decide.
   */
  _relativeReturn(returnTo) {
    const target = new URL(returnTo, window.location.href);
    const sameOrigin = target.origin === new URL(this.host).origin;
    return sameOrigin ? `${target.pathname}${target.search}${target.hash}` : target.href;
  }
}
