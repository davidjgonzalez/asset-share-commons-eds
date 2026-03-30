// ASC Core — do not edit. Customize via scripts/configurations.js

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

    this.init();
  }

  init() {
    // Only initialize on pages that have search blocks.
    if (!document.querySelector('.block.search-bar, .block.search-results, .block.search-property, .block.search-path')) {
      return;
    }

    document.addEventListener(Events.SEARCH_START, (event) => {
      if (event.detail?.source === 'query-params') {
        this.executeSearchFromUrl(event.detail.value || window.location.search);
      } else {
        this.executeSearchFromFormData(event);
      }
    });

    document.addEventListener('asc:blocks:loaded', () => {
      this.executeSearchFromUrl(window.location.search);
    });
  }

  getForm() {
    return this.form;
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

    const safeResults = results || {
      more: false, offset: 0, size: 0, total: 0, success: false, assets: [],
    };

    document.dispatchEvent(
      new CustomEvent(Events.SEARCH_COMPLETE, {
        detail: {
          results: safeResults,
          type: event.detail?.type || 'page-load',
          formData: new Map(formData),
        },
      }),
    );
  }

  async _search(formData) {
    if (this.searchInProgress) return undefined;
    this.searchInProgress = true;

    try {
      const cleaned = this.cleanFormData(formData);
      const adjusted = this.adjustFormData(cleaned);

      this.updateBrowserUrl(this.provider.buildParams(adjusted));

      return await this.provider.search(adjusted);
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
