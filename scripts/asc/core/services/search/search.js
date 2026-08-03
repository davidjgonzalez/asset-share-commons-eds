// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import serviceConfigurations from '../configurations.js';
import QueryBuilderProvider from './providers/querybuilder.js';
import OpenApiProvider from './providers/openapi.js';

export const Events = {
  SEARCH_START: 'asc:search:execute',
  SEARCH_COMPLETE: 'asc:search:complete',
  SEARCH_ERROR: 'asc:search:error',
};

// Provider registry — add custom providers here or via configurations.js
const PROVIDERS = {
  querybuilder: QueryBuilderProvider,
  openapi: OpenApiProvider,
};

class SearchService {
  constructor(config) {
    this.config = config;
    this.form = config.form || 'asc-search-form';
    this.searchInProgress = false;

    // Instantiate the configured provider
    const ProviderClass = PROVIDERS[config.provider || 'querybuilder'];
    if (!ProviderClass) {
      throw new Error(`Unknown search provider: "${config.provider}". Valid values: ${Object.keys(PROVIDERS).join(', ')}`);
    }
    this.provider = new ProviderClass(config);

    this._sheetPredicates = {};
    this._sheetReady = null;

    this.init();
  }

  init() {
    document.addEventListener(Events.SEARCH_START, (event) => {
      if (event.detail?.source === 'query-params') {
        this.executeSearchFromUrl(event.detail.value || window.location.search);
      } else {
        this.executeSearchFromFormData(event);
      }
    });

    // Wait until all blocks are decorated before running the initial search.
    // The search-page check runs here — after blocks exist — not at import time.
    document.addEventListener('asc:blocks:loaded', () => {
      if (document.querySelector('.block.search-bar, .block.search-results, .block.search-property, .block.search-path, .block.search-tags, .block.search-date-range')) {
        this.executeSearchFromUrl(window.location.search);
      }
    });
  }

  getForm() {
    return this.form;
  }

  _requireSheet() {
    if (!this._sheetReady) this._sheetReady = this._loadSheetPredicates();
    return this._sheetReady;
  }

  async _loadSheetPredicates() {
    const url = this.config.sheet;
    if (!url) return;
    try {
      const resp = await fetch(`${url}.json?sheet=search-predicates`);
      if (!resp.ok) return;
      const { data = [] } = await resp.json();
      this._sheetPredicates = this._parseSheetPredicates(data);
    } catch { /* sheet missing or malformed — silently skip */ }
  }

  _parseSheetPredicates(rows) {
    const result = {};
    rows.forEach(({ name, value }) => {
      if (name && value) result[name] = value;
    });
    return result;
  }

  /**
   * Background search — inherits basePredicates and sheet predicates but does
   * not update the browser URL, fire search events, or block concurrent searches.
   * Use for programmatic fetches (similar assets, related content, etc.).
   *
   * @param {Map<string, string|string[]>} formData  QB-style params
   * @returns {Promise<{assets: Asset[], total: number, size: number}>}
   */
  async searchSilent(formData) {
    await this._requireSheet();
    const withSheet = new Map([
      ...Object.entries(this._sheetPredicates),
      ...formData,
    ]);
    try {
      const results = await this.provider.search(withSheet);
      if (results?.assets && this.config.accepts) {
        results.assets = results.assets.filter((a) => this.config.accepts(a));
        results.size = results.assets.length;
      }
      return results ?? { assets: [], total: 0, size: 0 };
    } catch {
      return { assets: [], total: 0, size: 0 };
    }
  }

  async executeSearchFromUrl(queryParams = window.location.search) {
    const formId = this.getForm();
    const formData = new Map([
      ...this.collectFormData(formId),
      ...new Map(new URLSearchParams(queryParams)),
    ]);

    const results = await this._search(formData);

    document.dispatchEvent(
      new CustomEvent(Events.SEARCH_COMPLETE, {
        detail: {
          results,
          query: queryParams,
          type: 'page-load',
          formData: new Map(formData),
        },
      }),
    );
  }

  async executeSearchFromFormData(event) {
    const formId = event.detail?.form || this.getForm();
    const formData = this.collectFormData(formId);

    if (event.detail?.type !== 'load-more') {
      formData.set('p.offset', '0');
    }

    const results = await this._search(formData);
    if (results === undefined) return; // concurrent search in flight — silently drop

    document.dispatchEvent(
      new CustomEvent(Events.SEARCH_COMPLETE, {
        detail: {
          results,
          type: event.detail?.type || 'page-load',
          formData: new Map(formData),
        },
      }),
    );
  }

