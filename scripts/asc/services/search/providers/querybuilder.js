// ASC Core — do not edit. Customize via scripts/configurations.js

import SearchProvider from '../search-provider.js';
import Asset from '../../../models/asset.js';
import aem from '../../aem/aem.js';

/**
 * Search provider for AEM QueryBuilder API.
 * Endpoint: GET /bin/querybuilder.json
 *
 * QueryBuilder predicate reference:
 * https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates
 *
 * ─── Supported predicates ────────────────────────────────────────────────────
 *
 * All predicates are supported — parameters are passed to the API verbatim.
 * Use `basePredicates` in configurations.js to set static filters.
 * Search block inputs generate form field names that become QB parameters.
 *
 * ── Structural ───────────────────────────────────────────────────────────────
 *
 * group / N_group         Nested AND/OR groups.
 *   p.or=true             Any predicate in the group must match (OR).
 *   p.not=true            Negate the group.
 *   N_<predicate>         Multiple instances of the same predicate type.
 *
 * orderby                 Sort field (prefix with @ for JCR properties).
 *   orderby.sort          'asc' | 'desc'
 *   orderby.case          'ignore' for case-insensitive sort
 *   N_orderby             Multi-property sort (1_orderby, 2_orderby …)
 *
 * ── Property matching ────────────────────────────────────────────────────────
 *
 * property                Match a JCR property value.
 *   property.value        Exact value to match.
 *   property.N_value      Multiple values (1_value, 2_value …) — OR by default.
 *   property.and          true → AND across N_value entries.
 *   property.operation    'equals' | 'unequals' | 'like' | 'not' | 'exists'
 *   property.depth        Wildcard depth (searches node/* /prop at each level).
 *
 * boolproperty            Match a JCR Boolean property.
 *   boolproperty.value    'true' | 'false'
 *
 * rangeproperty           Numeric range filter (LONG, DOUBLE, DECIMAL).
 *   rangeproperty.property      Property path.
 *   rangeproperty.lowerBound    Lower bound value.
 *   rangeproperty.lowerOperation '>' (default) | '>='
 *   rangeproperty.upperBound    Upper bound value.
 *   rangeproperty.upperOperation '<' (default) | '<='
 *   rangeproperty.decimal       true for Decimal properties.
 *
 * ── Date filtering ───────────────────────────────────────────────────────────
 *
 * daterange               Filter by a DATE property interval (ISO 8601).
 *   daterange.property          DATE property path.
 *   daterange.lowerBound        Lower date (ISO 8601: 2024-01-01 or 2024-01-01T00:00:00.000Z).
 *   daterange.lowerOperation    '>' (default) | '>='
 *   daterange.upperBound        Upper date (ISO 8601).
 *   daterange.upperOperation    '<' (default) | '<='
 *   daterange.timeZone          Timezone ID (e.g. 'Europe/Berlin').
 *
 * relativedaterange       Relative offset from current server time.
 *   relativedaterange.lowerBound  Offset string: -1d, -6M, -1y, 0 …
 *   relativedaterange.upperBound  Offset string: 1h, 1d, now …
 *
 * dateComparison          Compare two DATE properties against each other.
 *   dateComparison.property1    First property path.
 *   dateComparison.property2    Second property path.
 *   dateComparison.operation    '=' | '!=' | '>' | '>='
 *
 * notexpired              Require a DATE property to be in the future (not yet expired).
 *   notexpired.property         DATE property path (e.g. jcr:content/offTime).
 *
 * ── Path / content ───────────────────────────────────────────────────────────
 *
 * path                    Restrict search to a DAM folder.
 *   path.exact            true = exact path; false (default) = subtree.
 *   path.flat             true = direct children only.
 *
 * excludepaths            Exclude paths matching a regex.
 *   excludepaths          Regex string (e.g. .*subassets.*).
 *
 * nodename                Filter by JCR node name with wildcards (* ? [abc]).
 *
 * savedquery              Include predicates from a persisted query.
 *   savedquery            Path to the saved query node or String property.
 *
 * contentfragment         Restrict to content fragments (any value activates it).
 *
 * ── Access control ───────────────────────────────────────────────────────────
 *
 * hasPermission           Require JCR privileges on each result node.
 *   hasPermission         Comma-separated privilege names (e.g. jcr:write).
 *
 * ── DAM / assets ─────────────────────────────────────────────────────────────
 *
 * mainasset               true = main assets only; false = sub-assets only.
 *
 * memberOf                Filter to members of a Sling resource collection.
 *   memberOf              Collection path (e.g. /content/dam/collections/foo).
 *
 * ── Tagging ──────────────────────────────────────────────────────────────────
 *
 * tag                     Filter by tag title path (e.g. properties:orientation/landscape).
 *   tag.property          Tag property (default: cq:tags).
 *   tag.N_value           Multiple tags (1_value, 2_value …).
 *   tag.and               true → all tags must match.
 *
 * tagid                   Filter by tag ID.
 *   tagid.property        Tag property (default: cq:tags).
 *   tagid.N_value         Multiple tag IDs.
 *   tagid.and             true → all tag IDs must match.
 *
 * tagsearch               Filter by keyword in tag titles.
 *   tagsearch.property    Tag property (default: cq:tags).
 *   tagsearch.lang        Restrict to a specific locale.
 *   tagsearch.all         true = search all tag text fields.
 *
 * ── Full-text / type ─────────────────────────────────────────────────────────
 *
 * fulltext                Full-text search.
 *   fulltext.relPath      Restrict to a property or sub-node (e.g. @jcr:title).
 *
 * type                    Restrict to a JCR node type or mixin.
 *
 * language                Restrict to an AEM page language (ISO code, e.g. 'de').
 *
 * similar                 Similarity search (rep:similar()).
 *   similar.local         Descendant path for similarity node (default: '.').
 *
 * ─────────────────────────────────────────────────────────────────────────────
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
    // Priority (lowest → highest): hardcoded base → configurations.basePredicates → form data.
    // Form data (user search input) always wins.
    const merged = new Map([
      ...Object.entries(this.getBaseParams()),
      ...Object.entries(this.config.basePredicates || {}),
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
        params.append(name, String(value));
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
