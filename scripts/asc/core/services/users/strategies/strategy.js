// ASC Core — do not edit. Customize via scripts/asc/configurations.js

/**
 * AuthStrategy — the single contract through which ASC obtains identity and
 * attaches credentials to AEM requests. Everything auth-related in ASC flows
 * through these methods; no block or core file branches on the mechanism (cookie
 * vs. token vs. signed URL), so a new scheme is a drop-in: write a subclass and
 * register it from configurations.js (`users.strategies`), zero core edits. This
 * mirrors `search.providers` and `renditions.resolvers`.
 *
 * Built-ins: `anonymous` (default) and `aem` (AEM native session cookie). See
 * docs/AUTH.md for the full model and a custom-strategy walkthrough.
 *
 * Every credential-delivery lever is a method here:
 *  - decorateRequest()   headers + credentials mode for fetch() API calls
 *  - authorizeMediaUrl() rewrite a browser-loaded media URL (<img>/<video>/css)
 *  - login()/logout()    start/end a session (redirect, popup, …)
 *  - isSignedIn()/getProfile() current identity
 *
 * The defaults below are the `anonymous` behavior: no credentials, no identity,
 * media URLs untouched. A subclass overrides only what it needs.
 */
export default class AuthStrategy {
  static id = 'base';

  /**
   * @param {object} config   strategy-specific config (configurations.users[<id>])
   * @param {object} rootConfig  the whole configurations.users object
   */
  constructor(config = {}, rootConfig = {}) {
    this.config = config;
    this.rootConfig = rootConfig;
  }

  /** Async one-time setup (load an SDK, probe an existing session). */
  // eslint-disable-next-line class-methods-use-this
  async init() {}

  /** @returns {boolean} whether a user is currently authenticated. */
  // eslint-disable-next-line class-methods-use-this
  isSignedIn() {
    return false;
  }

  /** @returns {Promise<{userId:string, displayName:string, email?:string}>} */
  // eslint-disable-next-line class-methods-use-this
  async getProfile() {
    return { userId: 'anonymous', displayName: 'Guest' };
  }

  /**
   * Apply auth to a fetch() init. Return a (new) init object — set `headers`
   * and/or `credentials` as the scheme requires. Default: unchanged (anonymous).
   * @param {RequestInit} init
   * @returns {Promise<RequestInit>}
   */
  // eslint-disable-next-line class-methods-use-this
  async decorateRequest(init = {}) {
    return init;
  }

  /**
   * Transform a URL the browser will load declaratively (`<img>`, `<video>`,
   * `<source>`, CSS `url()`) — the one place a header can't reach. A cookie
   * strategy leaves it untouched (the cookie rides automatically); a signed-URL
   * strategy returns a pre-authorized URL. Default: unchanged.
   * @param {string} url
   * @returns {string}
   */
  // eslint-disable-next-line class-methods-use-this
  authorizeMediaUrl(url) {
    return url;
  }

  /**
   * Begin a login flow. Typically a redirect to an auth entry point; may return
   * once the session is established (popup flows).
   * @param {string} [returnTo]  URL to come back to after login.
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async login(returnTo) {}

  /** End the session. */
  // eslint-disable-next-line class-methods-use-this
  async logout() {}
}
