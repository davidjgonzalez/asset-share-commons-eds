// ASC Core — do not edit. Customize via scripts/configurations.js

import serviceConfigurations from '../configurations.js';

export const ANONYMOUS = 'anonymous';

/**
 * Users service — provides current user identity and auth headers.
 *
 * Auth strategy:
 * - If `window.adobeIMS` is present (injected by AEM when user is logged in via IMS/SSO),
 *   the current user's profile and access token are used.
 * - Otherwise, the user is treated as anonymous and no auth headers are sent.
 *   AEM browser-session cookies (if present) will still be forwarded by the browser.
 *
 * Note: This service does NOT bundle or load the Adobe IMS SDK. It relies on
 * AEM injecting `window.adobeIMS` as part of the page delivery when the user
 * is authenticated. For local development against a public AEM instance, no
 * auth headers will be sent.
 */
class Users {
  constructor(config) {
    this.config = config || {};
  }

  /**
   * Returns the IMS SDK instance if present, or null.
   * @returns {object|null}
   */
  get ims() {
    return window.adobeIMS || null;
  }

  /**
   * Returns true if the user is authenticated via IMS.
   * @returns {boolean}
   */
  isSignedIn() {
    return this.ims?.isSignedInUser?.() ?? false;
  }

  /**
   * Returns the current user profile.
   * For authenticated users: IMS profile object ({ userId, name, email, ... }).
   * For anonymous users: { userId: 'anonymous', displayName: 'Guest' }.
   *
   * @returns {Promise<object>}
   */
  async getCurrentUser() {
    if (this.isSignedIn()) {
      try {
        const profile = await this.ims.getProfile();
        return {
          userId: profile.userId || profile.account_type,
          displayName: profile.displayName || profile.name,
          email: profile.email,
          ...profile,
        };
      } catch {
        // IMS available but profile fetch failed; fall through to anonymous
      }
    }
    return { userId: ANONYMOUS, displayName: 'Guest' };
  }

  /**
   * Returns HTTP headers to attach to AEM API requests.
   * Includes a Bearer token when the user is signed in via IMS.
   *
   * Usage:
   *   const headers = await users.getAuthHeaders();
   *   fetch(url, { headers });
   *
   * @returns {Promise<Record<string, string>>}
   */
  async getAuthHeaders() {
    if (!this.isSignedIn()) return {};

    try {
      const token = await this.ims.getAccessToken();
      if (token?.token) {
        return { Authorization: `Bearer ${token.token}` };
      }
    } catch {
      // Token fetch failed; proceed without auth header
    }

    return {};
  }
}

export default new Users(serviceConfigurations.users || {});
