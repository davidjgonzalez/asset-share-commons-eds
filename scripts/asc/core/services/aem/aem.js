// Copyright 2025 David G.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import serviceConfigurations from '../configurations.js';
import users from '../users/users.js';

class AEM {
  constructor(config) {
    this.config = config || {};

    this.preconnect();
  }
  
  preconnect() {
    if (!document.querySelector(`head link[rel="preconnect"][href="${this.getHost()}"]`)) {
      document.head.insertAdjacentHTML('beforeend', `<link rel="preconnect" href="${this.getHost()}" fetchpriority="high" crossorigin />`);
    }    
  }

  getHost() {
    return this.config.host.replace(/\/$/, '');
  }

  getUrl(path) {
    return `${this.getHost()}${path}`;
  }

  isLocalhost() {
    return this.config.host?.includes('localhost');
  }

  /** True when `url` targets this AEM host (so auth should be applied). */
  isAemUrl(url) {
    const host = this.getHost();
    return Boolean(host) && String(url).startsWith(host);
  }

  /**
   * The single chokepoint for AEM requests. Applies the active auth strategy
   * (headers and/or credentials mode) to AEM-bound requests and leaves foreign
   * URLs (CDN/DM delivery) untouched. Use this for ALL fetch() calls that might
   * hit AEM — callers never decide headers or `credentials` themselves.
   *
   * @param {string} url
   * @param {RequestInit} [init]
   * @returns {Promise<Response>}
   */
  async authorizedFetch(url, init = {}) {
    if (!this.isAemUrl(url)) return fetch(url, init);
    const decorated = await users.decorateRequest(init);
    return fetch(url, decorated);
  }

  /**
   * Headers the active auth strategy would attach to an AEM request. Prefer
   * authorizedFetch(); use this only when building a request init by hand.
   *
   * @returns {Promise<Record<string, string>>}
   */
  async getHeaders() {
    return users.getAuthHeaders();
  }
}

export default new AEM(serviceConfigurations.aem || {});