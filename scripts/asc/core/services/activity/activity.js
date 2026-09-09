// ASC Core — do not edit. Customize via scripts/asc/configurations.js
/**
 * Activity service — listens to the same `asc:{noun}:{verb}` event bus as the
 * analytics service (see AGENTS.md → "Custom Events — Full Reference") and
 * records a local, per-user timeline of searches, asset-detail views,
 * collection changes, shares, downloads, and rendition copy/download actions.
 * Stored via the storage service under the `activity` key, so it's scoped
 * per-user the same way collections/recentlyViewed are (see storage.js) —
 * anonymous and logged-in users each get their own list.
 *
 * This is deliberately just the *recorder* — no rendering. Read it back with
 * services.activity.getActivity() when building a UI (e.g. a "recent
 * activity" timeline).
 *
 * Configure enabled/max in configurations.js → activity. Auto-initializes on
 * import, like every other core service. Add your own event → activity-entry
 * mapping without editing this file via configurations.js →
 * activity.customListeners: an array of [target, eventType, handler] tuples,
 * same shape as the built-in LISTENERS below, merged in at init time.
 *
 * Full schema, config, and extension recipe: docs/ACTIVITY.md
 */
import serviceConfigurations from '../configurations.js';
import storage from '../storage/storage.js';
import collections from '../collections/collections.js';
import downloads from '../downloads/downloads.js';

const ACTIVITY_KEY = 'activity';
const DEFAULT_MAX = 200;

function formDataToObject(formData) {
  return formData ? Object.fromEntries(formData) : {};
}

function elapsedSince(iso) {
  return Date.now() - new Date(iso).getTime();
}

// Asset instances are cached by UUID on open (search results, board items,
// collection rows all populate window.asc.cache.assets — see CLAUDE.md
// "Global Cache") — reuse that instead of re-fetching just for a label.
function describeAsset(uuid) {
  const asset = window.asc?.cache?.assets?.get(uuid);
  return {
    assetId: uuid || null,
    assetName: asset?.title || asset?.filename || null,
    assetPath: asset?.path || null,
  };
}

function describeRendition(uuid, renditionId) {
  const asset = window.asc?.cache?.assets?.get(uuid);
  const rendition = asset?.renditions?.find((r) => r.id === renditionId);
  return { renditionId: renditionId || null, renditionLabel: rendition?.label || null };
}

class Activity {
  constructor(config) {
    this.config = config || {};
    // In-progress asset-details view, tracked so its duration can be filled
    // in once it ends. A view can end via asc:asset:details:close, but that
    // only fires on an explicit close-button click (see details-modal.js) —
    // Escape/backdrop dismissal closes the native <dialog> directly with no
    // event. The pagehide listener below catches those so a view never stays
    // "open" forever.
    this.openAssetView = null;
    // In-progress download jobs by jobId, so download_complete/failed can
    // fill in the duration — same job-record lookup analytics uses for
    // assetPaths/collectionId (not carried on the event itself).
    this.openDownloads = new Map();

    if (!this.isEnabled()) return;
    this.attachListeners();
    window.addEventListener('pagehide', () => this.endAssetView());
  }

  isEnabled() {
    return this.config.enabled ?? true;
  }

  maxEntries() {
    return this.config.max ?? DEFAULT_MAX;
  }

  /** @returns {object[]} The current user's activity entries, newest first. */
  getActivity() {
    return storage.get(ACTIVITY_KEY) || [];
  }

  /** Clears the current user's activity history. */
  clearActivity() {
    storage.remove(ACTIVITY_KEY);
  }

  // Prepend a new entry (same convention as storage.addRecentlyViewed) and
  // cap the list — oldest entries drop off first.
  record(type, fields) {
    if (!this.isEnabled()) return null;
    const entry = {
      id: crypto.randomUUID(), type, at: new Date().toISOString(), durationMs: null, ...fields,
    };
    storage.set(ACTIVITY_KEY, [entry, ...this.getActivity()].slice(0, this.maxEntries()));
    return entry;
  }

  // Patch an in-progress entry in place (e.g. adding durationMs once an
  // asset-view/download that started earlier finishes). No-ops if the entry
  // already scrolled off the end of the capped list.
  finalize(id, patch) {
    if (!id) return;
    const entries = this.getActivity();
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return;
    entries[index] = { ...entries[index], ...patch };
    storage.set(ACTIVITY_KEY, entries);
  }

  startAssetView(uuid) {
    this.openAssetView = this.record('asset-view', describeAsset(uuid));
  }

  endAssetView() {
    if (!this.openAssetView) return;
    this.finalize(this.openAssetView.id, { durationMs: elapsedSince(this.openAssetView.at) });
    this.openAssetView = null;
  }

