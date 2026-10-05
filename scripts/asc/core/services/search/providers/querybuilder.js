// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import SearchProvider, { expandDateBound } from '../search-provider.js';
import Asset from '../../../models/asset.js';
import aem from '../../aem/aem.js';

/**
 * Search provider for AEM QueryBuilder API.
 * Endpoint: GET /bin/querybuilder.json
 *
 * Predicate reference:
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates
 *
 * Neutral filter types are mapped to QueryBuilder predicates by the `translators`
 * registry below. Each filter becomes its own numbered predicate group
 * (`${group}_group.…`), so filters never collide regardless of page layout.
 * To support a QB predicate not covered here (e.g. `fulltext.relPath`, `nodename`,
 * `rangeproperty`), add one entry to `translators` (here, or from
 * configurations.search.translators.querybuilder — no core edit needed).
 */

// Neutral sort vocabulary → QueryBuilder orderby fields.
const SORT = {
  relevance: '@jcr:score',
  created: '@jcr:content/metadata/dc:created',
  modified: '@jcr:content/metadata/dc:modified',
  title: '@jcr:content/metadata/dc:title',
};

// Neutral op → QueryBuilder property `operation` value.
const OP = {
  equals: 'equals',
  'not-equals': 'unequals',
  exists: 'exists',
  contains: 'like',
  like: 'like',
};

export default class QueryBuilderProvider extends SearchProvider {
  static id = 'querybuilder';

  static translators = {
    property: (filter, { group }) => {
      const base = `${group}_group.property`;
      const pairs = [[`${base}.property`, filter.field], [`${base}.operation`, OP[filter.op] || 'equals']];
      if (filter.match === 'all') pairs.push([`${base}.and`, 'true']);
      filter.values.forEach((v, i) => pairs.push([`${base}.${i}_value`, v]));
      return pairs;
    },

    tags: (filter, { group }) => {
      const base = `${group}_group.tagid`;
      const pairs = [[`${base}.property`, filter.field || 'jcr:content/metadata/cq:tags']];
      if (filter.match === 'all') pairs.push([`${base}.and`, 'true']);
      filter.values.forEach((v, i) => pairs.push([`${base}.${i}_value`, v]));
      return pairs;
    },

    path: (filter, { group }) => {
      const base = `${group}_group`;
      if (filter.values.length <= 1) {
        const pairs = [[`${base}.path`, filter.values[0]]];
        if (filter.meta?.exact) pairs.push([`${base}.path.exact`, 'true']);
        if (filter.meta?.flat) pairs.push([`${base}.path.flat`, 'true']);
        return pairs;
      }
      // Multiple paths → separate path predicates, OR'd unless match:'all'.
      const pairs = [];
      if (filter.match !== 'all') pairs.push([`${base}.p.or`, 'true']);
      filter.values.forEach((v, i) => pairs.push([`${base}.${i + 1}_path`, v]));
      return pairs;
    },

    daterange: (filter, { group }) => {
      const base = `${group}_group.daterange`;
      const [lower, upper] = filter.values;
      const pairs = [[`${base}.property`, filter.field]];
      if (lower) {
        pairs.push([`${base}.lowerBound`, expandDateBound(lower, 'lower')]);
        pairs.push([`${base}.lowerOperation`, filter.meta?.lowerOp || '>=']);
      }
      if (upper) {
        pairs.push([`${base}.upperBound`, expandDateBound(upper, 'upper')]);
        pairs.push([`${base}.upperOperation`, filter.meta?.upperOp || '<=']);
      }
      return pairs;
    },

    // More-like-this (QueryBuilder only; OpenAPI has no equivalent and warns+skips).
    similar: (filter, { group }) => {
      const base = `${group}_group.similar`;
      const pairs = [[base, filter.values[0] || filter.field]];
      if (filter.meta?.fields) pairs.push([`${base}.mltfields`, filter.meta.fields]);
      return pairs;
    },
  };

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
      'p.guessTotal': 'true',
    };
  }

  applyScaffold(params, request) {
    Object.entries(this.getBaseParams()).forEach(([k, v]) => params.set(k, v));

    if (request.text) params.set('fulltext', request.text);

    params.set('orderby', SORT[request.sort.field] || SORT.created);
    params.set('orderby.sort', request.sort.direction);

    params.set('p.offset', String(request.offset || 0));
    params.set('p.limit', String(request.limit || this.pageSize));

    params.set('p.hits', this.config.hits || 'full');
    if (this.config.hits === 'selective' && this.config.properties?.length) {
      params.set('p.properties', this.config.properties.join(' '));
    } else {
      params.set('p.nodedepth', '10');
    }
  }

  async search(request) {
    let params = this.buildRequest(request);
    if (this.config.preprocessQuery) {
      params = await this.config.preprocessQuery(params);
    }

    const headers = await aem.getHeaders();
    const response = await fetch(`${this.searchUrl}?${params}`, { headers });
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
   *
   * Note: QueryBuilder enforces JCR read ACLs by silently filtering forbidden nodes
   * out of the result set — a viewer without read access gets `hits: []` with HTTP 200,
   * identical to a UUID that doesn't exist. There's no reliable way to distinguish
   * "forbidden" from "not found" here, so (unlike the OpenAPI provider's direct GET,
   * which surfaces a real 401/403) this returns bare `null` for both.
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
