// ASC Core — do not edit. Customize via scripts/configurations.js

/**
 * SearchProvider is the base class for all search API implementations.
 *
 * To add a custom search provider:
 * 1. Extend this class
 * 2. Implement search() and buildParams()
 * 3. Set search.provider in scripts/configurations.js to your provider's id
 * 4. Register it in scripts/asc/services/search/search.js
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