  // [document target, event type, handler] — mirrors the analytics service's
  // LISTENERS. asc:rendition:activate/preview are intentionally not tracked
  // here — they're transient/sticky UI state, not a distinct user activity
  // worth a timeline row.
  builtInListeners() {
    return [
      // ── Search ────────────────────────────────────────────────────────
      // Skip 'load-more' (infinite-scroll pagination of the same search) —
      // not a new activity, just more of the one already recorded.
      [document, 'asc:search:complete', (e) => {
        const { results, type, formData } = e.detail;
        if (type === 'load-more') return;
        this.record('search', { query: formDataToObject(formData), total: results?.total });
      }],

      // ── Asset details ─────────────────────────────────────────────────
      [document, 'asc:asset:details:open', (e) => this.startAssetView(e.detail.data?.ascAsset)],
      [document, 'asc:asset:details:close', () => this.endAssetView()],
      [document, 'asc:asset:share', (e) => this.record('asset-share', describeAsset(e.detail.data?.ascAsset))],

      // ── Renditions (download / copy-url / copy-image / share) ─────────
      [document, 'asc:rendition:download', (e) => this.record('rendition-download', {
        ...describeAsset(e.detail.data?.ascAsset),
        ...describeRendition(e.detail.data?.ascAsset, e.detail.data?.ascRendition),
      })],
      [document, 'asc:rendition:copy-url', (e) => this.record('rendition-copy-url', {
        ...describeAsset(e.detail.data?.ascAsset),
        ...describeRendition(e.detail.data?.ascAsset, e.detail.data?.ascRendition),
      })],
      [document, 'asc:rendition:copy-image', (e) => this.record('rendition-copy-image', {
        ...describeAsset(e.detail.data?.ascAsset),
        ...describeRendition(e.detail.data?.ascAsset, e.detail.data?.ascRendition),
      })],
      [document, 'asc:rendition:share', (e) => this.record('rendition-share', {
        ...describeAsset(e.detail.data?.ascAsset),
        ...describeRendition(e.detail.data?.ascAsset, e.detail.data?.ascRendition),
      })],

      // ── Collections ─────────────────────────────────────────────────────
      [document, 'asc:collection:add', async (e) => {
        const collectionId = e.detail.data?.ascCollection || collections.getActiveId();
        this.record('collection-add', {
          ...describeAsset(e.detail.data?.ascAsset),
          collectionId,
          collectionName: (await collections.get(collectionId))?.name || null,
        });
      }],
      [document, 'asc:collection:remove', async (e) => {
        const collectionId = e.detail.data?.ascCollection || collections.getActiveId();
        this.record('collection-remove', {
          ...describeAsset(e.detail.data?.ascAsset),
          collectionId,
          collectionName: (await collections.get(collectionId))?.name || null,
        });
      }],
      [document, 'asc:collection:created', (e) => this.record('collection-create', {
        collectionId: e.detail.collection?.id, collectionName: e.detail.collection?.name,
      })],
      // No collectionName here — the collection is already gone by the time
      // this fires, so there's nothing left to look up (see docs/ACTIVITY.md).
      [document, 'asc:collection:deleted', (e) => this.record('collection-delete', { collectionId: e.detail.id })],

      // ── Shares ───────────────────────────────────────────────────────────
      [document, 'asc:share:created', (e) => this.record('share-create', {
        url: e.detail.url, title: e.detail.title, collectionId: e.detail.collectionId,
      })],

      // ── Downloads ────────────────────────────────────────────────────────
      [document, 'asc:download:started', (e) => {
        const job = downloads.get(e.detail.jobId);
        const entry = this.record('download', {
          jobId: e.detail.jobId, assetPaths: job?.assetPaths, collectionId: job?.collectionId, status: 'running',
        });
        if (entry) this.openDownloads.set(e.detail.jobId, entry.id);
      }],
      [document, 'asc:download:complete', (e) => {
        const id = this.openDownloads.get(e.detail.jobId);
        this.openDownloads.delete(e.detail.jobId);
        if (!id) return;
        const startedAt = this.getActivity().find((entry) => entry.id === id)?.at;
        this.finalize(id, {
          status: 'complete', downloadUrl: e.detail.downloadUrl,
          durationMs: startedAt ? elapsedSince(startedAt) : null,
        });
      }],
      [document, 'asc:download:failed', (e) => {
        const id = this.openDownloads.get(e.detail.jobId);
        this.openDownloads.delete(e.detail.jobId);
        if (!id) return;
        const startedAt = this.getActivity().find((entry) => entry.id === id)?.at;
        this.finalize(id, {
          status: 'failed', error: String(e.detail.error),
          durationMs: startedAt ? elapsedSince(startedAt) : null,
        });
      }],
    ];
  }

  attachListeners() {
    [...this.builtInListeners(), ...(this.config.customListeners || [])]
      .forEach(([target, type, handler]) => target.addEventListener(type, handler));
  }
}

export default new Activity(serviceConfigurations.activity || {});
