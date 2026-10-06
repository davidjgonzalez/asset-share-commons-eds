// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import serviceConfigurations from '../configurations.js';
import AnonymousStrategy from './strategies/anonymous.js';
import AemSessionStrategy from './strategies/aem.js';

export const ANONYMOUS = 'anonymous';

/**
 * Users service — identity + credential delivery, delegated to a pluggable
 * AuthStrategy (see strategies/strategy.js). The strategy is the single seam;
 * this class just selects one and forwards to it.
 *
 * Built-in strategy registry. Add/override from configurations.js via
 * `users.strategies` (keyed by id) — a custom entry with a built-in's id
 * overrides it. Mirrors `search.providers` / `renditions.resolvers`.
 */
const BUILT_IN_STRATEGIES = {
  anonymous: AnonymousStrategy,
  aem: AemSessionStrategy,
};

class Users {
  constructor(config) {
    this.config = config || {};

    const strategies = { ...BUILT_IN_STRATEGIES, ...(this.config.strategies || {}) };
    const id = this.config.strategy || ANONYMOUS;
    const StrategyClass = strategies[id];
    if (!StrategyClass) {
      throw new Error(`Unknown auth strategy: "${id}". Valid values: ${Object.keys(strategies).join(', ')}`);
    }

    // Per-strategy config lives under its id (e.g. users.aem); the whole users
    // config is passed as the second arg for strategies that need siblings.
    this.strategy = new StrategyClass(this.config[id] || {}, this.config);
    this._ready = Promise.resolve(this.strategy.init?.()).catch(() => {});
  }

  /** Await strategy setup (session probe, SDK load) before reading sign-in state. */
  ready() {
    return this._ready;
  }

  /** The active strategy's id. */
  get strategyId() {
    return this.strategy.constructor.id;
  }

  isSignedIn() {
    return this.strategy.isSignedIn();
  }

  /** Current user profile ({ userId, displayName, email, ... }). */
  async getProfile() {
    return this.strategy.getProfile();
  }

  /** @deprecated alias retained for compatibility — use getProfile(). */
  async getCurrentUser() {
    return this.strategy.getProfile();
  }

  /** Apply the active strategy's auth to a fetch() init (headers + credentials). */
  async decorateRequest(init = {}) {
    return this.strategy.decorateRequest(init);
  }

  /**
   * Headers-only view of the strategy's request decoration. Retained for callers
   * that build a fetch() init by hand; prefer aem.authorizedFetch().
   * @returns {Promise<Record<string,string>>}
   */
  async getAuthHeaders() {
    const { headers = {} } = await this.strategy.decorateRequest({});
    return headers;
  }

  /** Authorize a browser-loaded media URL (<img>/<video>/css). */
  authorizeMediaUrl(url) {
    return this.strategy.authorizeMediaUrl(url);
  }

  /** Start a login flow (strategy decides: redirect, popup, …). */
  async login(returnTo) {
    return this.strategy.login(returnTo);
  }

  /** End the session. */
  async logout() {
    return this.strategy.logout();
  }
}

export default new Users(serviceConfigurations.users || {});
