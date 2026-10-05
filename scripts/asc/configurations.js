/**
 * Asset Share Commons — User Configuration
 *
 * This is YOUR file. Edit it freely.
 * Do NOT edit files inside scripts/asc/core/ — those are ASC core and may be updated.
 *
 * ASC ships sensible defaults for everything below; this file only needs the values
 * that are specific to your site. Commented-out options show their defaults —
 * uncomment and change only what you need.
 */
const configurations = {

  // ─── AEM Connection ──────────────────────────────────────────────────────────
  aem: {
    // The hostname of your AEM author or publish instance.
    // In production this is typically your publish host; locally it's your AEM SDK.
    host: 'https://publish-p207002-e2157253.adobeaemcloud.com',

    // AEM Asset Delivery host (AEM as a Cloud Service only).
    // Required when using renditions of type 'dm-openapi' (including smart crops of that type below).
    // Format: 'https://delivery-pXXXXX-eYYYYY.adobeaemcloud.com'
    // deliveryHost: '',
  },

  // ─── Search ──────────────────────────────────────────────────────────────────
  search: {
    // Which search API to use. 'querybuilder' (default) or 'openapi' — or the id
    // of a custom provider registered in `providers` below.
    provider: 'querybuilder',

    // Register custom search providers without editing ASC Core. Keyed by id;
    // each value is a class extending SearchProvider
    // (scripts/asc/core/services/search/search-provider.js). An id matching a
    // built-in ('querybuilder'/'openapi') overrides it. Mirrors renditions.resolvers.
    //   import MyProvider from '../../blocks/.../my-provider.js';
    //   providers: { 'my-provider': MyProvider },

    // The page to navigate to when a search-bar is used from a page that has
    // no search results block (e.g. the site header). The query is appended as
    // ?fulltext=<value>. Leave blank to disable cross-page redirect entirely.
    // Individual search-bar blocks can override this with a `redirect` row.
    page: '/search',

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
    //   'jcr:content/metadata/autogen:title',          // fallback when dc:title is empty
    //   'jcr:content/metadata/autogen:description',    // fallback when dc:description is empty
    //   'jcr:content/metadata/predictedTags',            // required for smart-tags property
    //   'jcr:content/metadata/dam:colorDistribution',  // required for colors property
    // ],
    //
    // Static baseline filters merged into EVERY search, ahead of the visitor's own
    // filters. Provider-neutral FilterDescriptors (see services/search/request.js) —
    // the active provider's translators map them, so they work under QueryBuilder,
    // OpenAPI, or a custom provider alike. Each: { type, field?, op?, values, match? }.
    //
    // baseFilters: [
    //   // Only show approved assets
    //   { type: 'property', field: 'jcr:content/metadata/dam:status', op: 'equals', values: ['approved'] },
    //   // Restrict to a specific folder
    //   { type: 'path', op: 'under', values: ['/content/dam/brand'] },
    //   // Only a specific set of tags (OR'd)
    //   { type: 'tags', values: ['properties:orientation/landscape'] },
    // ],
    //
    // A provider-specific predicate with no neutral type yet? Add a neutral type +
    // a translator entry (search.translators.<provider>) rather than leaking provider
    // syntax here. See docs/SEARCH_FILTERS.md.

    // ── Search config sheet (content-author-level baseline filters) ──────
    // Points to the /asc workbook in da.live. SearchService reads the sheet
    // named "search-filters" (/asc.json?sheet=search-filters).
    //
    // Sheet columns: type | field | op | values | match
    //   - type   : neutral filter type (property | path | tags | daterange | …)
    //   - field  : metadata path (for property/tags/daterange); blank for path
    //   - op     : equals | in | under | between | … (defaults to equals)
    //   - values : one value, or several separated by `|`
    //   - match  : any (default) | all
    // Example:
    //
    //   type      | field                                | op     | values               | match
    //   ----------|--------------------------------------|--------|----------------------|------
    //   path      |                                      | under  | /content/dam/brand   |
    //   property  | jcr:content/metadata/dam:status      | equals | approved             |
    //   tags      | jcr:content/metadata/cq:tags         | in     | ns:a/x | ns:a/y       | any
    //
    sheet: '/asc',

    // ── OpenAPI options (used when provider = 'openapi') ──
    // url: '/adobe/assets/search',

    // ── Hooks (called regardless of provider) ──────────────────────
    // Modify the query object before it is sent to the search API. Use it to translate
    // custom filter inputs into provider predicates.
    preprocessQuery: (queryParams) => queryParams,

    // Modify the raw results array before assets are created from them.
    // postprocessResults: (results) => results,

    // Filter individual assets out of results. Return true to include, false to exclude.
    // Applied after postprocessResults, before results are dispatched to the page.
    // Default: exclude skeleton / incomplete assets (no MIME type or no renditions).
    //
    // Examples:
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
  //   dimensions, width, height, modified, created, description, filename, mime-type,
  //   author, keywords, tags, smart-tags, colors, history,
  //   uploaded-by, uploaded-date, last-modified-by, last-modified-date
  //
  // Custom properties defined in configurations.properties.custom are also valid here.
  //
  // searchResults: {
  //   views: {
  //     // Cards view — ordered list of property names
  //     cards: ['thumbnail', 'title', 'file-type', 'dimensions', 'file-size'],
  //
  //     // Masonry view — keep it minimal; meta overlays on hover
  //     masonry: ['thumbnail', 'title'],
  //
  //     // List view — property name + column layout hints
  //     // 'label' defaults to a sensible built-in name; 'width' is a CSS grid track
  //     list: [
  //       { property: 'thumbnail',  width: '48px'  },
  //       { property: 'title',      width: '1fr'   },
  //       { property: 'file-type',  width: '120px' },
  //       { property: 'file-size',  width: '90px'  },
  //       { property: 'modified',   width: '150px' },
  //       // Custom property — must be registered in properties.custom:
  //       // { property: 'brand',   label: 'Brand', width: '120px' },
  //       // Escape hatch — custom render function when a property name isn't enough:
  //       // { label: 'Status', width: '80px', render: (asset) => asset.getProperty('dam:status').text || '—' },
  //     ],
  //
  //     // Trailing actions column (favorite/collection toggles + quick actions)
  //     // isn't a `list` entry — it's always appended after those columns.
  //     // Widen this if you add/remove quick actions elsewhere; default fits
  //     // all 5 built-in buttons. Any CSS grid track value works ('auto', '1fr', ...).
  //     listActionsWidth: '220px',
  //   },
  // },

  // ─── Asset Details Modal ─────────────────────────────────────────────────────
  //
  // assetDetails: {
  //   // A function that receives the Asset and returns the fragment page path to load.
  //   // Return null or undefined to fall back to '/details'.
  //   // Default: routes by MIME type to /details/image, /details/video, /details/pdf,
  //   // /details/office, else /details.
  //   //
  //   // Route by metadata property:
  //   templates: (asset) => {
  //     const brand = asset.getProperty('jcr:content/metadata/myco:brand').data;
  //     return brand === 'acme' ? '/details/acme' : '/details';
  //   },
  // },

  // ─── SEO / Page Metadata ─────────────────────────────────────────────────────
  //
  // Configures the seo service (scripts/asc/core/services/seo/seo.js) — sets
  // document.title, meta description, canonical link, Open Graph + Twitter Card
  // tags, and JSON-LD structured data. Applied per page type (search/collections/
  // sheet/board) and specially for the Asset Details overlay, which gets a
  // canonical URL of its own instead of inheriting whatever search/collection
  // URL it happened to be opened from. Full reference: docs/SEO.md
  //
  // IMPORTANT: everything here is written client-side, after JS runs. That's
  // enough for document.title/canonical/JSON-LD as far as Google's JS-rendering
  // crawl pass goes (including AI Overviews, which ride Googlebot's index),
  // but NOT for any crawler that only fetches raw HTML — that's most link-
  // preview bots (Slack, X/Twitter, Facebook, LinkedIn, iMessage) AND most
  // AI/answer-engine crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.), which
  // generally skip JS execution entirely. Both categories only ever see
  // whatever is authored directly into <title>/<meta> in da.live. Fixing that
  // needs a server/edge component outside this repo; see docs/SEO.md.
  //
  // seo: {
  //   enabled: true,
  //   siteName: 'Asset Library',
  //   defaultImage: '/path/to/default-social-share.jpg',
  //
  //   // Pathname used for the Asset Details canonical URL, instead of whatever
  //   // page the modal happened to be opened on top of (AssetDetails auto-opens
  //   // off the ?asset= query param alone, with no pathname check, so any page
  //   // works — but point this at a real authored page, or the canonical URL
  //   // 404s if a crawler or shared link actually visits it).
  //   canonicalBase: '/asset',
  //
  //   // Opt-in per-page-type hooks. No built-in defaults — collection/sheet/
  //   // board business data isn't visible from here, so omitted fields simply
  //   // leave whatever's already authored in <title>/<meta name="description">
  //   // (after {{ }} token resolution) untouched. Return only what you want to
  //   // override.
  //   pages: {
  //     search: (ctx) => ({ title: `Search — ${ctx.siteName}` }),
  //     collections: (ctx) => ({}),
  //     sheet: (ctx) => ({}),
  //     board: (ctx) => ({}),
  //   },
  //
  //   // Asset Details has enough intrinsic data (title/description/mimeType/
  //   // renditions) to get sensible defaults with zero config — this hook only
  //   // needs to return the fields you want to override.
  //   assetDetails: (asset) => ({
  //     title: asset.title,
  //     description: asset.description,
  //   }),
  //
  //   jsonLd: {
  //     // Page-type hooks: return a full JSON-LD object, or omit for none.
  //     collections: (ctx) => ({
  //       '@context': 'https://schema.org',
  //       '@type': 'CollectionPage',
  //     }),
  //
  //     // Merged over the built-in ImageObject/VideoObject/DigitalDocument
  //     // default (chosen by MIME type). Return null to suppress entirely.
  //     assetDetails: (asset) => ({ creator: asset.getProperty('dc:creator').text }),
  //   },
  //
  //   // Add refresh triggers beyond the built-in ones (page load + Asset
  //   // Details open/close) without editing the service — same
  //   // [target, eventType, handler] shape as every other core service's
  //   // customListeners.
  //   customListeners: [
  //     [document, 'asc:search:complete', () => services.seo.applyPage()],
  //   ],
  // },

  // ─── Action Pages ────────────────────────────────────────────────────────────
  //
  // Controls the action-pages service — the framework that intercepts clicks on
  // <a href="/actions/..."> links and loads the matching action block as a modal.
  //
  // actions: {
  //   root: '/actions',   // DA path prefix for action pages (default: '/actions')
  // },

  // ─── Collections ─────────────────────────────────────────────────────────────
  //
  // collections: {
  //   managePath: '/collections/',                   // collections management index page
  //   collectionPath: '/collections/collection',     // single collection page (?id=<uuid> appended)
  //   sheetPath: '/sheets/',                         // target page for collection share links
  // },

  // ─── Analytics ───────────────────────────────────────────────────────────────
  //
  // Configures the analytics service (scripts/asc/core/services/analytics/
  // analytics.js), which listens to ASC's asc:{noun}:{verb} event bus and
  // normalizes every event into one trackEvent() call. Full event catalog +
  // payload shapes: docs/ANALYTICS.md
  //
  // analytics: {
  //   enabled: true,   // master kill switch
  //
  //   // Consent/PII level for general engagement tracking. Can be a function so
  //   // a mid-session consent change (e.g. a cookie-consent banner) takes effect
  //   // on the very next event — no reload required.
  //   //   'anonymous'  (default) — never attach user identity to events
  //   //   'identified' — attach the current user (userId + email) to every event
  //   level: () => (window.myConsentManager?.analyticsConsent ? 'identified' : 'anonymous'),
  //
  //   // Events that always carry user identity regardless of `level` above —
  //   // for audit/governance trails tied to gated access (e.g. per-partner
  //   // download accountability), which are a condition of access rather than
  //   // opt-in marketing tracking.
  //   identifyEvents: ['download_start', 'download_complete'],
  //
  //   // Runs on every event after the built-in payload (including captured UTM
  //   // params) is assembled, before trackers fire. Return null/undefined to
  //   // drop the event; return a modified payload to redact fields or attach
  //   // extra context (e.g. asset category/campaign pulled from
  //   // window.asc.cache.assets).
  //   enrich: (name, payload) => payload,
  //
  //   // One entry per vendor — called for every tracked event.
  //   trackers: [
  //     (name, payload) => window.gtag?.('event', name, payload),
  //     (name, payload) => window.adobeDataLayer?.push({ event: name, ...payload }),
  //   ],
  //
  //   // Add your own event → trackEvent() mapping without editing the service —
  //   // same [target, eventType, handler] shape as its built-in LISTENERS.
  //   customListeners: [
  //     [document, 'asc:my-feature:did-thing', (e) => services.analytics.trackEvent('my_feature_thing', { ...e.detail })],
  //   ],
  // },

  // ─── Notifications ───────────────────────────────────────────────────────────
  //
  // Toast feedback for actions with a real effect on the system (download
  // finished, collection created/deleted, share link generated). These are just
  // the cross-cutting knobs — WHICH events trigger a toast and their default
  // wording is a plain array (LISTENERS) inside the notifications service
  // (scripts/asc/core/services/notifications/notifications.js); add to
  // customListeners below instead of editing that file.
  //
  // notifications: {
  //   enabled: true,
  //
  //   // top-left | top-right | top-center | bottom-left | bottom-right | bottom-center
  //   location: 'bottom-right',
  //
  //   duration: 4000,   // ms before auto-dismiss; 0 = stays until manually closed
  //
  //   // Runs before every toast renders (both LISTENERS-triggered and manual
  //   // notify() calls). Return null/undefined to suppress it, or a string to
  //   // override the message.
  //   enrich: (message, { type }) => message,
  //
  //   // Add your own event → toast mapping without editing the service — same
  //   // [eventName, handler] shape as its built-in LISTENERS.
  //   customListeners: [
  //     ['asc:my-feature:did-thing', () => services.notifications.notify('Did the thing')],
  //   ],
  // },

  // ─── Activity History ────────────────────────────────────────────────────────
  //
  // Per-user activity log (scripts/asc/core/services/activity/activity.js) — listens
  // to the same asc:{noun}:{verb} event bus as analytics and records a local timeline
  // (searches, asset views, collection changes, shares, downloads, rendition
  // copy/download), scoped per-user via storage. WHICH events get recorded is a plain
  // array (LISTENERS) inside the service; add to customListeners instead of editing
  // that file. Full schema + extension recipe: docs/ACTIVITY.md
  //
  // activity: {
  //   enabled: true,
  //   max: 200, // capped list length; oldest entries drop off first
  //   customListeners: [
  //     [document, 'asc:my-feature:did-thing', (e) => services.activity.record('my_feature_thing', { ...e.detail })],
  //   ],
  // },

  // ─── Theme ───────────────────────────────────────────────────────────────────
  theme: {
    // CSS class applied to <body> to activate a theme.
    // Built-in themes: 'default', 'dark', 'studio'.
    //   default — Cosmos (warm monochrome, content-first, light)
    //   dark    — Deep Ocean (navy, azure accents)
    //   studio  — Unsplash (near-black, image-first)
    // Custom: add your own in styles/themes/custom.css and set the name here.
    default: 'default',
  },

  // ─── Board ───────────────────────────────────────────────────────────────────
  //
  // board: {
  //   // Fully custom renderer for board/collection canvas items — see the markup
  //   // contract documented at the top of blocks/board/board-item.js (the default
  //   // implementation) for what's required to keep drag/select/remove/notes/search
  //   // working. Import your own module at the top of this file and assign it here.
  //   itemRenderer: myBoardItem,
  // },

  // ─── Asset Properties ────────────────────────────────────────────────────────
  // Built-in and standard-metadata property handlers (see Search Results above) are
  // registered by ASC. Add your own, or override a built-in by using its name.
  //
  // properties: {
  //   // The key is the property name used in views config and details-property blocks.
  //   custom: {
  //     'my-property': (asset, options) => asset.getProperty('jcr:content/metadata/myns:myField').data,
  //   },
  //
  //   // Configuration passed to built-in property handlers.
  //   configs: {
  //     'file-type': {
  //       mimeTypeToLabel: { 'application/x-indesign': 'InDesign' },
  //       mediaTypeToLabel: { 'application': 'Document' },
  //     },
  //   },
  // },

  // ─── Other tunables (defaults shown) ─────────────────────────────────────────
  //
  // copyImage: {                 // caps on copying an image to the OS clipboard
  //   maxBytes: 20 * 1024 * 1024,
  //   maxPixels: 40_000_000,
  // },
  //
  // authoredAssets: {            // authored boards / teaser mosaics resolving UUID/path refs
  //   concurrency: 4,
  //   // resolveReference: async (reference) => myProvider.getAsset(reference),
  // },
  //
  // teaser: {
  //   previewConcurrency: 2,
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
  // ── type: 'dm-scene7' ────────────────────────────────────────────────────────
  // Classic Dynamic Media (Scene7) smart crop via the IS protocol.
  // URL: {dam:scene7APIServer}is/image/{dam:scene7File}:{cropName}
  // No definitions needed for the common case — every smart crop present on the
  // asset (sling:resourceType dam/rendition/smartcrop nodes) is auto-detected and
  // appended automatically, using its real JCR node name as both id and crop name.
  // Add an explicit definition only to customize one specific crop's label/order/
  // accepts guard. The definition never hardcodes the DM crop name as its own
  // `id` — it looks the real node up from the asset's renditions tree via:
  //   smartCropId   {string}   The exact, case-sensitive DM-registered crop name
  //                            to look up (e.g. "Small"). Falls back to `id` if omitted.
  // `id` is optional — the resolved rendition's id defaults to the matched node's
  // real name; set `id` only if you want a stable slug for getRendition() lookups.
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
  //   params   {string}  Query string appended to the delivery URL (e.g. 'format=webp&width=1200',
  //                       or 'smartcrop=Small&fit=constrain' — any DM image-serving param works)
  //   format   {string}  File extension override (default: asset's extension)
  //
  // Pick which smart-crop entries to add below based on which DM API your instance
  // uses: 'dm-scene7' (classic IS protocol, AEM 6.5 and AEMaaCS) or 'dm-openapi'
  // (AEMaaCS only; requires aem.deliveryHost above).
  //
  renditions: {
    // Exclude AEM rendition node names from all resolved renditions.
    // Accepts exact strings or RegExps matched against the JCR node name.
    // Default: cq5dam.thumbnail.* nodes, cqdam.*.json, cqdam.metadata.xml, Swatch.
    // exclude: [/^cq5dam\.thumbnail\./, 'Swatch'],

    // Display renditions — the set that represents an asset across the site (cards,
    // lists, masonry, boards, teasers). Used for <img srcset>; never shown in the
    // download list. Each entry needs `size.width` for the srcset descriptor.
    // Default: a 100–1920px web-optimized-delivery ladder for images, and AEM's
    // standard cq5dam.thumbnail.* renditions for non-image assets (video, PDF, Office).
    // display: [
    //   { type: 'web-optimized-delivery', size: { width: 320 }, params: 'width=320&preferwebp=true&quality=85', accepts: (asset) => asset.mimeType?.startsWith('image/') },
    //   { type: 'static', name: 'cq5dam.thumbnail.319.319.png', size: { width: 319 }, accepts: (asset) => !asset.mimeType?.startsWith('image/') },
    // ],

    // Downloadable renditions offered in the details-renditions block and download dialog.
    definitions: [
      { id: 'original', label: 'Original', usecase: 'Full Resolution / Print', type: 'static', name: 'original' },
      { id: 'web', label: 'Web', usecase: 'Website (1280px)', type: 'static', name: /^cq5dam\.web\.1280\.1280\./, accepts: (asset) => asset.mimeType?.startsWith('image/') },
      // Smart crop rendition definitions. `id` uses the "smart-crop-*" spelling
      // (hyphen after "smart") because that's the literal id authors reference
      // from da.live action fragments (e.g. /actions/download); keep the two in
      // sync if either changes.
      // 'dm-scene7': `smartCropId` picks the real smart-crop node to customize (by
      //   its DM-registered name, case-sensitive) — no `id` needed; it defaults to it.
      // 'dm-openapi': `params` is the raw query string appended to the deliveryHost
      //   URL — append any other DM image-serving param here too (e.g. '&contrast=30').
      // Use whichever type matches your DM API (see aem.deliveryHost above) — mixing
      // both in the same list is also fine if some crops need one API and some the other.
      //
      // `usecase` names a real destination, not a generic bucket ("Social" covers Instagram,
      // Twitter/X, Threads, etc. with completely different crops/dimensions) — label each
      // smart-crop preset by what it actually is (aspect ratio + the destination it fits),
      // so a visitor picks by "what am I making" instead of decoding a preset name. Rename
      // these to match whatever your DM smart-crop presets actually produce.
      { id: 'smart-crop-small', label: 'Square', usecase: 'Instagram Post / Profile Image (1:1)', type: 'dm-scene7', smartCropId: 'Small', accepts: (asset) => asset.mimeType?.startsWith('image/') },
      { id: 'smart-crop-medium', label: 'Standard', usecase: 'Email / Blog Inline (4:3)', type: 'dm-scene7', smartCropId: 'Medium', accepts: (asset) => asset.mimeType?.startsWith('image/') },
      { id: 'smart-crop-large', label: 'Widescreen', usecase: 'Web Banner / Twitter Post (16:9)', type: 'dm-scene7', smartCropId: 'Large', accepts: (asset) => asset.mimeType?.startsWith('image/') },
      // dm-openapi equivalent, if your instance uses OpenAPI instead of classic Scene7:
      //   { id: 'smart-crop-small', label: 'Smart Crop — Small', type: 'dm-openapi', params: 'smartcrop=Small&fit=constrain', accepts: (asset) => asset.mimeType?.startsWith('image/') },
    ],
  },

  // ─── WebMCP ──────────────────────────────────────────────────────────────────
  //
  // Configures the webmcp service (scripts/asc/core/services/webmcp/webmcp.js),
  // which registers ASC capabilities as tools an in-browser AI agent can call
  // directly via the emerging WebMCP standard (document.modelContext.registerTool
  // — Chrome 149 origin trial as of writing). No-ops entirely in browsers that
  // don't support it yet.
  //
  // Built-in tools (search, get-asset, get-renditions) are read-only lookups —
  // see webmcp.js. Add your own tool without editing that file via customTools:
  // an array of WebMCP tool definitions ({ name, description, inputSchema,
  // execute, annotations }), merged in at init time. E.g., once you're ready to
  // expose write actions like creating a collection/sheet:
  //
  // webmcp: {
  //   enabled: true,
  //   customTools: [
  //     {
  //       name: 'asc_collections_create',
  //       description: 'Create a new collection and add one or more assets to it by UUID.',
  //       annotations: { readOnlyHint: false },
  //       inputSchema: {
  //         type: 'object',
  //         properties: {
  //           name: { type: 'string' },
  //           assetIds: { type: 'array', items: { type: 'string' } },
  //         },
  //         required: ['name'],
  //       },
  //       execute: async ({ name, assetIds = [] }) => {
  //         const collection = services.collections.create(name);
  //         assetIds.forEach((id) => services.collections.addAsset(id, collection.id));
  //         return JSON.stringify({ id: collection.id, name: collection.name });
  //       },
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
