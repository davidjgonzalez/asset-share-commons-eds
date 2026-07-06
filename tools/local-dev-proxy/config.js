/**
 * Local dev proxy configuration.
 *
 * Routes are checked top-to-bottom; the first match wins.
 * 'target' is either a key in `targets` or a full URL string.
 *
 * Path matching: prefix-based. '/content/dam' matches /content/dam,
 * /content/dam/foo, /content/dam/foo?bar=1 — but NOT /content/damage.
 */

/** @type {ProxyConfig} */
export default {
  // Port this proxy listens on. Open http://localhost:3002 instead of :3000.
  port: 3002,

  targets: {
    aemUp: 'http://localhost:3000', // aem up dev proxy
    aem:   'https://publish-p207002-e2157253.adobeaemcloud.com', // local AEM author/publish
  },

  // ─── Routing ───────────────────────────────────────────────────────────────
  routes: [
    // AEM DAM and servlet paths go directly to AEM (bypassing aem up),
    // so response-header overrides below take effect.
    { match: '/content/dam', target: 'aem' },
    { match: '/bin',         target: 'aem' },
    { match: '/libs',        target: 'aem' },
    // Everything else (EDS pages, JS, CSS, fragments) goes through aem up.
    { match: '/',            target: 'aemUp' },
  ],

  // ─── CORS ──────────────────────────────────────────────────────────────────
  // Add Access-Control-Allow-Origin: * (and friends) to every proxied response.
  // Also handles OPTIONS preflight without forwarding to the target.
  cors: true,

  // ─── Response header overrides ─────────────────────────────────────────────
  // All conditions on an entry must match for the override to apply.
  // Omit pathMatch or contentType to match unconditionally.
  // contentType supports substrings, wildcard MIME patterns like image/* or */*,
  // and RegExp values because this file is regular JavaScript.
  headerOverrides: [
    // PDFs: force inline rendering instead of download
    {
      pathMatch:   '/content/dam',
      contentType: 'application/pdf',
      set: { 'content-disposition': 'inline' },
    },

    // Videos: force inline rendering instead of download
    {
      pathMatch:   '/content/dam',
      contentType: 'video/*',
      set: { 'content-disposition': 'inline' },
    },

    // Example: force every image response inline using a wildcard MIME pattern.
    // {
    //   pathMatch: '/content/dam',
    //   contentType: 'image/*',
    //   set: { 'content-disposition': 'inline' },
    // },

    // Uncomment to force ALL DAM binary responses inline:
    // {
    //   pathMatch: '/content/dam',
    //   set: { 'content-disposition': 'inline' },
    // },

    // Uncomment to strip X-Frame-Options so <object>/<iframe> can embed:
    // {
    //   pathMatch: '/content/dam',
    //   set: { 'x-frame-options': '' },
    // },
  ],
};

/**
 * @typedef {Object} RouteRule
 * @property {string} match    Path prefix to match
 * @property {string} target   Key in `targets` or a full URL
 *
 * @typedef {Object} HeaderOverride
 * @property {string} [pathMatch]   Path prefix to match (omit = all paths)
 * @property {string|RegExp} [contentType] Content-Type matcher (substring, wildcard MIME pattern, or RegExp)
 * @property {Record<string,string>} set  Headers to set (lowercase keys)
 *
 * @typedef {Object} ProxyConfig
 * @property {number} port
 * @property {Record<string,string>} targets
 * @property {RouteRule[]} routes
 * @property {boolean} cors
 * @property {HeaderOverride[]} headerOverrides
 */
