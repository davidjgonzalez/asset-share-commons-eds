/**
 * Asset Share Commons — User Configuration
 *
 * This is YOUR file. Edit it freely.
 * Do NOT edit files inside scripts/asc/ — those are ASC core and may be updated.
 *
 * Every option is documented below. Most are commented out with their defaults shown.
 * Uncomment and change only what you need.
 */
const configurations = {

  // ─── AEM Connection ──────────────────────────────────────────────────────────
  aem: {
    // The hostname of your AEM author or publish instance.
    // In production this is typically your publish host; locally it's your AEM SDK.
    host: 'http://localhost:4503',

    // AEM Asset Delivery host (AEM as a Cloud Service only).
    // Required when using renditions of type 'asset-delivery'.
    // Format: 'https://delivery-pXXXXX-eYYYYY.adobeaemcloud.com'
    // deliveryHost: '',
  },

  // ─── Search ──────────────────────────────────────────────────────────────────
  search: {
    // Which search API to use. 'querybuilder' (default) or 'openapi'.
    provider: 'querybuilder',

    // ── QueryBuilder options (used when provider = 'querybuilder') ──
    // url: '/bin/querybuilder.json',
    // basePath: '/content/dam',         // Root DAM path to search within
    // pageSize: 24,                      // Results per page
    //
    // Additional JCR properties to fetch with each result:
    // properties: [
    //   'jcr:path',
    //   'jcr:content/metadata/dc:title',
    //   'jcr:content/metadata/dc:description',
    //   'jcr:content/metadata/dc:format',
    //   'jcr:content/metadata/predictedTags',            // required for smart-tags property
    //   'jcr:content/metadata/dam:colorDistribution',  // required for colors property
    // ],
    //
    // Static QueryBuilder predicates always merged into every query.
    // These are overridden by form data (user search inputs), so they are
    // safe to use for baseline filters (approved assets, specific folder, etc.).
    //
    // Any predicate from the QueryBuilder API is supported:
    // https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/full-stack/search/query-builder-predicates
    //
    // basePredicates: {
    //   // Only show approved assets
    //   'property': 'jcr:content/metadata/dam:status',
    //   'property.value': 'approved',
    //
    //   // Restrict to a specific folder (overrides basePath for this filter)
    //   'path': '/content/dam/brand',
    //
    //   // Exclude a sub-folder
    //   'excludepaths': '.*subassets.*',
    //
    //   // Only assets modified in the last 30 days
    //   'relativedaterange.property': 'jcr:content/jcr:lastModified',
    //   'relativedaterange.lowerBound': '-30d',
    // },

    // ── OpenAPI options (used when provider = 'openapi') ──
    // url: '/adobe/assets/search',

    // ── Hooks (called regardless of provider) ──────────────────────
    // Modify the query object before it is sent to the search API.
    // preprocessQuery: (query) => query,

    // Modify the raw results array before assets are created from them.
    // postprocessResults: (results) => results,

    // Filter individual assets out of results. Return true to include, false to exclude.
    // Applied after postprocessResults, before results are dispatched to the page.
    //
    // Examples:
    //
    // Exclude assets with no renditions and no MIME type (skeleton / incomplete assets):
    accepts: (asset) => asset.mimeType && asset.staticRenditions.length > 0,
    //
    // Only show images:
    // accepts: (asset) => asset.mimeType?.startsWith('image/'),
    //
    // Require a specific metadata property:
    // accepts: (asset) => !!asset.getProperty('jcr:content/metadata/dam:status'),
  },

  // ─── Search Results ──────────────────────────────────────────────────────────
  //
  // Controls which asset properties are shown in each view.
  // Property names map to the built-in property registry or your custom properties.
  //
  // Built-in properties:
  //   thumbnail, title, file-type, file-size, file-extension,
  //   dimensions, width, height, modified, created, description, filename, mime-type
  //
  // Custom properties defined in configurations.properties.custom are also valid here.
  //
  // searchResults: {
  //   views: {
  //     // Cards view — ordered list of property names
  //     cards: ['thumbnail', 'title', 'file-type', 'file-size'],
  //
  //     // Masonry view — keep it minimal; meta overlays on hover
  //     masonry: ['thumbnail', 'title'],
  //
  //     // Quick actions shown on card/masonry teasers.
  //     // Download uses this rendition ID by default (falls back to original, then web).
  //     // quickActions: {
  //     //   downloadRendition: 'original',
  //     // },
  //
  //     // List view — property name + column layout hints
  //     // 'label' defaults to a sensible built-in name; 'width' is a CSS grid track
  //     list: [
  //       { property: 'thumbnail',  width: '48px'  },
  //       { property: 'title',      width: '1fr'   },
  //       { property: 'file-type',  width: '120px' },
  //       { property: 'file-size',  width: '90px'  },
  //       { property: 'modified',   width: '120px' },
  //       // Custom property — must be registered in properties.custom:
  //       // { property: 'brand',   label: 'Brand', width: '120px' },
  //       // Escape hatch — custom render function when a property name isn't enough:
  //       // { label: 'Status', width: '80px', render: (asset) => asset.getProperty('dam:status') || '—' },
  //     ],
  //   },
  // },
  searchResults: {
    views: {
      // Show dimensions in card metadata when available.
      cards: ['thumbnail', 'title', 'file-type', 'dimensions', 'file-size'],
    },
  },

  // ─── Asset Details Modal ─────────────────────────────────────────────────────
  assetDetails: {
    // A function that receives the Asset and returns the fragment page path to load.
    // Return null or undefined to fall back to '/details'.
    //
    // Examples:
    //
    // Route by MIME type:
    // templates: (asset) => {
    //   if (asset.mimeType?.startsWith('image/'))       return '/details/image';
    //   if (asset.mimeType?.startsWith('video/'))       return '/details/video';
    //   if (asset.mimeType === 'application/pdf')        return '/details/pdf';
    //   return '/details';
    // },
    //
    // Route by metadata property:
    // templates: (asset) => {
    //   const brand = asset.getProperty('jcr:content/metadata/myco:brand');
    //   return brand === 'acme' ? '/details/acme' : '/details';
    // },
    templates: () => '/details',
  },

  // ─── Collections ─────────────────────────────────────────────────────────────
  collections: {
    // Path to the collections management index page (used by collection-switcher block)
    managePath: '/collections/',

    // Path to the single collection detail/edit page.
    // The collections block appends '?id=<uuid>' as a query param.
    // collectionPath: '/collections/collection',
    //
    // Target sheet page for collection share links.
    // The collection block builds share URLs as:
    //   {sheetPath}?assets=<compressed>&title=<encoded>&description=<encoded>
    // sheetPath: '/sheets/',
  },

  // ─── Downloads ───────────────────────────────────────────────────────────────
  //
  // Configures the async bulk-download service.
  // Bulk downloads are submitted to the AEM download framework and polled
  // until complete, then the browser download is triggered automatically.
  //
  // downloads: {
  //   // AEM servlet path for initiating and polling download jobs.
  //   // POST to initiate; GET with ?jobId=<id> to poll status.
  //   // Defaults to AEM's standard download initiation endpoint.
  //   initiateUrl: '/content/dam.downloads.initiateDownload.json',
  //
  //   // How long (ms) to poll for a quick auto-download (default: 15 seconds).
  //   // If the job finishes within this window the browser download triggers.
  //   // If not, the job is left as 'running' and can be resumed later.
  //   quickPollTimeout: 15000,
  //
  //   // Interval between status polls in ms (default: 2000).
  //   pollInterval: 2000,
  //
  //   // How long (ms) to keep completed/failed jobs in localStorage (default: 7 days).
  //   jobExpiry: 7 * 24 * 60 * 60 * 1000,
  // },

  // ─── Theme ───────────────────────────────────────────────────────────────────
  theme: {
    // CSS class applied to <body> to activate a theme.
    // Built-in themes: 'default', 'dark', 'studio'.
    //   default — Violet Studio (light, violet accents)
    //   dark    — Deep Ocean (navy, azure accents)
    //   studio  — Unsplash (near-black, image-first)
    // Custom: add your own in styles/themes/custom.css and set the name here.
    default: 'default',
  },

  // ─── Asset Properties ────────────────────────────────────────────────────────
  properties: {
    custom: {
      // Tags → array of leaf labels; the details-metadata block renders arrays
      // as .asc-ui-chip pills. Reads AEM's cq:tags (tag IDs like "ns:foo/bar").
      tags: (asset) => {
        const raw = asset.getProperty('jcr:content/metadata/cq:tags');
        const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        return list.map((t) => String(t).split('/').pop()).filter(Boolean);
      },

      // Colors → HTML swatch strip from AEM Sensei dominant color analysis.
      // Reads dam:colorDistribution; each swatch shows the actual color dot + label.
      // Requires 'jcr:content/metadata/dam:colorDistribution' in search.properties
      // so the node is fetched with each result (QueryBuilder provider only).
      // Returns null when no color distribution data is present.
      colors: (asset) => {
        const dist = asset.getProperty('jcr:content/metadata/dam:colorDistribution');
        if (!dist || typeof dist !== 'object') return null;
        const list = Object.values(dist)
          .filter((c) => c && Array.isArray(c.rgb) && c.rgb.length === 3)
          .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
        if (!list.length) return null;
        const swatches = list.map(({ rgb, name }) => {
          const hex = `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
          const label = name.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
          return `<span class="asc-ui-swatch" style="--asc-ui-swatch-color:${hex}"><span class="asc-ui-swatch__dot"></span><span class="asc-ui-swatch__label">${label}</span></span>`;
        }).join('');
        return `<span class="asc-ui-swatch-list">${swatches}</span>`;
      },

      // Smart Tags → array of tag names from AEM Sensei AI, sorted by confidence.
      // Requires 'jcr:content/metadata/predictedTags' in search.properties
      // so the data is fetched with each result (QueryBuilder provider only).
      // Returns null when no smart tags are present on the asset.
      'smart-tags': (asset) => {
        const predictedTags = asset.getProperty('jcr:content/metadata/predictedTags');
        if (!predictedTags || typeof predictedTags !== 'object') return null;
        return Object.values(predictedTags)
          .filter((tag) => tag && typeof tag.confidence === 'number')
          .sort((a, b) => b.confidence - a.confidence)
          .map((tag) => tag.name)
          .filter(Boolean) || null;
      },
    },
  },

  // ─── Asset Properties (reference) ──────────────────────────────────────────────
  // properties: {
  //   // Add custom property handlers or override built-in ones.
  //   // The key is the property name used in details-property blocks.
  //   // Built-in: 'file-type', 'file-size', 'dimensions', 'width', 'height', 'file-extension'
  //   custom: {
  //     'my-property': (asset, options) => asset.getProperty('jcr:content/metadata/myns:myField'),
  //   },
  //
  //   // Configuration passed to built-in property handlers.
  //   configs: {
  //     'file-type': {
  //       mimeTypeToLabel: {
  //         // 'application/x-indesign': 'InDesign',
  //       },
  //       mediaTypeToLabel: {
  //         // 'application': 'Document',
  //       },
  //     },
  //   },
  // },

  // ─── Renditions ──────────────────────────────────────────────────────────────
  //
  // Defines which renditions appear in the details-renditions block and how their
  // URLs are constructed. This is the client-side equivalent of ASC v1's
  // AssetRenditionDispatcher OSGi configurations.
  //
  // `definitions` is an ordered flat array. Each definition is evaluated top-to-bottom
  // for each asset. Multiple definitions may share the same `id` — the first one whose
  // `accepts` check passes is used (first-match-per-id wins).
  //
  // Each definition has:
  //   id          {string}    Unique key. Used by getRendition(asset, id).
  //   label       {string}    Display name in the download list.
  //   type        {string}    'static' | 'url' | 'asset-delivery'
  //   accepts     {Function}  (asset) => boolean. Omit to apply to all asset types.
  //   visible     {boolean}   Show in download list (default: true).
  //                           Set false for internal-only renditions (e.g. thumbnail).
  //   description {string}    Optional. Shown as tooltip or sub-label.
  //   mimeType    {string}    Override MIME type for download filename hint.
  //
  // ── type: 'static' ───────────────────────────────────────────────────────────
  // Matches a rendition node from the asset's jcr:content/renditions/* tree.
  //   name: 'original'               Exact node name match
  //   name: /^cq5dam\.web\./         RegExp pattern match
  //   name: (asset) => string        Dynamic exact match
  //
  // ── type: 'url' ──────────────────────────────────────────────────────────────
  // Legacy Dynamic Media / Scene7 (IS/IR protocol — "is/image/" URLs).
  //   url: (asset) => string         Function that returns the full URL.
  //                                  Use asset.getProperty('dam:scene7APIServer') etc.
  //
  // ── type: 'asset-delivery' ───────────────────────────────────────────────────
  // Dynamic Media with OpenAPI / AEM Asset Delivery (AEM as a Cloud Service only).
  // URL: {aem.deliveryHost}/adobe/dynamicmedia/deliver/{uuid}/{filename}.{ext}?{params}
  // Requires aem.deliveryHost to be set.
  //
  // This covers ALL DM OpenAPI use cases — plain image transforms, smart crops,
  // and named image presets are all just different `params` values on the same URL:
  //   Plain transforms:  format=webp&width=1200&quality=85
  //   Smart Crop:        smartcrop=Small  (crop name must match DM preset)
  //   Named preset:      imagePreset=web
  //
  //   params   {string}  Query string appended to the delivery URL
  //   format   {string}  File extension override (default: asset's extension)
  //
  // renditions: {
  //   // Exclude AEM rendition node names from all resolved renditions.
  //   // Accepts exact strings or RegExps matched against the JCR node name.
  //   // Use case: suppress thumbnail/template nodes you never want in the download list.
  //   //
  //   // Examples:
  //   //   exclude: ['cq5dam.thumbnail.48.48.png', 'cq5dam.thumbnail.140.100.png']
  //   //   exclude: [/^cq5dam\.thumbnail\.(?:48|96|140)\./]
  //   //
  //   exclude: [],
  //   definitions: [
  //
  //     // ── Static renditions ─────────────────────────────────────────────────
  //     // Works with any AEM instance that runs standard DAM processing profiles.
  //     {
  //       id: 'thumbnail',
  //       label: 'Thumbnail',
  //       type: 'static',
  //       name: /^cq5dam\.thumbnail\./,
  //       visible: false,   // used internally by teasers; hidden from download list
  //     },
  //     {
  //       id: 'web',
  //       label: 'Web',
  //       type: 'static',
  //       name: /^cq5dam\.web\./,
  //       accepts: (asset) => asset.mimeType?.startsWith('image/'),
  //     },
  //     {
  //       id: 'original',
  //       label: 'Original',
  //       type: 'static',
  //       name: 'original',
  //     },
  //
  //     // ── Legacy Dynamic Media / Scene7 (IS/IR protocol) ────────────────────
  //     // For AEM 6.5 or AEMaaCS with classic DM enabled.
  //     // Requires dam:scene7* metadata on assets (written by DM sync process).
  //     {
  //       id: 'dm-web',
  //       label: 'Web',
  //       type: 'url',
  //       url: (asset) => {
  //         const server = asset.getProperty('dam:scene7APIServer');
  //         const file = asset.getProperty('dam:scene7File');
  //         return server && file ? `${server}is/image/${file}?$web$` : null;
  //       },
  //       accepts: (asset) => !!asset.getProperty('dam:scene7File'),
  //     },
  //     {
  //       id: 'dm-smart-crop-small',
  //       label: 'Smart Crop — Small',
  //       type: 'url',
  //       url: (asset) => {
  //         const server = asset.getProperty('dam:scene7APIServer');
  //         const file = asset.getProperty('dam:scene7File');
  //         return server && file ? `${server}is/image/${file}:Small` : null;
  //       },
  //       accepts: (asset) => !!asset.getProperty('dam:scene7File'),
  //     },
  //
  //     // ── DM with OpenAPI / AEM Asset Delivery (AEMaaCS only) ──────────────
  //     // Requires: aem.deliveryHost set above.
  //     // Smart crops and named presets require DM with OpenAPI to be enabled.
  //     {
  //       id: 'web-optimized',
  //       label: 'Web Optimized',
  //       type: 'asset-delivery',
  //       params: 'format=webp&preferwebp=true&width=1200&quality=85',
  //       accepts: (asset) => asset.mimeType?.startsWith('image/'),
  //     },
  //     {
  //       id: 'smart-crop-small',
  //       label: 'Smart Crop — Small',
  //       type: 'asset-delivery',
  //       params: 'smartcrop=Small',
  //       accepts: (asset) => asset.mimeType?.startsWith('image/'),
  //     },
  //     {
  //       id: 'dm-preset-web',
  //       label: 'Web Preset',
  //       type: 'asset-delivery',
  //       params: 'imagePreset=web',
  //       accepts: (asset) => asset.mimeType?.startsWith('image/'),
  //     },
  //   ],
  // },

  // ─── Init / Preloading ───────────────────────────────────────────────────────
  // init: {
  //   preload: true,  // Prefetch asset detail pages on hover for faster perceived load
  // },

  // ─── Debug ───────────────────────────────────────────────────────────────────
  // debug: {
  //   debug: false,
  // },
};

export default configurations;
