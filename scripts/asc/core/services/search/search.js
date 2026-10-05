// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import serviceConfigurations from '../configurations.js';
import QueryBuilderProvider from './providers/querybuilder.js';
import OpenApiProvider from './providers/openapi.js';
import {
  createRequest, encodeRequest, decodeRequest, normalizeFilter, DEFAULT_SORT,
} from './request.js';

export const Events = {
  SEARCH_START: 'asc:search:execute',
  SEARCH_COMPLETE: 'asc:search:complete',
  SEARCH_ERROR: 'asc:search:error',
};

// Built-in provider registry. Add custom providers from configurations.js via
// `search.providers` (object keyed by id) — a custom entry with a built-in's id
// overrides it. Mirrors `renditions.resolvers`, so no block ever edits this file.
const BUILT_IN_PROVIDERS = {
  querybuilder: QueryBuilderProvider,
  openapi: OpenApiProvider,
};

// Skip skeleton / incomplete assets (no MIME type or no static renditions).
// Override via configurations.search.accepts.
const DEFAULT_ACCEPTS = (asset) => asset.mimeType && asset.staticRenditions.length > 0;

class SearchService {
  constructor(config) {
    this.config = config;
    this.accepts = config.accepts || DEFAULT_ACCEPTS;
    this.form = config.form || 'asc-search-form';
    this.pageSize = config.pageSize || 24;
    this.searchInProgress = false;
    this._offset = 0;
    this._lastResult = null;

    const providers = { ...BUILT_IN_PROVIDERS, ...(config.providers || {}) };
    const ProviderClass = providers[config.provider || 'querybuilder'];
    if (!ProviderClass) {
      throw new Error(`Unknown search provider: "${config.provider}". Valid values: ${Object.keys(providers).join(', ')}`);
    }
    this.provider = new ProviderClass(config);

    // Static, developer-authored baseline filters (neutral descriptors), always applied.
    this.baseFilters = (config.baseFilters || []).map(normalizeFilter);
    this._sheetFilters = [];
    this._sheetReady = null;

    this.init();
  }

  init() {
    document.addEventListener(Events.SEARCH_START, (event) => {
      if (event.detail?.source === 'query-params') {
        this.executeSearchFromUrl(event.detail.value || window.location.search);
      } else {
        this.executeSearchFromForm(event);
      }
    });

    document.addEventListener('asc:blocks:loaded', () => {
      if (document.querySelector('.block.search-bar, .block.search-results, .block.search-property, .block.search-path, .block.search-tags, .block.search-date-range')) {
        this.executeSearchFromUrl(window.location.search);
      }
    });
  }

  getForm() {
    return this.form;
  }

  // ── Sheet-authored neutral filters ──────────────────────────────────────────

  _requireSheet() {
    if (!this._sheetReady) this._sheetReady = this._loadSheetFilters();
    return this._sheetReady;
  }

  async _loadSheetFilters() {
    const url = this.config.sheet;
    if (!url) return;
    try {
      const resp = await fetch(`${url}.json?sheet=search-filters`);
      if (!resp.ok) return;
      const { data = [] } = await resp.json();
      this._sheetFilters = data.map((row) => normalizeFilter({
        id: row.id || undefined,
        type: row.type,
        field: row.field,
        op: row.op,
        match: row.match,
        values: typeof row.values === 'string' ? row.values.split('|').map((v) => v.trim()).filter(Boolean) : row.values,
      })).filter((f) => f.type && (f.values.length || f.type === 'similar'));
    } catch { /* sheet missing or malformed — degrade to no sheet filters */ }
  }

  // ── Request assembly ─────────────────────────────────────────────────────────

