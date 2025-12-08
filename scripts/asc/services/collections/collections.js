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

            const { asset, collection } = el.dataset;

            storage.get('collections')[collection].add(asset);
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
        return storage.get('collections')[collection];
    }
}

export default new Collections(serviceConfigurations.collections);

