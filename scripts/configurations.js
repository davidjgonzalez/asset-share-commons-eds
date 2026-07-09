/**
 * Asset Share Commons — User Configuration
 *
 * This is YOUR file. Edit it freely.
 * Do NOT edit files inside scripts/asc/ — those are ASC core and may be updated.
 *
 * Every option is documented below. Most are commented out with their defaults shown.
 * Uncomment and change only what you need.
 */
import uploadedDate from './asc/services/properties/uploaded-date.js';
import uploadedBy from './asc/services/properties/uploaded-by.js';
import lastModifiedBy from './asc/services/properties/last-modified-by.js';
import author from './asc/services/properties/author.js';
import keywords from './asc/services/properties/keywords.js';
import lastModifiedDate from './asc/services/properties/last-modified-date.js';
import tags from './asc/services/properties/tags.js';
import colors from './asc/services/properties/colors.js';
import smartTags from './asc/services/properties/smart-tags.js';
import history from './asc/services/properties/history.js';

const configurations = {

  // ─── AEM Connection ──────────────────────────────────────────────────────────
  aem: {
    // The hostname of your AEM author or publish instance.
    // In production this is typically your publish host; locally it's your AEM SDK.
    host: 'https://publish-p207002-e2157253.adobeaemcloud.com',

    // AEM Asset Delivery host (AEM as a Cloud Service only).
    // Required when using renditions of type 'dm-openapi'.
    // Format: 'https://delivery-pXXXXX-eYYYYY.adobeaemcloud.com'
    // deliveryHost: '',
  },

  // ─── Search ──────────────────────────────────────────────────────────────────
  search: {
    // Which search API to use. 'querybuilder' (default) or 'openapi'.
    provider: 'querybuilder',

    // The page to navigate to when a search-bar is used from a page that has
    // no search results block (e.g. the site header). The query is appended as
    // ?fulltext=<value>. Leave blank to disable cross-page redirect entirely.
    // Individual search-bar blocks can override this with a `redirect` row.
    page: '/',

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

    // ── Search config sheet (content-author-level static predicates) ──────
    // Points to the /asc workbook in da.live. SearchService reads the sheet
    // named "search-predicates" (/asc.json?sheet=search-predicates).
    //
    // Sheet columns: name | value
    // Write full QB predicate names — include group prefixes if needed.
    // Example:
    //
    //   name                                  | value
    //   --------------------------------------|--------------------------------
    //   path                                  | /content/dam/brand
    //   notexpired.property                   | jcr:content/metadata/dam:expirationDate
    //   1000_group.property                   | jcr:content/metadata/dam:status
    //   1000_group.property.value             | approved
    //
    sheet: '/asc',

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
    // accepts: (asset) => !!asset.getProperty('jcr:content/metadata/dam:status').data,
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
  //       // { label: 'Status', width: '80px', render: (asset) => asset.getProperty('dam:status').text || '—' },
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
    //   const brand = asset.getProperty('jcr:content/metadata/myco:brand').data;
    //   return brand === 'acme' ? '/details/acme' : '/details';
    // },
    // Route PDFs to their own fragment page so details-pdf can be authored there.
    // Create template pages in da.live and map MIME types here.
    templates: (asset) => {
      if (asset.mimeType?.startsWith('image/')) return '/details/image';
      if (asset.mimeType?.startsWith('video/')) return '/details/video';
      if (asset.mimeType === 'application/pdf') return '/details/pdf';
      if ([
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ].includes(asset.mimeType)) return '/details/office';
      return '/details';
    },
  },

  // ─── Action Pages ────────────────────────────────────────────────────────────
  //
  // Controls the action-pages service — the framework that intercepts clicks on
  // <a href="/actions/..."> links and loads the matching action block as a modal.
  //
  // actions: {
  //   root: '/actions',   // DA path prefix for action pages (default: '/actions')
  // },

  // ─── Share ───────────────────────────────────────────────────────────────────
  //
  // Controls the Share Collection dialog.
  // Author the dialog content at the actionPath DA page.
  //
  share: {
    actionPath: '/actions/share',
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
  downloads: {
    // AEM Assets download framework endpoint — accepts a JSON targets payload and
    // returns the zip as a binary stream or a JSON { downloadUrl } redirect.
    binariesUrl: '/content/dam.downloadbinaries.json',

    // DA page that provides the download dialog's intro content (title, description,
    // usage terms, etc.). Fetched as a fragment and injected into the dialog body.
    // Author the page in DA under /actions/download.
    actionPath: '/actions/download',

    // Default zip filename. Overridden at runtime by the collection name.
    // archiveName: 'assets.zip',
  },

  // Legacy async-polling download service (ASC Core).
  // Uncomment to customise the poll interval or job expiry for services.downloads.
  // downloads_legacy: {
  //   initiateUrl: '/content/dam.downloads.initiateDownload.json',
  //   quickPollTimeout: 15000,
  //   pollInterval: 2000,
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
  // Each property handler lives in scripts/asc/services/properties/<name>.js
  properties: {
    custom: {
      'uploaded-date': uploadedDate,
      'uploaded-by': uploadedBy,
      'last-modified-by': lastModifiedBy,
      author,
      keywords,
      'last-modified-date': lastModifiedDate,
      tags,
      colors,
      'smart-tags': smartTags,
      history,
    },
  },

  // ─── Asset Properties (reference) ──────────────────────────────────────────────
  // properties: {
  //   // Add custom property handlers or override built-in ones.
  //   // The key is the property name used in details-property blocks.
  //   // Built-in: 'file-type', 'file-size', 'dimensions', 'width', 'height', 'file-extension'
  //   custom: {
  //     'my-property': (asset, options) => asset.getProperty('jcr:content/metadata/myns:myField').data,
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
  //   type        {string}    'static' | 'url' | 'dm-openapi'
  //   accepts     {Function}  (asset) => boolean. Omit to apply to all asset types.
  //   visible     {boolean}   Show in download list (default: true).
  //                           Set false for internal-only renditions (e.g. thumbnail).
  //   description {string}    Optional. Shown as tooltip or sub-label.
  //   mimeType    {string}    Override MIME type for download filename hint.
  //   fileType    {string}    Human-readable format label shown in the `file-type`
  //                           column of details-renditions (e.g. 'JPEG', 'WebP 1200px').
  //                           Defaults to the label derived from mimeType.
  //   usecase     {string}    Arbitrary tag (e.g. 'thumbnail', 'web'). Exposed as
  //                           the `usecase` column value in details-renditions.
  //
  // ── type: 'static' ───────────────────────────────────────────────────────────
  // Matches a rendition node from the asset's jcr:content/renditions/* tree.
  //   name: 'original'               Exact node name match
  //   name: /^cq5dam\.web\./         RegExp pattern match
  //   name: (asset) => string        Dynamic exact match
  //
  // ── type: 'dm-smartcrop' ─────────────────────────────────────────────────────
  // Classic Dynamic Media (Scene7) smart crop via the IS protocol.
  // URL: {dam:scene7APIServer}is/image/{dam:scene7File}:{id}
  // The definition `id` must exactly match the smart crop name registered in DM
  // (e.g. "Small", "Medium", "Large" — case-sensitive).
  // Smart crops present on the asset but not listed here are auto-detected and
  // appended automatically. Use explicit definitions when you need custom labels,
  // accepts guards, or a specific ordering.
  //
  // ── type: 'url-template' ─────────────────────────────────────────────────────
  // Dynamic Media / Scene7 IS/IR protocol using declarative token strings.
  // Preferred over 'url' for DM image presets — no JS function needed.
  //   template: string   URL with ${variable} tokens. Resolves to null automatically
  //                      if any token has no value on the asset (safe fallback).
  // Tokens: ${asset.path} ${asset.name} ${asset.extension} ${rendition.name}
  //         ${dm.api-server} ${dm.file} ${dm.folder} ${dm.domain} ${dm.name} ${dm.id}
  //
  // ── type: 'url' ──────────────────────────────────────────────────────────────
  // Custom Dynamic Media URLs requiring arbitrary JS logic.
  //   url: (asset) => string         Function that returns the full URL.
  //                                  Use asset.getProperty('dam:scene7APIServer').data etc.
  //
  // ── type: 'dm-openapi' ───────────────────────────────────────────────────
  // Dynamic Media with OpenAPI / AEM Asset Delivery (AEM as a Cloud Service only).
  // URL: {aem.deliveryHost}/adobe/dynamicmedia/deliver/{uuid}/{filename}.{ext}?{params}
  // Requires aem.deliveryHost to be set.
  //
  //   params   {string}  Query string appended to the delivery URL (e.g. 'format=webp&width=1200')
  //   format   {string}  File extension override (default: asset's extension)
  //
  renditions: {
    // Exclude AEM rendition node names from all resolved renditions.
    // Accepts exact strings or RegExps matched against the JCR node name.
    // Use case: suppress thumbnail/template nodes you never want in the download list.
    //
    // Examples:
    //   exclude: ['cq5dam.thumbnail.48.48.png', 'cq5dam.thumbnail.140.100.png']
    //   exclude: [/^cq5dam\.thumbnail\.(?:48|96|140)\./]
    //
    exclude: [
      /^cq5dam\.thumbnail\./,  // cq5dam.thumbnail.48.48.png, cq5dam.thumbnail.319.319.png, etc.
      /^cqdam\..+\.json$/,     // cqdam.text.json, cqdam.metadata.json, etc.
      'cqdam.metadata.xml',
      'Swatch'
    ],
    // Thumbnail renditions — used exclusively for <img srcset> in search result cards.
    // Never shown in the download list. Each entry needs `size.width` for the srcset descriptor.
    // Ladder is aligned to card/masonry display sizes at 1× and 2× DPR:
    //   cards (300px): 1× → 320w, 2× → 640w
    //   masonry (~450px at 1440px viewport): 1× → 640w, 2× → 1280w
    thumbnails: [
      { type: 'web-optimized-delivery', size: { width: 100  }, params: 'width=100&preferwebp=true&quality=85',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
      { type: 'web-optimized-delivery', size: { width: 320  }, params: 'width=320&preferwebp=true&quality=85',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
      { type: 'web-optimized-delivery', size: { width: 640  }, params: 'width=640&preferwebp=true&quality=80',  accepts: (asset) => asset.mimeType?.startsWith('image/') },
      { type: 'web-optimized-delivery', size: { width: 1280 }, params: 'width=1280&preferwebp=true&quality=70', accepts: (asset) => asset.mimeType?.startsWith('image/') },
    ],
    definitions: [
      { id: 'original', label: 'Original', type: 'static', name: 'original' },
      { id: 'web', label: 'Web (1280px)', type: 'static', name: 'cq5dam.web.1280.1280', accepts: (asset) => asset.mimeType?.startsWith('image/') },
      { id: 'smart-crop-small', label: 'Smart Crop — Small', type: 'dm-smartcrop', accepts: (asset) => asset.mimeType?.startsWith('image/') },
      { id: 'smart-crop-medium', label: 'Smart Crop — Medium', type: 'dm-smartcrop', accepts: (asset) => asset.mimeType?.startsWith('image/') },
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
  //     // ── Dynamic Media / Scene7 (IS/IR protocol) ──────────────────────────
  //     // For AEM 6.5 or AEMaaCS with classic DM enabled.
  //     // Requires dam:scene7* metadata on assets (written by the DM sync process).
  //     //
  //     // type: 'url-template' — resolves ${variable} tokens against the asset.
  //     // Supported tokens: ${asset.path}, ${asset.name}, ${asset.extension},
  //     //   ${rendition.name}, ${dm.name}, ${dm.id}, ${dm.file}, ${dm.folder},
  //     //   ${dm.domain}, ${dm.api-server}
  //     // Returns null automatically if any token in the template has no value.
  //     //
  //     // Image preset:
  //     {
  //       id: 'dm-web',
  //       label: 'Web',
  //       type: 'url-template',
  //       template: '${dm.api-server}is/image/${dm.file}?$web$',
  //     },
  //     //
  //     // Smart crops — id must match the DM-registered crop name exactly.
  //     // Any crop NOT listed here is auto-detected from the asset's JCR renditions tree.
  //     // Use explicit definitions only when you need custom labels or accepts guards.
  //     {
  //       id: 'Large',
  //       label: 'Smart Crop — Large',
  //       type: 'dm-smartcrop',
  //       accepts: (asset) => asset.mimeType?.startsWith('image/'),
  //     },
  //     {
  //       id: 'Medium',
  //       label: 'Smart Crop — Medium',
  //       type: 'dm-smartcrop',
  //       accepts: (asset) => asset.mimeType?.startsWith('image/'),
  //     },
  //     {
  //       id: 'Small',
  //       label: 'Smart Crop — Small',
  //       type: 'dm-smartcrop',
  //       accepts: (asset) => asset.mimeType?.startsWith('image/'),
  //     },
  //     //
  //     // type: 'url' — arbitrary JS function when template tokens aren't enough.
  //     {
  //       id: 'dm-grayscale',
  //       label: 'Grayscale',
  //       type: 'url',
  //       url: (asset) => {
  //         const server = asset.getProperty('dam:scene7APIServer').data;
  //         const file = asset.getProperty('dam:scene7File').data;
  //         return server && file ? `${server}is/image/${file}?$grayscale$` : null;
  //       },
  //     },
  //
  //     // ── DM with OpenAPI / AEM Asset Delivery (AEMaaCS only) ──────────────
  //     // Requires: aem.deliveryHost set above.
  //     // Smart crops and named presets require DM with OpenAPI to be enabled.
  //     {
  //       id: 'web-optimized',
  //       label: 'Web Optimized',
  //       type: 'dm-openapi',
  //       params: 'format=webp&preferwebp=true&width=1200&quality=85',
  //       accepts: (asset) => asset.mimeType?.startsWith('image/'),
  //     },
  //     {
  //       id: 'smart-crop-small',
  //       label: 'Smart Crop — Small',
  //       type: 'dm-openapi',
  //       params: 'smartcrop=Small',
  //       accepts: (asset) => asset.mimeType?.startsWith('image/'),
  //     },
  //     {
  //       id: 'dm-preset-web',
  //       label: 'Web Preset',
  //       type: 'dm-openapi',
  //       params: 'imagePreset=web',
  //       accepts: (asset) => asset.mimeType?.startsWith('image/'),
  //     },
    ],
  },

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
