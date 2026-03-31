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
    // ],

    // ── OpenAPI options (used when provider = 'openapi') ──
    // url: '/adobe/assets/search',

    // ── Hooks (called regardless of provider) ──────────────────────
    // Modify the query object before it is sent to the search API.
    // preprocessQuery: (query) => query,

    // Modify the raw results array before assets are created from them.
    // postprocessResults: (results) => results,
  },

  // ─── Asset Details Modal ─────────────────────────────────────────────────────
  assetDetails: {
    // Maps MIME type patterns to the fragment page used for asset details.
    // First match wins. Supports exact types ('application/pdf') and wildcards ('image/*').
    // The 'default' key is the fallback for unmatched types.
    templates: {
      // 'image/*':           '/details/image',
      // 'video/*':           '/details/video',
      // 'application/pdf':   '/details/pdf',
      default: '/details/default',
    },
  },

  // ─── Theme ───────────────────────────────────────────────────────────────────
  theme: {
    // CSS class applied to <body> to activate a theme.
    // Built-in themes: 'default', 'dark', 'warm', 'studio', 'vault'.
    //   studio — clean, airy SaaS aesthetic (light, blue + violet accents)
    //   vault  — professional dark asset manager (near-black, blue accents)
    // Custom: add your own in styles/themes/custom.css and set the name here.
    default: 'default',
  },

  // ─── Asset Properties ────────────────────────────────────────────────────────
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
  // Defines which renditions appear in the details-download block and how their
  // URLs are constructed. This is the client-side equivalent of ASC v1's
  // AssetRenditionDispatcher OSGi configurations.
  //
  // Each definition has:
  //   id          {string}            Unique key. Used by getRendition(asset, id).
  //   label       {string}            Display name in the download list.
  //   type        {string}            'static' | 'url' | 'asset-delivery'
  //   accepts     {string|Function}   MIME glob ('image/*', 'video/*') or (asset) => boolean.
  //                                   Omit to apply to all asset types.
  //   visible     {boolean}           Show in download list (default: true).
  //                                   Set false for internal-only renditions (e.g. thumbnail).
  //   description {string}            Optional. Shown as tooltip or sub-label.
  //   mimeType    {string}            Override MIME type for download filename hint.
  //
  // ── type: 'static' ───────────────────────────────────────────────────────────
  // Matches a rendition node from the asset's jcr:content/renditions/* tree.
  //   name: 'original'               Exact node name match
  //   name: /^cq5dam\.web\./         RegExp pattern match
  //
  // ── type: 'url' ──────────────────────────────────────────────────────────────
  // Legacy Dynamic Media / Scene7 (IS/IR protocol — "is/image/" URLs).
  // Constructs a URL by interpolating ${variable} placeholders.
  // Variables resolve from dam:scene7* metadata written by the DM sync process.
  //
  //   ${asset.path}     JCR path (/content/dam/...)
  //   ${asset.name}     Node name (filename)
  //   ${asset.id}       UUID
  //   ${asset.extension} File extension
  //   ${dm.name}        dam:scene7Name
  //   ${dm.id}          dam:scene7ID
  //   ${dm.file}        dam:scene7File  (e.g. "my-company/my-image")
  //   ${dm.folder}      dam:scene7Folder
  //   ${dm.domain}      dam:scene7Domain
  //   ${dm.apiServer}   dam:scene7APIServer  (e.g. "https://s7d1.scene7.com/")
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
  //       accepts: 'image/*',
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
  //       id: 'dm-web-preset',
  //       label: 'Web',
  //       type: 'url',
  //       url: '${dm.apiServer}is/image/${dm.file}?$web$',
  //       accepts: (asset) => !!asset.getProperty('dam:scene7File'),
  //     },
  //     {
  //       // Legacy DM smart crop — uses IS/IR ":CropName" syntax
  //       id: 'dm-smart-crop-small',
  //       label: 'Smart Crop — Small',
  //       type: 'url',
  //       url: '${dm.apiServer}is/image/${dm.file}:Small',
  //       accepts: (asset) => !!asset.getProperty('dam:scene7File'),
  //     },
  //     {
  //       id: 'dm-grayscale',
  //       label: 'Grayscale',
  //       type: 'url',
  //       url: '${dm.apiServer}is/image/${dm.file}?$grayscale$',
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
  //       accepts: 'image/*',
  //     },
  //     {
  //       // DM OpenAPI smart crop — uses ?smartcrop= param (crop name matches DM preset)
  //       id: 'smart-crop-small',
  //       label: 'Smart Crop — Small',
  //       type: 'asset-delivery',
  //       params: 'smartcrop=Small',
  //       accepts: 'image/*',
  //     },
  //     {
  //       // DM OpenAPI named image preset
  //       id: 'dm-preset-web',
  //       label: 'Web Preset',
  //       type: 'asset-delivery',
  //       params: 'imagePreset=web',
  //       accepts: 'image/*',
  //     },
  //     {
  //       id: 'thumbnail-delivery',
  //       label: 'Thumbnail',
  //       type: 'asset-delivery',
  //       params: 'format=webp&width=400',
  //       visible: false,   // internal use by teasers
  //       accepts: 'image/*',
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
