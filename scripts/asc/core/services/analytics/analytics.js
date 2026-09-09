// ASC Core — do not edit. Customize via scripts/asc/configurations.js
/**
 * Analytics service — listens to ASC's `asc:{noun}:{verb}` custom-event bus
 * (see AGENTS.md → "Custom Events — Full Reference") and normalizes every
 * event into one trackEvent() call. Configure vendors, consent level, and
 * payload enrichment via configurations.js → analytics.
 *
 * Full event catalog, payload shapes, and vendor adapter examples: docs/ANALYTICS.md
 *
 * Auto-initializes on import, like every other core service — no explicit
 * init call needed (see CLAUDE.md → "Page Lifecycle").
 *
 * Add your own event → trackEvent() mapping without editing this file via
 * configurations.js → analytics.customListeners: an array of
 * [target, eventType, handler] tuples, same shape as the built-in LISTENERS
 * below, merged in at init time.
 */
import serviceConfigurations from '../configurations.js';
import users from '../users/users.js';
import downloads from '../downloads/downloads.js';

const UTM_STORAGE_KEY = 'asc:analytics:utm';
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

// Captured once per session on first load. Query params don't survive the
// IMS/SSO login redirect, so this is stashed in sessionStorage rather than
// re-read from location.search on every event.
function captureUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const utm = UTM_PARAMS.reduce((acc, key) => {
    const value = params.get(key);
    if (value) acc[key] = value;
    return acc;
  }, {});
  if (Object.keys(utm).length > 0) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  }
}

function getUtmParams() {
  try {
    return JSON.parse(sessionStorage.getItem(UTM_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function formDataToObject(formData) {
  return formData ? Object.fromEntries(formData) : {};
}

class Analytics {
  constructor(config) {
    this.config = config || {};
    captureUtmParams();
    this.attachListeners();
  }

  // Reads serviceConfigurations fresh on every call (not cached from the
  // constructor) — level can be a function re-evaluated per event (e.g. a
  // cookie-consent banner or preference-center toggle), and a site may swap
  // the whole config object at runtime.
  async trackEvent(name, rawPayload) {
    const {
      enabled = true, level = 'anonymous', identifyEvents = [], enrich, trackers = [],
    } = this.config;
    if (!enabled) return;

    const resolvedLevel = typeof level === 'function' ? level() : level;
    let payload = { ...rawPayload, ...getUtmParams() };

    if (resolvedLevel === 'identified' || identifyEvents.includes(name)) {
      const user = await users.getCurrentUser();
      payload = { ...payload, userId: user.userId, email: user.email };
    }

    if (enrich) payload = enrich(name, payload);
    if (!payload) return;

    trackers.forEach((tracker) => tracker(name, payload));
    // eslint-disable-next-line no-console
    console.debug('[ASC Analytics]', name, payload);
  }

  // [document target, event type, handler] — see docs/ANALYTICS.md for why
  // each event is safe to listen for on `document` (they all bubble there)
  // except asc:rendition:activate/preview, which are dispatched directly on
  // document.body with `bubbles: false`.
  builtInListeners() {
    const trackEvent = (name, payload) => this.trackEvent(name, payload);
    return [
      // ── Search ────────────────────────────────────────────────────────
      [document, 'asc:search:complete', (e) => {
        const { results, type, formData } = e.detail;
        if (results?.total === 0) {
          trackEvent('search_no_results', { formData: formDataToObject(formData) });
          return;
        }
        trackEvent(type === 'load-more' ? 'search_paginate' : 'search', {
          total: results?.total, size: results?.size, offset: results?.offset,
        });
      }],
      [document, 'asc:search:error', (e) => trackEvent('search_error', { error: String(e.detail.error) })],

      // ── Asset details ─────────────────────────────────────────────────
      [document, 'asc:asset:details:open', (e) => trackEvent('asset_detail_view', { assetId: e.detail.data?.ascAsset })],
      [document, 'asc:asset:share', (e) => trackEvent('asset_share', { assetId: e.detail.data?.ascAsset })],
      [document.body, 'asc:rendition:activate', (e) => trackEvent('rendition_select', {
        assetId: e.detail.asset?.uuid, renditionId: e.detail.rendition?.id,
      })],

      // ── Collections / cart ────────────────────────────────────────────
      [document, 'asc:collection:add', (e) => trackEvent('add_to_collection', {
        assetId: e.detail.data?.ascAsset, collectionId: e.detail.data?.ascCollection,
      })],
      [document, 'asc:collection:remove', (e) => trackEvent('remove_from_collection', {
        assetId: e.detail.data?.ascAsset, collectionId: e.detail.data?.ascCollection,
      })],
      [document, 'asc:collection:created', (e) => trackEvent('collection_create', { collectionId: e.detail.collection?.id })],
      [document, 'asc:share:created', (e) => trackEvent('collection_share', {
        collectionId: e.detail.collectionId, url: e.detail.url,
      })],

      // ── Downloads ──────────────────────────────────────────────────────
      // assetPaths/collectionId are pulled from the job record (not carried on the
      // event itself) so download_start/download_complete are traceable to the
      // specific assets involved — required for per-partner download audit trails.
      [document, 'asc:download:started', (e) => {
        const job = downloads.get(e.detail.jobId);
        trackEvent('download_start', {
          jobId: e.detail.jobId, assetPaths: job?.assetPaths, collectionId: job?.collectionId,
        });
      }],
      [document, 'asc:download:complete', (e) => {
        const job = downloads.get(e.detail.jobId);
        trackEvent('download_complete', {
          jobId: e.detail.jobId, assetPaths: job?.assetPaths, collectionId: job?.collectionId,
        });
      }],
      [document, 'asc:download:failed', (e) => trackEvent('download_failed', {
        jobId: e.detail.jobId, error: String(e.detail.error),
      })],
    ];
  }

  attachListeners() {
    [...this.builtInListeners(), ...(this.config.customListeners || [])]
      .forEach(([target, type, handler]) => target.addEventListener(type, handler));
  }
}

export default new Analytics(serviceConfigurations.analytics || {});
