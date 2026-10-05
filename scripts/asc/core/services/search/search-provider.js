// ASC Core — do not edit. Customize via scripts/asc/configurations.js

/**
 * SearchProvider is the base class for all search API implementations.
 *
 * To add a custom search provider (no core edits needed):
 * 1. Extend this class in your own module (e.g. blocks/<something>/my-provider.js)
 * 2. Implement search() and buildParams()
 * 3. Register it from scripts/asc/configurations.js:
 *      import MyProvider from '../../blocks/.../my-provider.js';
 *      search: { provider: 'my-provider', providers: { 'my-provider': MyProvider } }
 *    A custom entry whose id matches a built-in ('querybuilder' / 'openapi') overrides it.
 */
export default class SearchProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Execute a search and return normalized results.
   *
   * @param {Map} formData - Collected form data from all search inputs
   * @returns {Promise<{assets: Asset[], total: number, size: number, offset: number, more: boolean, success: boolean}>}
   */
  // eslint-disable-next-line no-unused-vars
  async search(formData) {
    throw new Error('SearchProvider.search() must be implemented');
  }

  /**
   * Convert the form data Map to provider-specific query parameters.
   *
   * @param {Map} formData
   * @returns {URLSearchParams}
   */
  // eslint-disable-next-line no-unused-vars
  buildParams(formData) {
    throw new Error('SearchProvider.buildParams() must be implemented');
  }
}
