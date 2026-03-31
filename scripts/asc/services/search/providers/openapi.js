// ASC Core — do not edit. Customize via scripts/configurations.js

import SearchProvider from '../search-provider.js';
import Asset from '../../../models/asset.js';
import aem from '../../aem/aem.js';

/**
 * Search provider for AEM Dynamic Media OpenAPI Search.
 * Endpoint: GET /adobe/assets/search
 *
 * API documentation:
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/dynamic-media-open-apis/search-assets-api
 *
 * Note: This provider maps the same form data Map used by QueryBuilder to
 * OpenAPI-compatible parameters, so all search blocks work with both providers.
 */
export default class OpenApiProvider extends SearchProvider {
  constructor(config) {
    super(config);
    this.searchUrl = config.url || aem.getUrl('/adobe/assets/search');
    this.pageSize = config.pageSize || 24;
  }

  /**
   * Maps JCR date property paths to their OpenAPI filter key equivalents.
   * Used when translating QB daterange predicates → OpenAPI filter params.
   */
  static get DATE_PROPERTY_MAP() {
    return {
      'jcr:content/metadata/jcr:created': 'createdAt',
      'jcr:created': 'createdAt',
      'jcr:content/metadata/dam:assetCreated': 'createdAt',
      'jcr:content/metadata/jcr:lastModified': 'modifiedAt',
      'jcr:lastModified': 'modifiedAt',
      'jcr:content/metadata/dam:assetLastModified': 'modifiedAt',
    };
  }

  /**
   * Maps common JCR metadata property paths to their OpenAPI filter key equivalents.
   * Used when translating QB property predicates → OpenAPI filter params.
   */
  static get PROPERTY_MAP() {
    return {
      'jcr:content/metadata/dc:format': 'assetFormat',
      'jcr:content/metadata/cq:tags': 'assetTagIds',
    };
  }