  async _search(formData) {
    if (this.searchInProgress) return undefined;
    this.searchInProgress = true;

    await this._requireSheet();

    try {
      const cleaned = this.cleanFormData(formData);
      const adjusted = this.adjustFormData(cleaned);
      const withSheet = new Map([
        ...Object.entries(this._sheetPredicates),
        ...adjusted,
      ]);

      this.updateBrowserUrl(this.provider.buildParams(withSheet));

      const results = await this.provider.search(withSheet);

      if (results && this.config.accepts) {
        const before = results.assets.length;
        results.assets = results.assets.filter((asset) => this.config.accepts(asset));
        const removed = before - results.assets.length;
        results.size = results.assets.length;
        results.total = Math.max(0, (results.total || 0) - removed);
      }

      return results;
    } catch (error) {
      console.error('Search failed:', error);
      document.dispatchEvent(
        new CustomEvent(Events.SEARCH_ERROR, {
          detail: { error, formData: new Map(formData) },
        }),
      );
      return {
        more: false, offset: 0, size: 0, total: 0, success: false, assets: [], error: error.message,
      };
    } finally {
      this.searchInProgress = false;
    }
  }

  collectFormData(formId) {
    const formData = new Map();
    const inputs = document.querySelectorAll(`[form="${formId}"], form#${formId}`);

    inputs.forEach((input) => {
      const { name } = input;
      const value = this.getInputValue(input);

      if (name && value !== '') {
        if (formData.has(name)) {
          const existing = formData.get(name);
          if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            formData.set(name, [existing, value]);
          }
        } else {
          formData.set(name, value);
        }
      }
    });

    return formData;
  }

  getInputValue(input) {
    const type = input.type?.toLowerCase();
    switch (type) {
      case 'checkbox':
      case 'radio':
        return input.checked ? input.value : '';
      case 'select-multiple':
        return Array.from(input.selectedOptions).map((o) => o.value).filter((v) => v);
      default:
        return input.value?.trim() || '';
    }
  }

  cleanFormData(formData) {
    const cleaned = new Map();

    formData.forEach((value, name) => {
      if (this.isEmpty(value)) return;

      const fieldset = this.getFieldset(name);

      if (name.startsWith('asc.')) {
        cleaned.set(name, value);
      } else if (fieldset) {
        if (this.hasFieldsetSupport(fieldset, formData)) {
          cleaned.set(name, value);
        }
      } else {
        const input = document.querySelector(`[name="${CSS.escape(name)}"]`);
        const forAttribute = input?.getAttribute('for');

        if (forAttribute) {
          const fieldsetHasValidInput = Array.from(formData.keys()).some((key) => {
            const fieldsetInput = document.querySelector(`[name="${CSS.escape(key)}"]`);
            return fieldsetInput?.getAttribute('data-asc-fieldset') === forAttribute
              && !this.isEmpty(formData.get(key));
          });
          if (fieldsetHasValidInput) cleaned.set(name, value);
        } else {
          cleaned.set(name, value);
        }
      }
    });

    return cleaned;
  }

  isEmpty(value) {
    if (Array.isArray(value)) return value.length === 0 || value.every((v) => v === '');
    return value === '' || value == null;
  }

  getFieldset(inputName) {
    const input = document.querySelector(`[name="${CSS.escape(inputName)}"]`);
    return input?.getAttribute('data-asc-fieldset') || null;
  }

  hasFieldsetSupport(fieldset, formData) {
    const supportingInputs = document.querySelectorAll(`[for="${CSS.escape(fieldset)}"]`);
    for (const supportingInput of supportingInputs) {
      if (!this.isEmpty(formData.get(supportingInput.name))) return true;
    }
    return supportingInputs.length === 0;
  }

  adjustFormData(formData) {
    const adjusted = new Map(formData);
    adjusted.forEach((value, name) => {
      if (typeof value !== 'string') return;
      // Date inputs emit YYYY-MM-DD — append a time component so both providers get clean ISO 8601
      if (name.endsWith('daterange.lowerBound') && !value.includes('T')) {
        adjusted.set(name, `${value}T00:00:00.000Z`);
      } else if (name.endsWith('daterange.upperBound') && !value.includes('T')) {
        adjusted.set(name, `${value}T23:59:59.999Z`);
      }
    });
    return adjusted;
  }

  updateBrowserUrl(params) {
    const url = new URL(window.location);
    url.search = '';
    params.forEach((value, key) => url.searchParams.append(key, value));
    url.searchParams.delete('p.offset');
    window.history.replaceState({}, '', url);
  }

  /**
   * Fetch a single asset by UUID. Delegates to the active provider.
   */
  async getAssetById(id) {
    return this.provider.getAssetById(id);
  }
}

export default new SearchService(serviceConfigurations.search || {});
