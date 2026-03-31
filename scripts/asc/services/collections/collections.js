// ASC Core — do not edit. Customize via scripts/configurations.js
import serviceConfigurations from "../configurations.js";
import storage from "../storage/storage.js";
import Asset from "../../models/asset.js";

export const Events = {
  ASSET_ADDED: "asc:collection:add",
  ASSET_REMOVED: "asc:collection:remove",
  CHANGED: "asc:collection:change",
  CREATED: "asc:collection:created",
  DELETED: "asc:collection:deleted",
  ACTIVATED: "asc:collection:activated",
};

/**
 * Collections storage schema (stored under storage key 'collections'):
 *
 * {
 *   defaultId: "uuid",          // ID of the permanent default collection; never deleted
 *   items: {
 *     "uuid": {
 *       id:         string,
 *       name:       string,
 *       createdAt:  ISO string,
 *       modifiedAt: ISO string,
 *       assetIds:   string[]
 *     }
 *   }
 * }
 *
 * The active collection ID is stored separately:
 *   storage.get(storage.ACTIVE_COLLECTION_ID) → UUID | null
 * null means "use defaultId".
 */

class Collections {
  constructor(config) {
    this.config = config || {};
    this.init();
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  async init() {
    // Migrate or reset stale / missing schema
    const raw = storage.get("collections");
    const isOldFormat = Array.isArray(raw);
    const isMissing = raw === null || raw === undefined;

    if (isMissing || isOldFormat) {
      // Preserve asset IDs from the old flat-array "cart" collection when possible
      let seedAssetIds = [];
      if (isOldFormat) {
        const cart = raw.find((c) => c.id === "cart");
        if (cart?.assetIds?.length) {
          seedAssetIds = cart.assetIds;
        }
      }

      const defaultId = crypto.randomUUID();
      const now = new Date().toISOString();
      this._setData({
        defaultId,
        items: {
          [defaultId]: {
            id: defaultId,
            name: "My Collection",
            createdAt: now,
            modifiedAt: now,
            assetIds: seedAssetIds,
          },
        },
      });
    } else {
      // Valid new schema — ensure the default collection still exists
      const data = raw;
      if (!data.defaultId || !data.items?.[data.defaultId]) {
        const defaultId = crypto.randomUUID();
        const now = new Date().toISOString();
        data.defaultId = defaultId;
        data.items = data.items || {};
        data.items[defaultId] = {
          id: defaultId,
          name: "My Collection",
          createdAt: now,
          modifiedAt: now,
          assetIds: [],
        };
        this._setData(data);
      }
    }

    // DOM event listeners (dispatched on document per AGENTS.md)
    document.addEventListener(Events.ASSET_ADDED, (event) => {
      const { ascAsset, ascCollection } = event.detail?.data || {};
      if (ascAsset) this.addAsset(ascAsset, ascCollection);
    });

    document.addEventListener(Events.ASSET_REMOVED, (event) => {
      const { ascAsset, ascCollection } = event.detail?.data || {};
      if (ascAsset) this.removeAsset(ascAsset, ascCollection);
    });

    // Cross-tab sync
    storage.onExternalChange(() => {
      document.dispatchEvent(
        new CustomEvent(Events.CHANGED, { detail: { source: "external" } }),
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _getData() {
    return storage.get("collections") || { defaultId: null, items: {} };
  }

  _setData(data) {
    storage.set("collections", data);
  }

  /**
   * Persists an updated collection back to storage.
   * @param {Object} collection
   */
  _saveCollection(collection) {
    const data = this._getData();
    collection.modifiedAt = new Date().toISOString();
    data.items[collection.id] = collection;
    this._setData(data);
  }

  /**
   * Hydrates a collection object with full Asset instances.
   * @param {Object} collection - Plain collection object
   * @returns {Promise<Object>} Collection with an `assets` array added
   */
  async _hydrateAssets(collection) {
    collection.assets = await Promise.all(
      collection.assetIds.map((id) => Asset.create(id)),
    );
    return collection;
  }

  // ---------------------------------------------------------------------------
  // Collection CRUD
  // ---------------------------------------------------------------------------

  /**
   * Creates a new collection.
   * @param {string} name
   * @returns {Object} The new collection (assets not hydrated)
   */
  create(name) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const collection = {
      id,
      name,
      createdAt: now,
      modifiedAt: now,
      assetIds: [],
    };
    const data = this._getData();
    data.items[id] = collection;
    this._setData(data);
    document.dispatchEvent(
      new CustomEvent(Events.CREATED, { detail: { collection } }),
    );
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, { detail: { action: "created", id } }),
    );
    return { ...collection };
  }

  /**
   * Deletes a collection by ID.  The default collection cannot be deleted.
   * If the deleted collection was active, falls back to the default.
   * @param {string} id
   */
  delete(id) {
    const data = this._getData();
    if (id === data.defaultId) {
      console.warn("Cannot delete the default collection.");
      return;
    }
    if (!data.items[id]) return;

    delete data.items[id];
    this._setData(data);

    // If the deleted collection was active, fall back to default
    const activeId = storage.get(storage.ACTIVE_COLLECTION_ID);
    if (activeId === id) {
      storage.set(storage.ACTIVE_COLLECTION_ID, null);
      document.dispatchEvent(
        new CustomEvent(Events.ACTIVATED, {
          detail: { id: data.defaultId, previous: id },
        }),
      );
    }

    document.dispatchEvent(
      new CustomEvent(Events.DELETED, { detail: { id } }),
    );
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, { detail: { action: "deleted", id } }),
    );
  }

