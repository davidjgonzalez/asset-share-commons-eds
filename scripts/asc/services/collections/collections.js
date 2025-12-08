import serviceConfigurations from "../configurations.js";
import actions from '../actions/actions.js'
import storage from '../storage/storage.js';

class Collections {
    constructor(config) {
        this.config = config = {};;
        this.collections = [];

        this.init();
    }

    init() {
        this.collections = this.config.collections;

        /** Add to collection */
        actions.registerAction('add-to-collection', 'click', (event, el) => {            
            event.preventDefault();
            event.stopPropagation();

            const { ascAssetId, ascCollection } = el.dataset;
            console.log('add-to-collection', el.dataset);

            console.log('add-to-collection', storage.get('collections'));

            this.addToCollection(ascAssetId, ascCollection);
        });

        /** Remove from collection */
        actions.registerAction('remove-from-collection', 'click', (event, el) => {            
            event.preventDefault();
            event.stopPropagation();

            const { asset, collection } = el.dataset;
            console.log('remove-from-collection', asset, collection);

            storage.get('collections')[collection].remove(asset);
        });
    }

    getCollections() {
        return storage.get('collections') || [];
    }

    getCollection(collection) {
        return (storage.get('collections') || {})[collection] || [];
    }

    addToCollection(assetId, collectionName) {
        const collection = this.getCollection(collectionName);
        if (!collection.includes(assetId)) {
            collection.push(assetId);
            storage.set('collections', { ...storage.get('collections'), [collectionName]: collection });

            // Emit event to update collection
            document.dispatchEvent(new CustomEvent('asc:collection:updated', { detail: { collectionName, collection } }));
        }
    }

    removeFromCollection(assetId, collectionName) {
        const collection = this.getCollection(collectionName);
        if (collection.includes(assetId)) {
            collection = collection.filter(item => item !== assetId);
            storage.set('collections', { ...storage.get('collections'), [collectionName]: collection });

            // Emit event to update collection
            document.dispatchEvent(new CustomEvent('asc:collection:updated', { detail: { collectionName, collection } }));
        }
    }
}

export default new Collections(serviceConfigurations.collections);

