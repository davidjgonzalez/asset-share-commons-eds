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

// ASC Core — do not edit. Customize via scripts/configurations.js

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

  /**
   * Returns headers for AEM API requests, including auth if the user is signed in.
   * Use this for all fetch() calls to AEM endpoints.
   *
   * @returns {Promise<Record<string, string>>}
   */
  async getHeaders() {
    return users.getAuthHeaders();
  }
}

export default new AEM(serviceConfigurations.aem || {});