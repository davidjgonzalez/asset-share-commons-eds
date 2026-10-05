// ASC Core — do not edit. Customize via scripts/asc/configurations.js

/**
 * SearchProvider is the base class for all search API implementations.
 *
 * A provider turns a provider-neutral SearchRequest (see request.js) into a concrete
 * API call. It never sees block markup or provider syntax from anywhere else — the
 * whole mapping lives here, in a *translator registry* keyed by neutral filter type.
 *
 * ── Translator registry (the extension point) ────────────────────────────────
 * Each provider declares `static translators = { [filterType]: translateFn }`. A
 * translator receives a normalized FilterDescriptor and returns an array of
 * `[key, value]` pairs to append to the provider's query params:
 *
 *   static translators = {
 *     property: (filter, ctx) => [[`${ctx.group}_group.property.property`, filter.field], …],
 *   };
 *
 * Supporting a new neutral filter type — or a predicate the provider doesn't use yet
 * (e.g. an unused QueryBuilder predicate) — is ONE new entry, no other code change.
 * A type with no translator for the active provider is skipped with a console warning
 * (never silently dropped), so a type can roll out provider-by-provider.
 *
 * Projects extend/override the registry from configurations.js WITHOUT editing core:
 *   search: { translators: { querybuilder: { myType: fn }, openapi: { myType: fn } } }
 * (keyed by each provider's static `id`; a custom entry overrides a built-in of the
 * same type). This mirrors renditions.resolvers and search.providers.
 *
 * ── To add a whole new provider ──────────────────────────────────────────────
 * 1. Extend this class in your own (user-owned) module.
 * 2. Give it a static `id`, a static `translators` map, and implement applyScaffold()
 *    (text/sort/paging/base params) + search() + getAssetById().
 * 3. Register it from configurations.js: search: { provider: 'my-id',
 *    providers: { 'my-id': MyProvider } }.
 */
export default class SearchProvider {
  static id = 'base';

  /** @type {Record<string, (filter: object, ctx: object) => Array<[string, string]>>} */
  static translators = {};

  constructor(config = {}) {
    this.config = config;
    // Built-in translators, extended/overridden by configurations.search.translators[id].
    this.translators = {
      ...this.constructor.translators,
      ...(config.translators?.[this.constructor.id] || {}),
    };
  }

  /**
   * Turn a neutral SearchRequest into provider query params.
   * Default implementation: provider scaffold (text/sort/paging/base) + one translator
   * per filter. Providers normally override applyScaffold(), not this.
   *
   * @param {object} request  normalized SearchRequest (see request.js)
   * @returns {URLSearchParams}
   */
  buildRequest(request) {
    const params = new URLSearchParams();
    this.applyScaffold(params, request);
    request.filters.forEach((filter, index) => {
      const translate = this.translators[filter.type];
      if (typeof translate !== 'function') {
        // eslint-disable-next-line no-console
        console.warn(`[ASC] search provider "${this.constructor.id}" has no translator for filter type "${filter.type}" — filter skipped.`);
        return;
      }
      const pairs = translate(filter, { index, group: index + 1, provider: this, request }) || [];
      pairs.forEach(([key, value]) => {
        if (value == null || value === '') return;
        params.append(key, String(value));
      });
    });
    return params;
  }

  /**
   * Add provider-level scaffold params that aren't per-filter: free text, sort,
   * paging, and any provider base/structural params. Providers override this.
   * eslint-disable-next-line no-unused-vars
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  applyScaffold(params, request) {
    // no-op by default
  }

  /**
   * Execute a search and return normalized results.
   * @param {object} request - normalized SearchRequest
   * @returns {Promise<{assets: Asset[], total: number, size: number, offset: number, more: boolean, success: boolean}>}
   */
  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async search(request) {
    throw new Error('SearchProvider.search() must be implemented');
  }

  /**
   * Fetch a single asset by UUID.
   * @param {string} id
   */
  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async getAssetById(id) {
    throw new Error('SearchProvider.getAssetById() must be implemented');
  }
}

// ── Shared translator helpers ────────────────────────────────────────────────

/** Expand a YYYY-MM-DD bound to a full ISO instant (start-of-day / end-of-day). */
export function expandDateBound(value, which) {
  if (!value) return value;
  if (value.includes('T')) return value;
  return which === 'upper' ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
}
