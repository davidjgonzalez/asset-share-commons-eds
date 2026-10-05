// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import SearchProvider, { expandDateBound } from '../search-provider.js';
import Asset from '../../../models/asset.js';
import AssetAccessError from '../../../models/asset-access-error.js';
import aem from '../../aem/aem.js';

/**
 * Search provider for AEM Dynamic Media OpenAPI Search.
 * Endpoint: GET /adobe/assets/search
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/dynamic-media-open-apis/search-assets-api
 *
 * The same neutral SearchRequest used by QueryBuilder maps to OpenAPI filter params
 * through the `translators` registry below. The OpenAPI Search API has no generic
 * property filter, so a `property` filter on a field this provider can't map is
 * skipped with a warning (never silently dropped) — add the mapping to PROPERTY_MAP,
 * or supply a custom translator via configurations.search.translators.openapi.
 */

// Neutral sort vocabulary → OpenAPI sort fields.
const SORT = {
  relevance: 'score',
  created: 'created',
  modified: 'modified',
  title: 'name',
};

export default class OpenApiProvider extends SearchProvider {
  static id = 'openapi';

  /** JCR date property paths → OpenAPI date filter keys. */
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

  /** JCR metadata property paths → OpenAPI filter keys. */
  static get PROPERTY_MAP() {
    return {
      'jcr:content/metadata/dc:format': 'assetFormat',
      'jcr:content/metadata/cq:tags': 'assetTagIds',
    };
  }

  static translators = {
    property: (filter) => {
      const key = OpenApiProvider.PROPERTY_MAP[filter.field];
      if (!key) {
        // eslint-disable-next-line no-console
        console.warn(`[ASC] OpenAPI provider has no filter mapping for property "${filter.field}" — filter skipped. Add it to OpenApiProvider.PROPERTY_MAP or search.translators.openapi.`);
        return [];
      }
      return filter.values.map((v) => [`filter[${key}][]`, v]);
    },

    tags: (filter) => filter.values.map((v) => ['filter[assetTagIds][]', v]),

    path: (filter) => (filter.values.length ? [['filter[assetAncestorPath]', filter.values[0]]] : []),

    daterange: (filter) => {
      const key = OpenApiProvider.DATE_PROPERTY_MAP[filter.field] || 'createdAt';
      const [lower, upper] = filter.values;
      const pairs = [];
      if (lower) pairs.push([`filter[${key}][from]`, expandDateBound(lower, 'lower')]);
      if (upper) pairs.push([`filter[${key}][to]`, expandDateBound(upper, 'upper')]);
      return pairs;
    },

    color: (filter) => (filter.values.length ? [['filter[color]', filter.values[0]]] : []),
  };

  constructor(config) {
    super(config);
    this.searchUrl = config.url || aem.getUrl('/adobe/assets/search');
    this.pageSize = config.pageSize || 24;
  }

  applyScaffold(params, request) {
    if (request.text) params.set('q', request.text);
    params.set('p.offset', String(request.offset || 0));
    params.set('p.limit', String(request.limit || this.pageSize));
    params.set('sort', `${SORT[request.sort.field] || SORT.created}:${request.sort.direction}`);
  }

  async search(request) {
    let params = this.buildRequest(request);
    if (this.config.preprocessQuery) {
      params = await this.config.preprocessQuery(params);
    }

    const headers = { Accept: 'application/json', ...await aem.getHeaders() };
    const response = await fetch(`${this.searchUrl}?${params}`, { headers });
    const data = await response.json();

    const hits = data.assetResults || data.hits || [];
    let results = {
      more: data.nextCursor !== null && data.nextCursor !== undefined,
      offset: parseInt(params.get('p.offset') || '0', 10),
      size: hits.length,
      total: data.total?.value !== undefined ? data.total.value : hits.length,
      success: response.ok,
      assets: hits.map((hit) => {
        const asset = new Asset(this._normalizeHit(hit));
        window.asc.cache.assets.set(asset.uuid, asset);
        return asset;
      }),
    };

    if (this.config.postprocessResults) {
      results = await this.config.postprocessResults(results);
    }

    return results;
  }

  /** Normalize an OpenAPI hit to the JCR-style shape the Asset model expects. */
  // eslint-disable-next-line class-methods-use-this
  _normalizeHit(hit) {
    const metadata = hit['asset:metadata'] || hit.metadata || {};
    return {
      'jcr:path': hit.path || hit['asset:path'],
      'jcr:content': {
        metadata: {
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

  /**
   * Fetch a single asset by UUID via the direct resource endpoint. Unlike QueryBuilder,
   * a forbidden asset returns a real 401/403 here (distinguishable from 404), surfaced
   * as an AssetAccessError so callers (e.g. collection hydration) can tell them apart.
   */
  async getAssetById(id) {
    if (window.asc.cache.assets.has(id)) {
      return window.asc.cache.assets.get(id);
    }

    const headers = { Accept: 'application/json', ...await aem.getHeaders() };
    const response = await fetch(aem.getUrl(`/adobe/assets/${id}`), { headers });

    if (response.status === 401 || response.status === 403) {
      return new AssetAccessError(id, response.status);
    }
    if (!response.ok) return null;
    const hit = await response.json();
    const asset = new Asset(this._normalizeHit(hit));
    window.asc.cache.assets.set(asset.uuid, asset);
    return asset;
  }
}