  /**
   * Renames a collection.
   * @param {string} id
   * @param {string} name
   */
  rename(id, name) {
    const data = this._getData();
    const collection = data.items[id];
    if (!collection) {
      console.error(`Collection "${id}" not found`);
      return;
    }
    collection.name = name;
    this._saveCollection(collection);
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, { detail: { action: "renamed", id } }),
    );
  }

  // ---------------------------------------------------------------------------
  // Collection getters
  // ---------------------------------------------------------------------------

  /**
   * Returns all collections as an array.
   * @param {boolean} [hydrateAssets=false]
   * @returns {Promise<Object[]>}
   */
  async getAll(hydrateAssets = false) {
    const { items } = this._getData();
    const collections = Object.values(items).map((c) => ({ ...c }));
    if (!hydrateAssets) return collections;
    return Promise.all(collections.map((c) => this._hydrateAssets(c)));
  }

  /**
   * Returns a single collection by ID, or null if not found.
   * @param {string} id
   * @param {boolean} [hydrateAssets=false]
   * @returns {Promise<Object|null>}
   */
  async get(id, hydrateAssets = false) {
    const { items } = this._getData();
    const collection = items[id] ? { ...items[id] } : null;
    if (!collection) return null;
    return hydrateAssets ? this._hydrateAssets(collection) : collection;
  }

  /**
   * Returns the default (permanent) collection.
   * @param {boolean} [hydrateAssets=false]
   * @returns {Promise<Object>}
   */
  async getDefault(hydrateAssets = false) {
    const { defaultId } = this._getData();
    return this.get(defaultId, hydrateAssets);
  }

  /**
   * Resolves the active collection ID, falling back to defaultId.
   * @returns {string}
   */
  getActiveId() {
    const data = this._getData();
    const activeId = storage.get(storage.ACTIVE_COLLECTION_ID);
    // Validate: must exist in items
    if (activeId && data.items[activeId]) return activeId;
    return data.defaultId;
  }

  /**
   * Returns the currently active collection.
   * @param {boolean} [hydrateAssets=false]
   * @returns {Promise<Object>}
   */
  async getActive(hydrateAssets = false) {
    return this.get(this.getActiveId(), hydrateAssets);
  }

  /**
   * Sets the active collection.
   * @param {string} id
   */
  setActive(id) {
    const { items } = this._getData();
    if (!items[id]) {
      console.error(`Collection "${id}" not found`);
      return;
    }
    const previous = this.getActiveId();
    storage.set(storage.ACTIVE_COLLECTION_ID, id);
    document.dispatchEvent(
      new CustomEvent(Events.ACTIVATED, { detail: { id, previous } }),
    );
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, {
        detail: { action: "activated", id },
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Asset management
  // ---------------------------------------------------------------------------

  /**
   * Adds an asset to a collection (defaults to active collection).
   * Deduplicates silently.
   * @param {string} assetId
   * @param {string} [collectionId]
   */
  async addAsset(assetId, collectionId) {
    const id = collectionId || this.getActiveId();
    const collection = await this.get(id, false);
    if (!collection) {
      console.error(`Collection "${id}" not found`);
      return;
    }
    if (collection.assetIds.includes(assetId)) return;

    collection.assetIds.push(assetId);
    this._saveCollection(collection);

    document.dispatchEvent(
      new CustomEvent(Events.ASSET_ADDED, {
        detail: { collectionId: id, assetId },
      }),
    );
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, {
        detail: { action: "assetAdded", collectionId: id, assetId },
      }),
    );
  }

  /**
   * Removes an asset from a collection (defaults to active collection).
   * @param {string} assetId
   * @param {string} [collectionId]
   */
  async removeAsset(assetId, collectionId) {
    const id = collectionId || this.getActiveId();
    const collection = await this.get(id, false);
    if (!collection) {
      console.error(`Collection "${id}" not found`);
      return;
    }
    if (!collection.assetIds.includes(assetId)) return;

    collection.assetIds = collection.assetIds.filter((a) => a !== assetId);
    this._saveCollection(collection);

    document.dispatchEvent(
      new CustomEvent(Events.ASSET_REMOVED, {
        detail: { collectionId: id, assetId },
      }),
    );
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, {
        detail: { action: "assetRemoved", collectionId: id, assetId },
      }),
    );
  }

  /**
   * Returns whether a collection contains a given asset.
   * Defaults to the active collection.
   * @param {string} assetId
   * @param {string} [collectionId]
   * @returns {Promise<boolean>}
   */
  async hasAsset(assetId, collectionId) {
    const id = collectionId || this.getActiveId();
    const collection = await this.get(id, false);
    return collection?.assetIds.includes(assetId) ?? false;
  }

  // ---------------------------------------------------------------------------
  // User login / merge
  // ---------------------------------------------------------------------------

  /**
   * Merges the anonymous user's collections into the logged-in user's default
   * collection, then switches the active user context.
   *
   * - All assetIds from every anonymous collection are merged (deduplicated)
   *   into the logged-in user's default collection.
   * - Calls storage.mergeUserData('anonymous', userId) to migrate other
   *   user-scoped data (e.g. recently viewed).
   * - Calls storage._setCurrentUserId(userId) to switch the active user.
   * - Dispatches CHANGED so subscribers re-render.
   *
   * @param {string} userId - The authenticated user's ID
   */
  async loginAs(userId) {
    // Capture anonymous collections before switching user context
    const anonymousData = storage.get("collections") || {
      defaultId: null,
      items: {},
    };
    const anonymousAssetIds = Object.values(anonymousData.items || {}).flatMap(
      (c) => c.assetIds || [],
    );

    // Merge other user-scoped data (e.g. recently viewed)
    storage.mergeUserData("anonymous", userId);

    // Switch to the authenticated user
    storage._setCurrentUserId(userId);

    // Now operating under the userId context — ensure schema exists
    const userData = storage.get("collections");
    const isOldUserFormat = Array.isArray(userData);
    const isMissingUserData = userData === null || userData === undefined;

    if (isMissingUserData || isOldUserFormat) {
      const defaultId = crypto.randomUUID();
      const now = new Date().toISOString();
      this._setData({
        defaultId,
        items: {
          [defaultId]: {
            id: defaultId,
            name: "My Collection",
            createdAt: now,
            modifiedAt: now,
            assetIds: [],
          },
        },
      });
    }

    // Merge anonymous asset IDs into the user's default collection
    if (anonymousAssetIds.length > 0) {
      const data = this._getData();
      const defaultCollection = data.items[data.defaultId];
      if (defaultCollection) {
        const merged = [
          ...new Set([...defaultCollection.assetIds, ...anonymousAssetIds]),
        ];
        defaultCollection.assetIds = merged;
        defaultCollection.modifiedAt = new Date().toISOString();
        this._setData(data);
      }
    }

    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, {
        detail: { action: "login", userId },
      }),
    );
  }
}

export default new Collections(serviceConfigurations.collections || {});
