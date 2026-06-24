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
 *   defaultId: "uuid",
 *   items: {
 *     "uuid": {
 *       id:         string,
 *       name:       string,
 *       createdAt:  ISO string,
 *       modifiedAt: ISO string,
 *       items:      Array<AssetItem | SectionItem>
 *     }
 *   }
 * }
 *
 * AssetItem:   { type: 'asset',   id: string, mimeType?: string }
 * SectionItem: { type: 'section', id: string, title: string, body: string }
 *
 * Active collection ID: storage.get(storage.ACTIVE_COLLECTION_ID) → UUID | null
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
            items: seedAssetIds.map((id) => ({ type: "asset", id })),
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
          items: [],
        };
        this._setData(data);
      }
    }

    // v1→v2: migrate assetIds[]+assetTypes{} → items[]
    const d = this._getData();
    let needsMigration = false;
    Object.values(d.items || {}).forEach((c) => {
      if (!Array.isArray(c.assetIds)) return;
      needsMigration = true;
      const types = c.assetTypes || {};
      c.items = c.assetIds.map((id) => ({
        type: "asset",
        id,
        ...(types[id] ? { mimeType: types[id] } : {}),
      }));
      delete c.assetIds;
      delete c.assetTypes;
    });
    if (needsMigration) this._setData(d);

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
   * Adds computed backward-compat `assetIds` to a raw collection object.
   * Call on every collection before returning it from a getter.
   * @param {Object} collection - Raw collection from storage
   * @returns {Object} Decorated collection with assetIds computed
   */
  _decorate(collection) {
    return {
      ...collection,
      assetIds: (collection.items || [])
        .filter((i) => i.type === "asset")
        .map((i) => i.id),
    };
  }

  /**
   * Hydrates a collection object with full Asset instances.
   * Populates:
   *   collection.hydratedItems — mixed array; asset items gain a `.asset` property
   *   collection.assets        — flat array of Asset objects (backward compat)
   * @param {Object} collection - Decorated collection object
   * @returns {Promise<Object>}
   */
  async _hydrateAssets(collection) {
    const assetItemIds = (collection.items || [])
      .filter((i) => i.type === "asset")
      .map((i) => i.id);

    const hydratedAssets = await Promise.all(
      assetItemIds.map((id) => Asset.create(id)),
    );
    const assetMap = new Map(hydratedAssets.map((a) => [a?.uuid, a]));

    collection.hydratedItems = (collection.items || []).map((item) => {
      if (item.type !== "asset") return item;
      return { ...item, asset: assetMap.get(item.id) || null };
    });

    // Backward compat — callers like the download dialog use collection.assets
    collection.assets = hydratedAssets.filter(Boolean);
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
      items: [],
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
    return this._decorate({ ...collection });
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
    const collections = Object.values(items).map((c) => this._decorate({ ...c }));
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
    const collection = items[id] ? this._decorate({ ...items[id] }) : null;
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
    const data = this._getData();
    const collection = data.items[id];
    if (!collection) {
      console.error(`Collection "${id}" not found`);
      return;
    }
    if ((collection.items || []).some((i) => i.type === "asset" && i.id === assetId)) return;

    const item = { type: "asset", id: assetId };
    const cachedAsset = window.asc?.cache?.assets?.get(assetId);
    if (cachedAsset?.mimeType) item.mimeType = cachedAsset.mimeType;

    collection.items = [...(collection.items || []), item];
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
    const data = this._getData();
    const collection = data.items[id];
    if (!collection) {
      console.error(`Collection "${id}" not found`);
      return;
    }
    if (!(collection.items || []).some((i) => i.type === "asset" && i.id === assetId)) return;

    collection.items = (collection.items || []).filter(
      (i) => !(i.type === "asset" && i.id === assetId),
    );
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
    const data = this._getData();
    const collection = data.items[id];
    return (collection?.items || []).some((i) => i.type === "asset" && i.id === assetId);
  }

  // ---------------------------------------------------------------------------
  // Item reordering
  // ---------------------------------------------------------------------------

  /**
   * Replaces the full item order in a collection.
   * Accepts a mixed array of asset and section items (as read from the DOM).
   * For section items, title/body from the caller are saved (captures unsaved DOM edits).
   * Unknown IDs are silently dropped.
   * @param {string} collectionId
   * @param {Array<{type,id,title?,body?}>} newItems
   */
  reorder(collectionId, newItems) {
    const data = this._getData();
    const collection = data.items[collectionId];
    if (!collection) {
      console.error(`Collection "${collectionId}" not found`);
      return;
    }
    const existingMap = new Map((collection.items || []).map((i) => [i.id, i]));
    collection.items = newItems
      .filter((item) => existingMap.has(item.id))
      .map((item) => {
        if (item.type !== "section") return existingMap.get(item.id);
        const existing = existingMap.get(item.id);
        return {
          ...existing,
          title: item.title !== undefined ? item.title : existing.title,
          body: item.body !== undefined ? item.body : existing.body,
        };
      });
    this._saveCollection(collection);
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, {
        detail: { action: "reordered", id: collectionId },
      }),
    );
  }

  /**
   * Backward-compat alias for reorder() that accepts an ordered array of asset IDs.
   * @param {string} collectionId
   * @param {string[]} newAssetIds
   */
  reorderAssets(collectionId, newAssetIds) {
    this.reorder(collectionId, newAssetIds.map((id) => ({ type: "asset", id })));
  }

  // ---------------------------------------------------------------------------
  // Section management
  // ---------------------------------------------------------------------------

  /**
   * Appends a new section widget to the end of a collection's items.
   * @param {string} collectionId
   * @param {{title?: string, body?: string}} [opts]
   * @returns {Object|null} The new SectionItem, or null if collection not found
   */
  async addSection(collectionId, { title = "", body = "" } = {}) {
    const id = collectionId || this.getActiveId();
    const data = this._getData();
    const collection = data.items[id];
    if (!collection) {
      console.error(`Collection "${id}" not found`);
      return null;
    }
    const section = { type: "section", id: crypto.randomUUID(), title, body };
    collection.items = [...(collection.items || []), section];
    this._saveCollection(collection);
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, {
        detail: { action: "sectionAdded", collectionId: id },
      }),
    );
    return section;
  }

  /**
   * Updates a section's title and/or body in place.
   * Does NOT dispatch CHANGED to avoid re-rendering while the user is typing.
   * @param {string} collectionId
   * @param {string} sectionId
   * @param {{title?: string, body?: string}} updates
   */
  updateSection(collectionId, sectionId, { title, body }) {
    const data = this._getData();
    const collection = data.items[collectionId];
    if (!collection) return;
    const section = (collection.items || []).find(
      (i) => i.type === "section" && i.id === sectionId,
    );
    if (!section) return;
    if (title !== undefined) section.title = title;
    if (body !== undefined) section.body = body;
    this._saveCollection(collection);
  }

  /**
   * Partially updates x, y, and/or notes on an asset item.
   * Does NOT dispatch CHANGED — callers update the DOM in real time.
   * @param {string} collectionId
   * @param {string} itemId - asset UUID
   * @param {{ x?: number, y?: number, notes?: string }} updates
   */
  updateItem(collectionId, itemId, updates) {
    const data = this._getData();
    const collection = data.items[collectionId];
    if (!collection) return;
    const item = (collection.items || []).find(
      (i) => i.type === "asset" && i.id === itemId,
    );
    if (!item) return;
    if (updates.x !== undefined) item.x = updates.x;
    if (updates.y !== undefined) item.y = updates.y;
    if (updates.notes !== undefined) item.notes = updates.notes;
    this._saveCollection(collection);
  }

  /**
   * Removes a section by ID from a collection.
   * @param {string} collectionId
   * @param {string} sectionId
   */
  async removeSection(collectionId, sectionId) {
    const id = collectionId || this.getActiveId();
    const data = this._getData();
    const collection = data.items[id];
    if (!collection) return;
    collection.items = (collection.items || []).filter(
      (i) => !(i.type === "section" && i.id === sectionId),
    );
    this._saveCollection(collection);
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, {
        detail: { action: "sectionRemoved", collectionId: id },
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // User login / merge
  // ---------------------------------------------------------------------------

  /**
   * Merges the anonymous user's collections into the logged-in user's default
   * collection, then switches the active user context.
   * @param {string} userId - The authenticated user's ID
   */
  async loginAs(userId) {
    // Capture anonymous collections before switching user context
    const anonymousData = storage.get("collections") || {
      defaultId: null,
      items: {},
    };
    const anonymousAssetIds = Object.values(anonymousData.items || {}).flatMap(
      (c) => (c.items || []).filter((i) => i.type === "asset").map((i) => i.id),
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
            items: [],
          },
        },
      });
    }

    // Merge anonymous asset IDs into the user's default collection
    if (anonymousAssetIds.length > 0) {
      const data = this._getData();
      const defaultCollection = data.items[data.defaultId];
      if (defaultCollection) {
        const existingIds = new Set(
          (defaultCollection.items || [])
            .filter((i) => i.type === "asset")
            .map((i) => i.id),
        );
        const newItems = anonymousAssetIds
          .filter((id) => !existingIds.has(id))
          .map((id) => ({ type: "asset", id }));
        defaultCollection.items = [...(defaultCollection.items || []), ...newItems];
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

  // ---------------------------------------------------------------------------
  // User logout
  // ---------------------------------------------------------------------------

  /**
   * Switches back to anonymous scope.
   */
  logout() {
    storage._setCurrentUserId("anonymous");
    document.dispatchEvent(
      new CustomEvent(Events.CHANGED, {
        detail: { action: "logout" },
      }),
    );
  }
}

export default new Collections(serviceConfigurations.collections || {});