  /**
   * Translate form data (QueryBuilder-style field names) into OpenAPI query params.
   *
   * The search blocks emit QB-native field names like:
   *   `{n}_group.{predicate}.{param}` (e.g. `2_group.daterange.lowerBound`)
   *
   * This method performs a two-pass scan:
   *   Pass 1 — group all `{n}_group.*` entries by their group number and predicate name
   *   Pass 2 — map each known predicate type to its OpenAPI equivalent filter param
   *
   * Predicates handled:
   *   daterange  → filter[createdAt|modifiedAt][from|to]
   *   tagid      → filter[assetTagIds][]
   *   property   → filter[assetFormat][] (for dc:format) and other mapped properties
   *
   * @param {Map} formData
   * @returns {URLSearchParams}
   */
  buildParams(formData) {
    const params = new URLSearchParams();

    // ── Top-level, non-group params ─────────────────────────────────────────
    if (formData.has('fulltext')) {
      params.set('q', formData.get('fulltext'));
    }

    const path = formData.get('path') || formData.get('0_group.path');
    if (path) params.set('filter[assetAncestorPath]', path);

    params.set('p.offset', formData.get('p.offset') || '0');
    params.set('p.limit', formData.get('p.limit') || String(this.pageSize));

    const orderby = formData.get('orderby');
    if (orderby) {
      const sortFieldMap = {
        '@jcr:content/metadata/dc:created': 'created',
        '@jcr:content/metadata/dc:title': 'name',
        '@jcr:score': 'score',
      };
      const sortOrder = formData.get('orderby.sort') || 'desc';
      params.set('sort', `${sortFieldMap[orderby] || 'created'}:${sortOrder}`);
    }

    // ── Pass 1: collect QB predicate groups ─────────────────────────────────
    // Matches `{groupNum}_group.{predicateName}.{paramKey}` (e.g. `2_group.daterange.lowerBound`)
    const groups = {};
    formData.forEach((value, name) => {
      const match = name.match(/^(\d+)_group\.(\w+)\.(.+)$/);
      if (!match) return;
      const [, groupNum, predicateName, paramKey] = match;
      const g = (groups[groupNum] ??= {});
      const p = (g[predicateName] ??= {});
      if (/^\d+_value$/.test(paramKey)) {
        // Indexed values (e.g. 0_value, 1_value) → collected as an array
        (p.values ??= []).push(value);
      } else {
        p[paramKey] = value;
      }
    });

    // ── Pass 2: map known predicates to OpenAPI filter params ───────────────
    Object.values(groups).forEach((group) => {
      // daterange predicate → filter[createdAt|modifiedAt][from|to]
      if (group.daterange) {
        const { property, lowerBound, upperBound } = group.daterange;
        const filterKey = OpenApiProvider.DATE_PROPERTY_MAP[property] || 'createdAt';
        if (lowerBound) params.set(`filter[${filterKey}][from]`, lowerBound);
        if (upperBound) params.set(`filter[${filterKey}][to]`, upperBound);
      }

      // tagid predicate → filter[assetTagIds][]
      if (group.tagid?.values?.length) {
        group.tagid.values.forEach((tag) => params.append('filter[assetTagIds][]', tag));
      }

      // property predicate — map known JCR property paths to OpenAPI equivalents
      if (group.property?.property && group.property?.values?.length) {
        const { property: jcrProp, values } = group.property;
        const filterKey = OpenApiProvider.PROPERTY_MAP[jcrProp];
        if (filterKey) {
          values.forEach((v) => params.append(`filter[${filterKey}][]`, v));
        }
      }
    });

    // Pass through any filter[*] params injected verbatim (e.g. from search-hidden).
    // Already-set params are not overwritten — explicit mapping above takes precedence.
    formData.forEach((value, name) => {
      if (!name.startsWith('filter[') || params.has(name)) return;
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(name, v));
      } else {
        params.set(name, value);
      }
    });

    return params;
  }

  async search(formData) {
    let params = this.buildParams(formData);

    if (this.config.preprocessQuery) {
      params = await this.config.preprocessQuery(params);
    }

    const headers = { Accept: 'application/json', ...await aem.getHeaders() };
    const response = await fetch(`${this.searchUrl}?${params}`, { headers });

    const data = await response.json();

    // Map OpenAPI response shape to the normalized ASC results shape
    const hits = data.assetResults || data.hits || [];
    let results = {
      more: data.nextCursor !== null && data.nextCursor !== undefined,
      offset: parseInt(params.get('p.offset') || '0', 10),
      size: hits.length,
      total: data.total?.value !== undefined ? data.total.value : hits.length,
      success: response.ok,
      assets: hits.map((hit) => {
        // Normalize OpenAPI asset shape to the JCR-style object Asset expects
        const normalized = this._normalizeHit(hit);
        const asset = new Asset(normalized);
        window.asc.cache.assets.set(asset.uuid, asset);
        return asset;
      }),
    };

    if (this.config.postprocessResults) {
      results = await this.config.postprocessResults(results);
    }

    return results;
  }

  /**
   * Normalize an OpenAPI search hit to the JCR-style object shape
   * that the Asset model expects.
   */
  _normalizeHit(hit) {
    const metadata = hit['asset:metadata'] || hit.metadata || {};
    return {
      'jcr:path': hit.path || hit['asset:path'],
      'jcr:content': {
        'metadata': {
          'dc:title': metadata['dc:title'] || hit.name,
          'dc:description': metadata['dc:description'],
          'dc:format': metadata['dc:format'],
          ...metadata,
        },
        'dam:assetLastModified': hit.modified,
        'dam:size': metadata['asset:size'],
      },
      'jcr:uuid': hit.id || hit.assetId,
      'jcr:created': hit.created,
    };
  }

  async getAssetById(id) {
    if (window.asc.cache.assets.has(id)) {
      return window.asc.cache.assets.get(id);
    }

    const headers = { Accept: 'application/json', ...await aem.getHeaders() };
    const response = await fetch(aem.getUrl(`/adobe/assets/${id}`), { headers });

    if (!response.ok) return null;
    const hit = await response.json();
    const asset = new Asset(this._normalizeHit(hit));
    window.asc.cache.assets.set(asset.uuid, asset);
    return asset;
  }
}
