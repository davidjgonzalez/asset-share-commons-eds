// ASC Core — do not edit. Customize via scripts/configurations.js
import serviceConfigurations from "../configurations.js";
import storage from "../storage/storage.js";
import Asset from "../../models/asset.js";

export const Actions = {
  ADD_TO_COLLECTION: "add-to-collection",
  REMOVE_FROM_COLLECTION: "remove-from-collection",
};

export const Events = {
  COLLECTION_ADDED: "asc:collection:add",
  COLLECTION_REMOVED: "asc:collection:remove",
  COLLECTION_UPDATED: "asc:collection:update",
};

/**
 Collections are stored in localStorage as part of a user's object. The format looks like this:

 asc.anonymous = {
    collections: [
        {
            id: 'cart',
            name: 'Cart',
            assetIds: ['123', '456', '789']
        },
        {
            id: 'cx',
            name: 'Campaign X',
            assetIds: ['123', '456', '098', '765']
        }
    ]
}
**/

class Collections {
  constructor(config) {
    this.config = config;
    this.init();
  }

  async init() {
    if (!storage.get(storage.COLLECTIONS)) {
      storage.set(storage.COLLECTIONS, []);
    }

    await this.createCollection('cart');

    document.body.addEventListener("asc:collection:add", (event) => {
      const { ascAsset, ascCollection } = event.detail.data;
      this.addToCollection(ascCollection, ascAsset);
    });

    document.body.addEventListener("asc:collection:remove", (event) => {
      const { ascAsset, ascCollection } = event.detail.data;
      this.removeFromCollection(ascCollection, ascAsset);
    });
  }

  _saveCollection(collection) {
    storage.set(
      storage.COLLECTIONS,
      storage.get(storage.COLLECTIONS).map((c) => (c.id === collection.id ? collection : c)),
    );
  }

  async _hydrateAssets(collection) {
    collection.assets = await Promise.all(collection.assetIds.map((id) => Asset.create(id)));
    return collection;
  }

  deleteCollection(collectionId) {
    storage.set(storage.COLLECTIONS, storage.get(storage.COLLECTIONS).filter((c) => c.id !== collectionId));
  }

  async createCollection(collectionId, name, assetIds = []) {
    if (storage.get(storage.COLLECTIONS).find((c) => c.id === collectionId)) {
      console.warn(`Collection with id "${collectionId}" already exists`);
      return;
    }

    storage.set(storage.COLLECTIONS, [
      ...storage.get(storage.COLLECTIONS),
      {
        id: collectionId,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        name,
        assetIds,
      },
    ]);

    return this.getCollection(collectionId, false);
  }

  async getCollections(hydrateAssets = true) {
    const collections = storage.get(storage.COLLECTIONS) || [];
    if (!hydrateAssets) return collections;
    return Promise.all(collections.map((c) => this._hydrateAssets(c)));
  }

  async getCollection(collectionId, hydrateAssets = true) {
    const collections = await this.getCollections(false);
    const collection = collections.find((c) => c.id === collectionId);
    if (!collection) return null;
    return hydrateAssets ? this._hydrateAssets(collection) : collection;
  }

  async addToCollection(collectionId, assetId) {
    const collection = await this.getCollection(collectionId, false);

    if (!collection) {
      console.error(`Collection with id "${collectionId}" not found`);
      return;
    }

    if (collection.assetIds.includes(assetId)) return;

    collection.assetIds.push(assetId);
    collection.lastUpdatedAt = new Date().toISOString();
    this._saveCollection(collection);

    document.dispatchEvent(new CustomEvent(Events.COLLECTION_ADDED, { detail: { collectionId, assetId } }));
    document.dispatchEvent(new CustomEvent(Events.COLLECTION_UPDATED, { detail: { collectionId, assetId, action: "added" } }));
  }

  async contains(collectionId, assetId) {
    const collection = await this.getCollection(collectionId, false);
    return collection?.assetIds.includes(assetId) ?? false;
  }

  async removeFromCollection(collectionId, assetId) {
    const collection = await this.getCollection(collectionId, false);

    if (!collection) {
      console.error(`Collection with id "${collectionId}" not found`);
      return;
    }

    if (!collection.assetIds.includes(assetId)) return;

    collection.assetIds = collection.assetIds.filter((id) => id !== assetId);
    collection.lastUpdatedAt = new Date().toISOString();
    this._saveCollection(collection);

    document.dispatchEvent(new CustomEvent(Events.COLLECTION_REMOVED, { detail: { collectionId, assetId } }));
    document.dispatchEvent(new CustomEvent(Events.COLLECTION_UPDATED, { detail: { collectionId, assetId, action: "removed" } }));
  }
}

export default new Collections(serviceConfigurations.collections);