  /**
   * Read a neutral SearchRequest from the DOM form. Filter value inputs carry a
   * `data-asc-filter` descriptor (JSON: id/type/field/op/match/meta); inputs sharing
   * an id accumulate values. Date bounds use `data-asc-bound="lower|upper"`. Text,
   * sort field and sort direction controls carry data-asc-search-* flags.
   */
  collectRequest(formId) {
    const inputs = document.querySelectorAll(`[form="${formId}"], form#${formId} [name]`);
    let text = '';
    const sort = { ...DEFAULT_SORT };
    const byId = new Map();

    inputs.forEach((input) => {
      const ds = input.dataset || {};
      if (ds.ascSearchText !== undefined) { text = (input.value || '').trim(); return; }
      if (ds.ascSearchSort !== undefined) { if (input.value) sort.field = input.value; return; }
      if (ds.ascSearchDir !== undefined) { if (input.value) sort.direction = input.value; return; }
      if (!ds.ascFilter) return;

      const value = this.getInputValue(input);
      let base;
      try { base = JSON.parse(ds.ascFilter); } catch { return; }
      const entry = byId.get(base.id) || { base, values: [], bounds: {} };
      if (ds.ascBound) {
        if (!this.isEmpty(value)) entry.bounds[ds.ascBound] = value;
      } else if (Array.isArray(value)) {
        value.forEach((v) => { if (v) entry.values.push(v); });
      } else if (!this.isEmpty(value)) {
        entry.values.push(value);
      }
      byId.set(base.id, entry);
    });

    const filters = [...byId.values()].map(({ base, values, bounds }) => {
      if (base.type === 'daterange') {
        return { ...base, values: [bounds.lower || '', bounds.upper || ''] };
      }
      return { ...base, values };
    });

    return createRequest({
      text, filters, sort, limit: this.pageSize, offset: this._offset,
    });
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

  isEmpty(value) {
    if (Array.isArray(value)) return value.length === 0 || value.every((v) => v === '');
    return value === '' || value == null;
  }

  /** Merge developer base filters + sheet filters + user filters into one request. */
  _mergeFilters(request) {
    return {
      ...request,
      filters: [...this.baseFilters, ...this._sheetFilters, ...request.filters],
    };
  }

  // ── Execution ────────────────────────────────────────────────────────────────

  /** Background search — no URL update, no events, no concurrency lock. */
  async searchSilent(partial) {
    await this._requireSheet();
    const request = this._mergeFilters(createRequest(partial));
    try {
      const results = await this.provider.search(request);
      if (results?.assets && this.accepts) {
        results.assets = results.assets.filter((a) => this.accepts(a));
        results.size = results.assets.length;
      }
      return results ?? { assets: [], total: 0, size: 0 };
    } catch {
      return { assets: [], total: 0, size: 0 };
    }
  }

  async executeSearchFromUrl(queryParams = window.location.search) {
    this._offset = 0;
    const request = decodeRequest(queryParams);
    request.limit = this.pageSize;
    const results = await this._search(request, { updateUrl: false });
    document.dispatchEvent(new CustomEvent(Events.SEARCH_COMPLETE, {
      detail: { results, request, type: 'page-load' },
    }));
  }

  async executeSearchFromForm(event) {
    const formId = event.detail?.form || this.getForm();
    if (event.detail?.type === 'load-more' && this._lastResult) {
      this._offset = (this._lastResult.offset || 0) + (this._lastResult.size || 0);
    } else {
      this._offset = 0;
    }
    const request = this.collectRequest(formId);
    const results = await this._search(request, { updateUrl: true });
    if (results === undefined) return; // concurrent search — drop
    document.dispatchEvent(new CustomEvent(Events.SEARCH_COMPLETE, {
      detail: { results, request, type: event.detail?.type || 'filter' },
    }));
  }

  async _search(request, { updateUrl } = {}) {
    if (this.searchInProgress) return undefined;
    this.searchInProgress = true;
    await this._requireSheet();

    try {
      const merged = this._mergeFilters(request);
      if (updateUrl) this.updateBrowserUrl(request); // URL carries only user filters, not base/sheet

      const results = await this.provider.search(merged);

      if (results && this.accepts) {
        const before = results.assets.length;
        results.assets = results.assets.filter((asset) => this.accepts(asset));
        const removed = before - results.assets.length;
        results.size = results.assets.length;
        results.total = Math.max(0, (results.total || 0) - removed);
      }

      this._lastResult = results;
      return results;
    } catch (error) {
      console.error('Search failed:', error);
      document.dispatchEvent(new CustomEvent(Events.SEARCH_ERROR, {
        detail: { error, request },
      }));
      return {
        more: false, offset: 0, size: 0, total: 0, success: false, assets: [], error: error.message,
      };
    } finally {
      this.searchInProgress = false;
    }
  }

  /** Serialize only the user's request (text/filters/sort/limit) to the URL. */
  updateBrowserUrl(request) {
    const url = new URL(window.location);
    url.search = encodeRequest(request).toString();
    window.history.replaceState({}, '', url);
  }

  async getAssetById(id) {
    return this.provider.getAssetById(id);
  }
}

export default new SearchService(serviceConfigurations.search || {});
