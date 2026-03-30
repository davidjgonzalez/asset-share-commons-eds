// ASC Core — do not edit. Customize via scripts/configurations.js

import SearchProvider from '../search-provider.js';
import Asset from '../../../models/asset.js';
import aem from '../../aem/aem.js';

/**
 * Search provider for AEM QueryBuilder API.
 * Endpoint: GET /bin/querybuilder.json
 *
 * QueryBuilder predicate documentation:
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-api
 */
export default class QueryBuilderProvider extends SearchProvider {
  constructor(config) {
    super(config);
    this.searchUrl = config.url || aem.getUrl('/bin/querybuilder.json');
    this.basePath = config.basePath || '/content/dam';
    this.pageSize = config.pageSize || 24;
  }

  getBaseParams() {
    return {
      type: 'dam:Asset',
      path: this.basePath,
      mainasset: 'true',
      orderby: 'dam:created',
      'orderby.sort': 'desc',
      'p.guessTotal': 'true',
    };
  }

  buildParams(formData) {
    const merged = new Map([
      ...Object.entries(this.getBaseParams()),
      ...formData,
    ]);

    merged.set('p.hits', this.config.hits || 'full');
    if (this.config.hits === 'selective' && this.config.properties?.length) {
      merged.set('p.properties', this.config.properties.join(' '));
    } else {
      merged.set('p.nodedepth', '10');
    }

    const params = new URLSearchParams();
    merged.forEach((value, name) => {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(name, v));
      } else {
        params.append(name, value);
      }
    });

    return params;
  }

  async search(formData) {
    const params = this.buildParams(formData);

    let queryParams = params;
    if (this.config.preprocessQuery) {
      queryParams = await this.config.preprocessQuery(queryParams);
    }

    const headers = await aem.getHeaders();
    const response = await fetch(`${this.searchUrl}?${queryParams}`, { headers });
    const qbResults = await response.json();

    let results = {
      more: qbResults.more,
      offset: qbResults.offset,
      size: qbResults.results,
      total: qbResults.total,
      success: qbResults.success,
      assets: qbResults.hits?.map((hit) => {
        const asset = new Asset(hit);
        window.asc.cache.assets.set(asset.uuid, asset);
        return asset;
      }) || [],
    };

    if (this.config.postprocessResults) {
      results = await this.config.postprocessResults(results);
    }

    return results;
  }

  /**
   * Fetch a single asset by UUID using QueryBuilder.
   * Used by asset details and collection hydration.
   */
  async getAssetById(id) {
    if (window.asc.cache.assets.has(id)) {
      return window.asc.cache.assets.get(id);
    }

    const params = new URLSearchParams({
      type: 'dam:Asset',
      property: 'jcr:uuid',
      'property.value': id,
      'p.limit': '1',
      'p.hits': 'full',
      'p.nodedepth': '10',
    });

    const headers = await aem.getHeaders();
    const response = await fetch(`${this.searchUrl}?${params}`, { headers });
    const data = await response.json();

    if (!data.hits?.length) return null;
    const asset = new Asset(data.hits[0]);
    window.asc.cache.assets.set(asset.uuid, asset);
    return asset;
  }
}
